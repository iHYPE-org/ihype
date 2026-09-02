import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { deleteMediaFile, isStoredMediaUrl } from '@/lib/object-storage';
import { log } from '@/lib/logger';
import { albumRelease, isReleaseInput, parseReleaseInput } from '@/lib/release-schedule';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  /** A date or ISO instant to (re)schedule, `'now'` to launch immediately, or null to clear the date. */
  releasedOn: z.union([z.literal('now'), z.string().refine(isReleaseInput, 'Invalid release date.')]).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  /** Only `null` is accepted: remove the cover. A new one comes through /artwork. */
  artworkUrl: z.null().optional(),
});

async function ownedAlbum(albumId: string, session: Session | null) {
  const album = await withDbRetry(() =>
    db.album.findUnique({
      where: { id: albumId },
      select: { id: true, profileId: true, artworkUrl: true, profile: { select: { ownerId: true } } },
    }),
  );
  if (!album || !canManageOwnedResource(session, album.profile.ownerId)) return null;
  return album;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ albumId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  try {
    const { albumId } = await params;
    const existing = await ownedAlbum(albumId, session);
    if (!existing) return NextResponse.json({ error: 'Album not found.' }, { status: 404 });
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid change.' }, { status: 400 });
    const { title, releasedOn, sortOrder, artworkUrl } = parsed.data;
    const now = new Date();
    const releaseDate = releasedOn === undefined ? undefined : releasedOn === null ? null : releasedOn === 'now' ? now : parseReleaseInput(releasedOn);
    const album = await db.album.update({
      where: { id: albumId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(releaseDate !== undefined ? { releasedOn: releaseDate } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(artworkUrl === null ? { artworkUrl: null } : {}),
      },
      select: { id: true, title: true, artworkUrl: true, releasedOn: true, sortOrder: true, _count: { select: { tracks: true } } },
    });
    /* The album's date IS its tracks' release moment. A future date schedules
       every track in the folder; "now" or a past date releases them. A HELD
       track (unpublished with no date — the scan or a moderator withheld it)
       is skipped: an artist cannot lift a hold by dating the album. */
    const cascade = releaseDate === undefined ? null : albumRelease(releaseDate, now);
    if (cascade) {
      await db.artistMediaAsset.updateMany({
        where: { albumId, NOT: { isPublished: false, publishAt: null } },
        data: cascade,
      }).catch(() => null);
    }
    if (artworkUrl === null && existing.artworkUrl && isStoredMediaUrl(existing.artworkUrl)) {
      await deleteMediaFile(new URL(existing.artworkUrl).pathname.replace(/^\/cdn\//, '')).catch(() => undefined);
    }
    return NextResponse.json({
      album: { id: album.id, title: album.title, artworkUrl: album.artworkUrl, releasedOn: album.releasedOn ? album.releasedOn.toISOString() : null, sortOrder: album.sortOrder, trackCount: album._count.tracks },
    });
  } catch (error) {
    log.error('[api/albums/[albumId]]', error instanceof Error ? error : { error: String(error) }, 'patch failed');
    return NextResponse.json({ error: 'Could not update the album.' }, { status: 500 });
  }
}

/**
 * Deleting an album is deleting the FOLDER: its tracks stay published as
 * singles (`ArtistMediaAsset.albumId` is `onDelete: SetNull`). The cover, if
 * it lives in object storage, goes with the folder.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ albumId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  try {
    const { albumId } = await params;
    const album = await ownedAlbum(albumId, session);
    if (!album) return NextResponse.json({ error: 'Album not found.' }, { status: 404 });
    await db.album.delete({ where: { id: albumId } });
    if (album.artworkUrl && isStoredMediaUrl(album.artworkUrl)) {
      const key = new URL(album.artworkUrl).pathname.replace(/^\/cdn\//, '');
      await deleteMediaFile(key).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error('[api/albums/[albumId]]', error instanceof Error ? error : { error: String(error) }, 'delete failed');
    return NextResponse.json({ error: 'Could not delete the album.' }, { status: 500 });
  }
}
