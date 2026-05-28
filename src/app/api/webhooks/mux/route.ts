import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * Verify a Mux webhook signature.
 *
 * Mux signs requests with HMAC-SHA256. The signature is sent in the
 * `mux-signature` header as `t=<timestamp>,v1=<hex_sig>`.
 *
 * Ref: https://docs.mux.com/guides/webhooks#verify-webhook-signatures
 */
function verifyMuxSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceMs = 300_000 // 5 min
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(part => {
      const [k, ...rest] = part.split('=');
      return [k, rest.join('=')];
    })
  );

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Reject stale webhooks
  const age = Date.now() - Number(timestamp) * 1000;
  if (age > toleranceMs || age < -toleranceMs) return false;

  const toSign = `${timestamp}.${payload}`;
  const expected = createHmac('sha256', secret).update(toSign, 'utf8').digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/mux
 *
 * Receives Mux video/live-stream lifecycle events and updates show
 * isLive status accordingly. Idempotent via processedWebhookEvent table.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    // If Mux isn't configured, ignore silently (dev/test environments)
    return NextResponse.json({ received: true, skipped: 'not_configured' });
  }

  const signatureHeader = request.headers.get('mux-signature') ?? '';
  if (!signatureHeader) {
    return NextResponse.json({ error: 'Missing mux-signature header.' }, { status: 400 });
  }

  const payload = await request.text();

  if (!verifyMuxSignature(payload, signatureHeader, secret)) {
    log.warn('[mux/webhook]', null, 'Invalid signature — rejected');
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let event: {
    type: string;
    id: string;
    data: {
      id?: string;         // live stream ID
      status?: string;     // active | idle | disabled
      playback_ids?: Array<{ id: string; policy: string }>;
    };
  };

  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // Drop duplicate deliveries
  try {
    await db.processedWebhookEvent.create({
      data: { source: 'mux', eventId: event.id },
    });
  } catch {
    // Unique constraint violation = already processed
    return NextResponse.json({ received: true, duplicate: true });
  }

  const liveStreamId = event.data?.id;

  switch (event.type) {
    /**
     * A live stream went active — mark the associated show as live.
     *
     * TODO: Add `muxLiveStreamId String?` and `isLive Boolean @default(false)` to
     *       the Show model in prisma/schema.prisma, then uncomment the updateMany below.
     */
    case 'video.live_stream.active': {
      log.info('[mux/webhook]', { liveStreamId, type: event.type }, 'Live stream active');
      if (liveStreamId) {
        await recordAuditEvent({
          action: 'mux_stream_active',
          entityType: 'show',
          metadata: { muxLiveStreamId: liveStreamId },
        });
        // TODO: await db.show.updateMany({
        //   where: { muxLiveStreamId: liveStreamId },
        //   data: { isLive: true },
        // });
      }
      break;
    }

    /**
     * A live stream became idle (broadcast ended) — mark show as not live.
     */
    case 'video.live_stream.idle': {
      log.info('[mux/webhook]', { liveStreamId, type: event.type }, 'Live stream idle');
      if (liveStreamId) {
        await recordAuditEvent({
          action: 'mux_stream_idle',
          entityType: 'show',
          metadata: { muxLiveStreamId: liveStreamId },
        });
        // TODO: await db.show.updateMany({
        //   where: { muxLiveStreamId: liveStreamId },
        //   data: { isLive: false },
        // });
      }
      break;
    }

    /**
     * A live stream was disabled/deleted.
     */
    case 'video.live_stream.disabled':
    case 'video.live_stream.deleted': {
      log.info('[mux/webhook]', { liveStreamId, type: event.type }, 'Live stream disabled/deleted');
      if (liveStreamId) {
        // TODO: await db.show.updateMany({
        //   where: { muxLiveStreamId: liveStreamId },
        //   data: { isLive: false },
        // });
      }
      break;
    }

    default:
      log.info('[mux/webhook]', { type: event.type }, 'Unhandled event type — acknowledged');
      break;
  }

  return NextResponse.json({ received: true });
}
