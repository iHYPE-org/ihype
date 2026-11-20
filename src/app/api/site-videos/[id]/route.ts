import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { readRuntimeBinding } from '@/lib/runtime-env';
import { isVideoUploadEnabled, MuxApiError, muxRequest } from '@/lib/mux-video';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

async function ownedVideo(session: Awaited<ReturnType<typeof auth>>, id: string) {
  const video = await withDbRetry(() => db.profileVideo.findUnique({
    where: { id },
    include: { profile: { select: { ownerId: true, type: true, verificationStatus: true } } },
  }));
  return video && canManageOwnedResource(session, video.profile.ownerId)
    && ['ARTIST', 'VENUE'].includes(video.profile.type) ? video : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  if (!isVideoUploadEnabled()) return NextResponse.json({ error: 'Video host not configured.' }, { status: 503 });
  let action: 'publish' | 'unpublish';
  try { action = z.object({ action: z.enum(['publish', 'unpublish']) }).strict().parse(await request.json()).action; }
  catch { return NextResponse.json({ error: 'Invalid video action.' }, { status: 400 }); }
  const { id } = await params;
  const video = await ownedVideo(session, id);
  if (!video) return NextResponse.json({ error: 'Video unavailable.' }, { status: 404 });
  const limiter = await consumeRateLimit(`mux-video-action:${session.user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limiter.allowed) return NextResponse.json({ error: 'Too many video changes.' }, { status: 429 });
  if (!video.muxAssetId || video.status !== 'READY') {
    return NextResponse.json({ error: 'Video is still processing or failed.' }, { status: 409 });
  }
  try {
    if (action === 'publish') {
      if (video.profile.verificationStatus !== 'VERIFIED') {
        return NextResponse.json({ error: 'Ownership verification must be approved to publish.' }, { status: 403 });
      }
      if (video.isPublished && video.muxPlaybackId) return NextResponse.json({ ok: true });
      const playback = await muxRequest<{ id: string }>(
        `/assets/${video.muxAssetId}/playback-ids`, 'POST', { policy: 'public' },
      );
      if (!playback.id) throw new Error('No Mux playback ID');
      const updated = await db.profileVideo.updateMany({
        where: { id: video.id, isPublished: false, muxPlaybackId: null, status: 'READY' },
        data: { muxPlaybackId: playback.id, isPublished: true },
      });
      // A concurrent publish won the race: revoke the redundant public ID.
      if (!updated.count) {
        await muxRequest(`/assets/${video.muxAssetId}/playback-ids/${playback.id}`, 'DELETE');
      }
    } else {
      if (video.muxPlaybackId) {
        // Never claim privacy while the old public playback ID still works.
        await muxRequest(`/assets/${video.muxAssetId}/playback-ids/${video.muxPlaybackId}`, 'DELETE');
      }
      await db.profileVideo.update({
        where: { id: video.id },
        data: { muxPlaybackId: null, isPublished: false },
      });
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Video provider could not complete the change. Try again.' }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  if (!isVideoUploadEnabled()) return NextResponse.json({ error: 'Video host not configured.' }, { status: 503 });
  const { id } = await params;
  const video = await ownedVideo(session, id);
  if (!video) return NextResponse.json({ error: 'Video unavailable.' }, { status: 404 });
  const limiter = await consumeRateLimit(`mux-video-delete:${session.user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limiter.allowed) return NextResponse.json({ error: 'Too many deletions.' }, { status: 429 });
  try {
    if (video.muxAssetId) {
      try { await muxRequest(`/assets/${video.muxAssetId}`, 'DELETE'); }
      catch (err) { if (!(err instanceof MuxApiError && err.status === 404)) throw err; }
    } else if (!video.muxUploadId.startsWith('pending_')) {
      // Reconcile stale status before deleting, so an asset that was created
      // while a webhook was late is not orphaned and billed indefinitely.
      const upload = await muxRequest<{ status: string; asset_id?: string }>(
        `/uploads/${video.muxUploadId}`, 'GET',
      );
      if (upload.asset_id) {
        await muxRequest(`/assets/${upload.asset_id}`, 'DELETE');
      } else if (upload.status === 'waiting') {
        await muxRequest(`/uploads/${video.muxUploadId}/cancel`, 'PUT');
      } else if (!['cancelled', 'errored', 'timed_out'].includes(upload.status)) {
        throw new Error('Video upload is still changing state.');
      }
    }
    // The R2 original is never public. Abort incomplete multipart copies.
    if (video.archiveKey) {
      const bucket = readRuntimeBinding('R2') as {
        delete?: (key: string) => Promise<unknown>;
        resumeMultipartUpload?: (key: string, id: string) => { abort: () => Promise<void> };
      } | null;
      if (video.archiveUploadId) {
        await bucket?.resumeMultipartUpload?.(video.archiveKey, video.archiveUploadId).abort();
      } else {
        await bucket?.delete?.(video.archiveKey);
      }
    }
    await db.profileVideo.delete({ where: { id: video.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not safely remove the video from hosting. Try again.' }, { status: 502 });
  }
}
