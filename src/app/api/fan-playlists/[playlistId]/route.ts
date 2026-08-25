import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * `PATCH` / `DELETE /api/fan-playlists/[playlistId]` — rename or remove a
 * playlist the caller owns.
 *
 * Why this file did not exist until now: the collection route could create a
 * playlist and the `items/` routes could add, reorder and remove tracks, so a
 * member could build a playlist and fill it and never get rid of it or fix its
 * name. Reported as "Playlists needs ... the ability to edit and delete"
 * (2026-08-25); the UI had nothing to call.
 *
 * Ownership is enforced in the WHERE of the write itself, not by a read
 * followed by a write — the same rule the ad-impression and ticket-scan routes
 * follow. A findFirst-then-update pair is a race and, worse, it makes the
 * ownership check a separate statement that a later edit can drift away from.
 * `updateMany`/`deleteMany` scoped to `{ id, userId }` cannot touch another
 * account's row even if the id is guessed, and a count of 0 is the 404.
 */

const renameSchema = z.object({
  /* Same bound as the collection route's create. Trimmed, and non-empty after
     trimming: a playlist called " " is unaddressable in a list. */
  name: z.string().trim().min(1).max(120),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { playlistId } = await params;

  let name: string;
  try {
    ({ name } = renameSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: 'A playlist needs a name of 1–120 characters' }, { status: 400 });
  }

  const result = await db.fanPlaylist.updateMany({
    where: { id: playlistId, userId: session.user.id },
    data: { name },
  });

  /* Not found and not yours are the SAME answer on purpose: a distinct 403
     would confirm that a playlist id exists, which is a membership oracle over
     ids a caller can otherwise only guess. */
  if (result.count === 0) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  return NextResponse.json({ id: playlistId, name });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { playlistId } = await params;

  /* The items need no statement of their own: `FanPlaylistItem.playlist`
     declares `onDelete: Cascade`, so the database removes them with the parent.
     An explicit transaction deleting items first was written here and then
     removed — it was redundant against the schema, and worse, the comment
     justifying it claimed the rows would otherwise be orphaned, which the
     schema says is not true. Check the relation before adding one back. */
  const removed = (await db.fanPlaylist.deleteMany({
    where: { id: playlistId, userId: session.user.id },
  })).count;

  if (removed === 0) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: playlistId });
}
