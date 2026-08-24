import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

const createPlaylistSchema = z.object({
  name: z.string().trim().min(1).max(60)
});

/* Playlists are a listener act, not a role feature — the same account-wide
   rule the likes system follows (owner, 2026-08-24: likes are "stored to
   user's account"; the full player's add-to-playlist is offered to every
   signed-in account, and a FAN/ADMIN gate here would make it silently 403
   for artists and venues). Kept as a function so a future narrowing has a
   seam to land in. */
function canUseFanPlaylists(_role: string | null | undefined) {
  return true;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Fan playlists are only available to fan accounts' }, { status: 403 });
  }

  const [playlists, favorites, savedSeedRows] = await Promise.all([
    db.fanPlaylist.findMany({
      where: { userId: session.user.id },
      include: {
        items: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        }
      },
      orderBy: [{ createdAt: 'asc' }]
    }),
    db.fanFavoriteMedia.findMany({
      where: { userId: session.user.id },
      orderBy: [{ createdAt: 'desc' }]
    }),
    db.seed.findMany({
      where: { userId: session.user.id, action: 'save' },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, mediaId: true }
    })
  ]);

  const mediaIds = savedSeedRows.map((s) => s.mediaId);
  const media = mediaIds.length
    ? await db.artistMediaAsset.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, title: true, profile: { select: { name: true, slug: true, type: true } } }
      })
    : [];
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const savedSeeds = savedSeedRows
    .map((seed) => {
      const asset = mediaById.get(seed.mediaId);
      if (!asset || !asset.profile) return null;
      return {
        id: seed.id,
        mediaId: seed.mediaId,
        title: asset.title,
        artistName: asset.profile.name,
        artistProfileSlug: asset.profile.slug,
        artistProfileType: asset.profile.type
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return NextResponse.json({ playlists, favorites, savedSeeds });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Fan playlists are only available to fan accounts' }, { status: 403 });
  }

  try {
    const body = createPlaylistSchema.parse(await request.json());
    const playlist = await db.fanPlaylist.create({
      data: {
        userId: session.user.id,
        name: body.name
      },
      include: {
        items: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        }
      }
    });

    return NextResponse.json(playlist, { status: 201 });
  } catch (err) {
    log.error('[fan-playlists]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Invalid playlist payload' }, { status: 400 });
  }
}
