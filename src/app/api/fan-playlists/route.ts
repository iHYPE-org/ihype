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

/* The player sheet's playlist manager also shows the member's favourites, and
   asks for them with `?include=favorites`. The Playlists tab and the full
   player read `playlists` only, and the tab reads favourites from
   /api/fan-favorites in the same render, so this read ran twice there
   (2026-09-24, DESIGN_SYNC row 513). */
export async function GET(request: Request) {
  const includeFavorites = new URL(request.url).searchParams.get('include') === 'favorites';
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Fan playlists are only available to fan accounts' }, { status: 403 });
  }

  /* `savedSeeds` is gone (row 513): it was two more queries per call, built
     for a client that no longer exists, and read by nothing. */
  const [playlists, favorites] = await Promise.all([
    db.fanPlaylist.findMany({
      where: { userId: session.user.id },
      include: {
        items: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        }
      },
      orderBy: [{ createdAt: 'asc' }]
    }),
    includeFavorites
      ? db.fanFavoriteMedia.findMany({
          where: { userId: session.user.id },
          orderBy: [{ createdAt: 'desc' }]
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json(favorites ? { playlists, favorites } : { playlists });
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
