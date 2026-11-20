import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { verifyMuxWebhookSignature } from '@/lib/mux-video';

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
    await db.profileVideo.updateMany({
      where,
      data: {
        muxAssetId: data.id, status: 'READY',
        ...(typeof data.duration === 'number' && Number.isFinite(data.duration)
          ? { durationSecs: data.duration } : {}),
      },
    });
  } else if (event.type === 'video.asset.errored' && data.id) {
    await db.profileVideo.updateMany({
      where: { OR: [{ muxAssetId: data.id }, ...(data.upload_id ? [{ muxUploadId: data.upload_id }] : [])] },
      data: { status: 'ERROR', isPublished: false },
    });
  } else if (event.type === 'video.upload.errored' && data.id) {
    await db.profileVideo.updateMany({
      where: { muxUploadId: data.id },
      data: { status: 'ERROR', isPublished: false },
    });
  } else if (event.type === 'video.asset.deleted' && data.id) {
    await db.profileVideo.updateMany({
      where: { muxAssetId: data.id },
      data: { status: 'DELETED', isPublished: false, muxPlaybackId: null },
    });
  }
  return NextResponse.json({ received: true });
}
