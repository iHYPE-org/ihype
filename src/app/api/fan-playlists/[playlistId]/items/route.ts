import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const addItemSchema = z.object({
  mediaId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  artistName: z.string().trim().min(1).max(160),
  url: z.string().trim().url().max(2000).refine((u) => !u.startsWith('javascript:'), 'Invalid URL'),
  artistProfileSlug: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(240).optional().nullable(),
  artworkUrl: z.string().trim().url().max(2000).refine((u) => !u.startsWith('javascript:'), 'Invalid URL').optional().nullable()
});

const reorderSchema = z.object({
  itemIds: z.array(z.string().cuid()).min(1)
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

async function getOwnedPlaylist(playlistId: string, userId: string) {
  return db.fanPlaylist.findFirst({
    where: {
      id: playlistId,
      userId
    },
    include: {
      items: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }
    }
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Fan playlists are only available to fan accounts' }, { status: 403 });
  }

  const { playlistId } = await params;
  const playlist = await getOwnedPlaylist(playlistId, session.user.id);

  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  try {
    const body = addItemSchema.parse(await request.json());
    const existingItem = playlist.items.find((item) => item.mediaId === body.mediaId);

    if (existingItem) {
      return NextResponse.json({ error: 'That media is already in this playlist' }, { status: 409 });
    }

    const item = await db.fanPlaylistItem.create({
      data: {
        playlistId,
        mediaId: body.mediaId,
        title: body.title,
        artistName: body.artistName,
        url: body.url,
        artistProfileSlug: body.artistProfileSlug ?? null,
        notes: body.notes ?? null,
        artworkUrl: body.artworkUrl ?? null,
        position: playlist.items.length
      }
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid playlist item payload' }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Fan playlists are only available to fan accounts' }, { status: 403 });
  }

  const { playlistId } = await params;
  const playlist = await getOwnedPlaylist(playlistId, session.user.id);

  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  try {
    const body = reorderSchema.parse(await request.json());
    if (body.itemIds.length !== playlist.items.length) {
      return NextResponse.json({ error: 'Playlist reorder payload is incomplete' }, { status: 400 });
    }

    const validIds = new Set(playlist.items.map((item) => item.id));
    const hasForeignItem = body.itemIds.some((itemId) => !validIds.has(itemId));

    if (hasForeignItem) {
      return NextResponse.json({ error: 'Playlist reorder payload is invalid' }, { status: 400 });
    }

    await db.$transaction(
      body.itemIds.map((itemId, index) =>
        db.fanPlaylistItem.update({
          where: { id: itemId },
          data: { position: index }
        })
      )
    );

    const items = await db.fanPlaylistItem.findMany({
      where: { playlistId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: 'Invalid reorder payload' }, { status: 400 });
  }
}
