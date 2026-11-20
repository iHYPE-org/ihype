import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { isWithinPilotVideoDuration, MAX_VIDEO_DURATION_SECS, MuxApiError, muxRequest, verifyMuxWebhookSignature } from '@/lib/mux-video';

export const dynamic = 'force-dynamic';

// Mux retries failed deliveries; repeat events are harmless because updates
// only set a known state. Always verify the signature against the raw bytes.
type MuxWebhook = {
  type?: string;
  data?: {
    id?: string; asset_id?: string; upload_id?: string;
    duration?: number; meta?: { external_id?: string };
  };
};

/**
 * Mux can report a processing failure after a video's public playback ID was
 * issued. Hide it first, then revoke the external ID. On provider failure the
 * signed webhook returns 500 for retry and the identifier remains in Prisma
 * so the owner can retry unpublishing rather than losing the cleanup handle.
 */
async function markVideoProviderError(where: {
  OR?: Array<{ muxAssetId?: string; muxUploadId?: string }>;
  muxUploadId?: string;
}) {
  await db.profileVideo.updateMany({
    where: { ...where, status: { notIn: ['DELETED', 'TOO_LONG'] } },
    data: { status: 'ERROR', isPublished: false },
  });
  const affected = await db.profileVideo.findMany({
    where: { ...where, status: 'ERROR', muxPlaybackId: { not: null } },
    select: { id: true, muxAssetId: true, muxPlaybackId: true },
    take: 25,
  });
  for (const video of affected) {
    if (!video.muxAssetId || !video.muxPlaybackId) continue;
    try {
      await muxRequest(`/assets/${video.muxAssetId}/playback-ids/${video.muxPlaybackId}`, 'DELETE');
    } catch (error) {
      if (!(error instanceof MuxApiError && error.status === 404)) throw error;
    }
    await db.profileVideo.updateMany({
      where: { id: video.id, muxPlaybackId: video.muxPlaybackId },
      data: { muxPlaybackId: null },
    });
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 100_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  if (!await verifyMuxWebhookSignature(
    body, request.headers.get('mux-signature'), readRuntimeEnv('MUX_WEBHOOK_SECRET'),
  )) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }
  let event: MuxWebhook;
  try { event = JSON.parse(body) as MuxWebhook; }
  catch { return NextResponse.json({ error: 'Malformed webhook.' }, { status: 400 }); }
  const data = event.data ?? {};
  if (event.type === 'video.upload.asset_created' && data.id && data.asset_id) {
    await db.profileVideo.updateMany({
      where: { muxUploadId: data.id, status: 'WAITING' },
      data: { muxAssetId: data.asset_id, status: 'PROCESSING' },
    });
  } else if (event.type === 'video.asset.created' && data.id) {
    // The asset metadata is set by our backend, not a browser-supplied id.
    const where = data.meta?.external_id
      ? { id: data.meta.external_id, muxUploadId: data.upload_id ?? undefined }
      : data.upload_id ? { muxUploadId: data.upload_id } : null;
    if (where) await db.profileVideo.updateMany({
      where: { ...where, status: 'WAITING' },
      data: { muxAssetId: data.id, status: 'PROCESSING' },
    });
  } else if (event.type === 'video.asset.ready' && data.id) {
    const where = data.meta?.external_id
      ? { id: data.meta.external_id }
      : data.upload_id ? { muxUploadId: data.upload_id } : { muxAssetId: data.id };
    const video = await db.profileVideo.findFirst({
      where,
      select: { id: true, status: true, muxAssetId: true },
    });
    // A signed event may belong to another asset in the same Mux account.
    if (!video) return NextResponse.json({ received: true });

    if (!isWithinPilotVideoDuration(data.duration)) {
      if (typeof data.duration === 'number' && Number.isFinite(data.duration)
          && data.duration > MAX_VIDEO_DURATION_SECS) {
        // Mux bills by minutes, not file bytes. An overlong asset cannot be
        // made public and is removed from Mux before more storage fees accrue.
        await db.profileVideo.updateMany({
          where: { id: video.id, status: { not: 'DELETED' } },
          data: {
            muxAssetId: data.id, durationSecs: data.duration,
            status: 'TOO_LONG', isPublished: false, muxPlaybackId: null,
          },
        });
        try { await muxRequest(`/assets/${data.id}`, 'DELETE'); }
        catch (error) {
          if (!(error instanceof MuxApiError && error.status === 404)) throw error;
        }
      }
      // If Mux doesn't supply a trustworthy duration, keep it processing.
      // No route permits publishing an asset before it passes this guard.
      return NextResponse.json({ received: true });
    }

    await db.profileVideo.updateMany({
      where: {
        id: video.id,
        status: { in: ['WAITING', 'PROCESSING'] },
        OR: [{ muxAssetId: null }, { muxAssetId: data.id }],
      },
      data: { muxAssetId: data.id, status: 'READY', durationSecs: data.duration },
    });
  } else if (event.type === 'video.asset.errored' && data.id) {
    await markVideoProviderError({
      OR: [{ muxAssetId: data.id }, ...(data.upload_id ? [{ muxUploadId: data.upload_id }] : [])],
    });
  } else if (event.type === 'video.upload.errored' && data.id) {
    await markVideoProviderError({ muxUploadId: data.id });
  } else if (event.type === 'video.asset.deleted' && data.id) {
    await db.profileVideo.updateMany({
      where: { muxAssetId: data.id, status: { not: 'TOO_LONG' } },
      data: { status: 'DELETED', isPublished: false, muxPlaybackId: null },
    });
  }
  return NextResponse.json({ received: true });
}
