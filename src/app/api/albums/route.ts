import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { log } from '@/lib/logger';
import { albumRelease, isReleaseInput, parseReleaseInput } from '@/lib/release-schedule';

export const dynamic = 'force-dynamic';

/**
 * Albums, the folder version (owner, 2026-09-02: artists choose artwork per
 * track or one for the whole album). An album is a titled, dated, ordered
 * grouping of an artist's uploaded tracks with an optional cover. It is not a
 * release unit: no page of its own, no embargo, no hype count — those are the
 * release-unit decisions deferred past alpha (DESIGN_SYNC row 333).
 *
 * Owner-gated like every other editor route: a profile the caller does not own
 * answers 404, not 403.
 */
const MAX_ALBUMS_PER_PROFILE = 50;

const releaseInput = z.string().refine(isReleaseInput, 'Invalid release date.');

const createSchema = z.object({
  profileId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  releasedOn: releaseInput.optional(),
});

async function ownedArtist(profileId: string, session: Session | null) {
  const profile = await withDbRetry(() =>
    db.profile.findUnique({ where: { id: profileId }, select: { id: true, ownerId: true, type: true } }),
  );
  if (!profile || profile.type !== 'ARTIST' || !canManageOwnedResource(session, profile.ownerId)) return null;
  return profile;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get('profileId')?.trim() ?? '';
  if (!profileId) return NextResponse.json({ error: 'profileId is required.' }, { status: 400 });
  if (!(await ownedArtist(profileId, session))) return NextResponse.json({ error: 'Artist profile not found.' }, { status: 404 });

  const albums = await withDbRetry(() =>
    db.album.findMany({
      where: { profileId },
      orderBy: [{ sortOrder: 'asc' }, { releasedOn: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, artworkUrl: true, releasedOn: true, sortOrder: true, _count: { select: { tracks: true } } },
    }),
  );
  return NextResponse.json({
    albums: albums.map((album) => ({
      id: album.id,
      title: album.title,
      artworkUrl: album.artworkUrl,
      releasedOn: album.releasedOn ? album.releasedOn.toISOString() : null,
      release: albumRelease(album.releasedOn) ? (album.releasedOn!.getTime() <= Date.now() ? 'live' : 'scheduled') : 'undated',
      sortOrder: album.sortOrder,
      trackCount: album._count.tracks,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid album.' }, { status: 400 });
    const { profileId, title, releasedOn } = parsed.data;
    if (!(await ownedArtist(profileId, session))) return NextResponse.json({ error: 'Artist profile not found.' }, { status: 404 });

    const count = await db.album.count({ where: { profileId } });
    if (count >= MAX_ALBUMS_PER_PROFILE) {
      return NextResponse.json({ error: `A profile can hold ${MAX_ALBUMS_PER_PROFILE} albums.` }, { status: 400 });
    }
    const album = await db.album.create({
      data: { profileId, title, releasedOn: releasedOn ? parseReleaseInput(releasedOn) : null, sortOrder: count },
      select: { id: true, title: true, artworkUrl: true, releasedOn: true, sortOrder: true },
    });
    return NextResponse.json(
      { album: { ...album, releasedOn: album.releasedOn ? album.releasedOn.toISOString() : null, trackCount: 0 } },
      { status: 201 },
    );
  } catch (error) {
    log.error('[api/albums]', error instanceof Error ? error : { error: String(error) }, 'create failed');
    return NextResponse.json({ error: 'Could not create the album.' }, { status: 500 });
  }
}
