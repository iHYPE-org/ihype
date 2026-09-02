import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { deleteMediaFile, isObjectStorageConfigured, isStoredMediaUrl, storeMediaFile } from '@/lib/object-storage';
import { vetImageUpload } from '@/lib/image-vetting';
import { areUploadsEnabledRuntime } from '@/lib/runtime-flags';
import { exceedsDeclaredRequestSize } from '@/lib/request-size';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function magicMatches(buf: Uint8Array, mime: string): boolean {
  if (buf.length < 12) return false;
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === 'image/gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  if (mime === 'image/webp') return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  return false;
}

/**
 * One cover for a whole album — the artist's alternative to a graphic per
 * track (owner, 2026-09-02: "a graphic per track or one for an entire album,
 * it's their choice"). Same three gates as track cover art: magic bytes, the
 * image vetting the profile graphics run, and the public `artist-media/`
 * prefix in object storage so `/cdn/*` will serve it. A track with its own
 * artwork keeps it; a track without one shows the album's.
 */
export async function POST(request: Request, { params }: { params: Promise<{ albumId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  if (!(await areUploadsEnabledRuntime())) {
    return NextResponse.json({ error: 'Media uploads are temporarily paused.' }, { status: 503, headers: { 'Retry-After': '900' } });
  }
  if (exceedsDeclaredRequestSize(request, MAX_BYTES + 64 * 1024)) {
    return NextResponse.json({ error: 'Cover art is limited to 8MB.' }, { status: 413 });
  }
  try {
    const { albumId } = await params;
    const album = await withDbRetry(() =>
      db.album.findUnique({ where: { id: albumId }, select: { id: true, profileId: true, profile: { select: { ownerId: true } } } }),
    );
    if (!album || !canManageOwnedResource(session, album.profile.ownerId)) {
      return NextResponse.json({ error: 'Album not found.' }, { status: 404 });
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Cover art must be JPEG, PNG, GIF, or WebP.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Cover art is limited to 8MB.' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!magicMatches(bytes, file.type)) return NextResponse.json({ error: 'File content does not match its image type.' }, { status: 400 });

    const vetting = await vetImageUpload(bytes, 'album cover art');
    if (!vetting.cleared) {
      await db.contentReport.create({
        data: { targetType: 'album-artwork', targetId: album.id, reason: 'auto_flag_image:album', details: vetting.reasoning, reporterUserId: session.user.id },
      }).catch(() => undefined);
      return NextResponse.json({ error: 'That image could not be cleared for a public page.' }, { status: 400 });
    }
    if (!isObjectStorageConfigured()) {
      return NextResponse.json({ error: 'Media storage is not configured.' }, { status: 501 });
    }
    const ext = file.type.split('/')[1] ?? 'bin';
    /* A VERSIONED key, not `<albumId>.<ext>`. `/cdn` serves every object with
       a year-long immutable cache on the promise that keys carry a unique
       part and objects are replaced rather than mutated; a deterministic key
       re-PUT on every replace broke that promise, so a changed cover stayed
       stale at the edge for a year. The previous object is deleted once the
       new one is stored, as the track-artwork route already does. */
    const key = `artist-media/${album.profileId}/albums/${album.id}-${Date.now().toString(36)}.${ext}`;
    const dataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`;
    const stored = await storeMediaFile(key, dataUrl, file.type);
    const previous = await db.album.findUnique({ where: { id: album.id }, select: { artworkUrl: true } });
    const updated = await db.album.update({ where: { id: album.id }, data: { artworkUrl: stored.url }, select: { id: true, artworkUrl: true } });
    if (previous?.artworkUrl && previous.artworkUrl !== stored.url && isStoredMediaUrl(previous.artworkUrl) && !previous.artworkUrl.startsWith('data:')) {
      await deleteMediaFile(new URL(previous.artworkUrl).pathname.replace(/^\/cdn\//, '')).catch(() => undefined);
    }
    return NextResponse.json({ album: updated });
  } catch (error) {
    log.error('[api/albums/artwork]', error instanceof Error ? error : { error: String(error) }, 'upload failed');
    return NextResponse.json({ error: 'Could not store the cover.' }, { status: 500 });
  }
}
