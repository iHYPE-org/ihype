import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

const createPlaylistSchema = z.object({
  name: z.string().trim().min(1).max(60)
});

function canUseFanPlaylists(role: string | null | undefined) {
  return role === 'FAN' || role === 'ADMIN';
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
