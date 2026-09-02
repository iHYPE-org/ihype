import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { deleteMediaFile, isObjectStorageConfigured, isTrustedStorageUrl, storeMediaFile } from '@/lib/object-storage';
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
 * Add or replace one track's cover after upload (owner, 2026-09-02: artists
 * can change graphics). Same gates as the cover sent WITH an upload — magic
 * bytes, image vetting, the public `artist-media/` prefix — and the previous
 * stored cover is removed once the new one is in place. Removing a cover
 * without replacing it is `PATCH /api/artist-media/[hexId]` with
 * `{ artworkUrl: null }`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ hexId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  if (!(await areUploadsEnabledRuntime())) {
    return NextResponse.json({ error: 'Media uploads are temporarily paused.' }, { status: 503, headers: { 'Retry-After': '900' } });
  }
  if (exceedsDeclaredRequestSize(request, MAX_BYTES + 64 * 1024)) {
    return NextResponse.json({ error: 'Cover art is limited to 8MB.' }, { status: 413 });
  }
  try {
    const { hexId } = await params;
    const asset = await withDbRetry(() =>
      db.artistMediaAsset.findUnique({ where: { hexId }, select: { id: true, profileId: true, artworkUrl: true, profile: { select: { ownerId: true } } } }),
    );
    if (!asset || !canManageOwnedResource(session, asset.profile.ownerId)) {
      return NextResponse.json({ error: 'Track not found.' }, { status: 404 });
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Cover art must be JPEG, PNG, GIF, or WebP.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Cover art is limited to 8MB.' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!magicMatches(bytes, file.type)) return NextResponse.json({ error: 'File content does not match its image type.' }, { status: 400 });

    const vetting = await vetImageUpload(bytes, 'track cover art');
    if (!vetting.cleared) {
      await db.contentReport.create({
        data: { targetType: 'track-artwork', targetId: hexId, reason: 'auto_flag_image:track', details: vetting.reasoning, reporterUserId: session.user.id },
      }).catch(() => undefined);
      return NextResponse.json({ error: 'That image could not be cleared for a public page.' }, { status: 400 });
    }
    if (!isObjectStorageConfigured()) return NextResponse.json({ error: 'Media storage is not configured.' }, { status: 501 });

    const ext = file.type.split('/')[1] ?? 'bin';
    const key = `artist-media/${asset.profileId}/artwork/${hexId}-${Date.now().toString(36)}.${ext}`;
    const stored = await storeMediaFile(key, `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`, file.type);
    const updated = await db.artistMediaAsset.update({ where: { id: asset.id }, data: { artworkUrl: stored.url }, select: { hexId: true, artworkUrl: true } });
    if (asset.artworkUrl && asset.artworkUrl !== stored.url && isTrustedStorageUrl(asset.artworkUrl)) {
      await deleteMediaFile(new URL(asset.artworkUrl).pathname.replace(/^\/cdn\//, '')).catch(() => undefined);
    }
    return NextResponse.json({ track: updated });
  } catch (error) {
    log.error('[api/artist-media/artwork]', error instanceof Error ? error : { error: String(error) }, 'upload failed');
    return NextResponse.json({ error: 'Could not store the cover.' }, { status: 500 });
  }
}
