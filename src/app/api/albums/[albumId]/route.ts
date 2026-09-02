import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { deleteMediaFile, isTrustedStorageUrl } from '@/lib/object-storage';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  /** YYYY-MM-DD, or null to clear. */
  releasedOn: z.string().date().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
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
    if (!(await ownedAlbum(albumId, session))) return NextResponse.json({ error: 'Album not found.' }, { status: 404 });
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid change.' }, { status: 400 });
    const { title, releasedOn, sortOrder } = parsed.data;
    const album = await db.album.update({
      where: { id: albumId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(releasedOn !== undefined ? { releasedOn: releasedOn ? new Date(`${releasedOn}T00:00:00.000Z`) : null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
      select: { id: true, title: true, artworkUrl: true, releasedOn: true, sortOrder: true, _count: { select: { tracks: true } } },
    });
    return NextResponse.json({
      album: { id: album.id, title: album.title, artworkUrl: album.artworkUrl, releasedOn: album.releasedOn ? album.releasedOn.toISOString().slice(0, 10) : null, sortOrder: album.sortOrder, trackCount: album._count.tracks },
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
    if (album.artworkUrl && isTrustedStorageUrl(album.artworkUrl)) {
      const key = new URL(album.artworkUrl).pathname.replace(/^\/cdn\//, '');
      await deleteMediaFile(key).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error('[api/albums/[albumId]]', error instanceof Error ? error : { error: String(error) }, 'delete failed');
    return NextResponse.json({ error: 'Could not delete the album.' }, { status: 500 });
  }
}
