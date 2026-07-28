import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { notifyUser } from '@/lib/notify';
import { cancelTicketPaymentIntent, refundTicketPaymentIntent } from '@/lib/stripe';
import { refundCapturedTicketOrder, voidReservedTicketOrder } from '@/lib/ticket-order-state';

export const dynamic = 'force-dynamic';

const REASONS = ['artist', 'venue', 'low-sales', 'other'] as const;

/**
 * The optional organizer note is capped and normalised rather than stored
 * verbatim. It is the only free text on this route that reaches other
 * people's inboxes and lock screens, and the author is an organizer, not a
 * moderator: 400 chars fits the "what happened / what's next" note the
 * design asks for, control characters and long runs of whitespace are
 * stripped so a note can't reflow or spoof the surrounding notification
 * copy, and it is always rendered as plain text (never HTML, never
 * auto-linkified) so it cannot smuggle a "claim your refund here" link into
 * a message fans already expect to be about money.
 */
const MAX_MESSAGE_LENGTH = 400;

const schema = z.object({
  reason: z.enum(REASONS),
  message: z.string().max(MAX_MESSAGE_LENGTH * 2).optional(),
});

function normalizeMessage(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

const REASON_LABEL: Record<(typeof REASONS)[number], string> = {
  artist: 'Artist can no longer perform',
  venue: 'Venue issue / closure',
  'low-sales': 'Low ticket sales',
  other: 'Other',
};

/**
 * Organizer-initiated event cancellation (Event Cancellation Flow,
 * DESIGN_SYNC row 227) — distinct from the admin-moderation cancel path
 * (src/app/api/admin/moderation/[id]/route.ts), which is for content
 * violations, not an organizer choosing to call off their own show.
 *
 * Refunds every CAPTURED order in full (Stripe first, DB only after Stripe
 * confirms — same source-of-truth ordering as the self-serve per-ticket
 * refund route) and cancels every still-RESERVED (authorized but never
 * charged) order. Runs order-by-order rather than one giant transaction —
 * Stripe calls are network round-trips that can't live inside a DB
 * transaction, and one failed refund must never block the other hundreds.
 * Orders with an already-scanned ticket are left untouched (that fan
 * already attended; refunding them would be wrong) and reported as skipped,
 * not silently dropped.
 */
export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const { showId } = await params;
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'A cancellation reason is required.' }, { status: 400 });
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      id: true, slug: true, title: true, status: true, creatorId: true,
      venueProfile: { select: { ownerId: true } },
      headlinerProfile: { select: { ownerId: true } },
    },
  });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

  const isOrganizer =
    canManageOwnedResource(session, show.venueProfile?.ownerId) ||
    canManageOwnedResource(session, show.headlinerProfile?.ownerId) ||
    session.user.id === show.creatorId;
  if (!isOrganizer) return NextResponse.json({ error: 'Only the show\'s organizer can cancel it.' }, { status: 403 });

  if (!['DRAFT', 'SCHEDULED'].includes(show.status)) {
    return NextResponse.json({ error: `This show can't be cancelled from its current status (${show.status}).` }, { status: 400 });
  }

  const orders = await db.ticketOrder.findMany({
    where: { showId, status: { in: ['CAPTURED', 'RESERVED'] } },
    include: { tickets: { select: { status: true } } },
  });

  const organizerMessage = normalizeMessage(body.message);

  let refunded = 0;
  let skippedScanned = 0;
  let failed = 0;

  for (const order of orders) {
    if (order.tickets.some((t) => t.status === 'SCANNED')) {
      skippedScanned += 1;
      continue;
    }
    try {
      if (order.status === 'CAPTURED') {
        if (!order.stripePaymentIntentId) { failed += 1; continue; }
        const refundId = await refundTicketPaymentIntent(order.stripePaymentIntentId);
        await db.$transaction(async (tx) => {
          const ok = await refundCapturedTicketOrder(tx, order.id);
          if (!ok) throw new Error('Order changed state before the refund could be recorded.');
          await tx.ticketOrder.update({ where: { id: order.id }, data: { refundedAt: new Date(), stripeRefundId: refundId } });
        });
      } else {
        if (order.stripePaymentIntentId) await cancelTicketPaymentIntent(order.stripePaymentIntentId);
        const ok = await db.$transaction((tx) => voidReservedTicketOrder(tx, order.id));
        if (!ok) { failed += 1; continue; }
      }
      refunded += 1;
      if (order.buyerUserId) {
        await notifyUser(order.buyerUserId, {
          type: 'show_canceled_refunded',
          title: `"${show.title}" was cancelled`,
          // The platform's own sentence stays first and unconditional, so the
          // refund fact is never displaced by whatever the organizer wrote —
          // and the organizer's words are attributed, not blended into it.
          body: organizerMessage
            ? `The organizer cancelled this event — your order has been refunded in full. From the organizer: “${organizerMessage}”`
            : 'The organizer cancelled this event — your order has been refunded in full.',
          link: '/tickets',
        });
      }
    } catch (error) {
      console.error('[shows/cancel] refund failed for order', order.id, error);
      failed += 1;
    }
  }

  await db.show.update({
    where: { id: showId },
    data: {
      status: 'CANCELED',
      cancellationReason: REASON_LABEL[body.reason as (typeof REASONS)[number]],
      cancellationMessage: organizerMessage,
      canceledAt: new Date(),
    },
  });

  return NextResponse.json({
    canceled: true,
    ordersRefunded: refunded,
    ordersSkippedAlreadyScanned: skippedScanned,
    ordersFailed: failed,
    // Echoed back so the confirmation screen shows the stored, normalised
    // text — what ticket holders actually received — rather than the raw
    // textarea contents the browser still has in state.
    message: organizerMessage,
  });
}
