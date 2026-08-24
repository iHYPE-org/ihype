import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/* Playlists are a listener act, not a role feature — the same account-wide
   rule the likes system follows (owner, 2026-08-24: likes are "stored to
   user's account"; the full player's add-to-playlist is offered to every
   signed-in account, and a FAN/ADMIN gate here would make it silently 403
   for artists and venues). Kept as a function so a future narrowing has a
   seam to land in. */
function canUseFanPlaylists(_role: string | null | undefined) {
  return true;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string; itemId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!canUseFanPlaylists(session.user.role)) {
    return NextResponse.json({ error: 'Fan playlists are only available to fan accounts' }, { status: 403 });
  }

  const { playlistId, itemId } = await params;
  const playlist = await db.fanPlaylist.findFirst({
    where: {
      id: playlistId,
      userId: session.user.id
    },
    include: {
      items: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }
    }
  });

  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  const item = playlist.items.find((entry) => entry.id === itemId);
  if (!item) {
    return NextResponse.json({ error: 'Playlist item not found' }, { status: 404 });
  }

  await db.$transaction([
    db.fanPlaylistItem.delete({
      where: { id: itemId }
    }),
    ...playlist.items
      .filter((entry) => entry.position > item.position)
      .map((entry) =>
        db.fanPlaylistItem.update({
          where: { id: entry.id },
          data: { position: entry.position - 1 }
        })
      )
  ]);

  return NextResponse.json({ ok: true });
}
