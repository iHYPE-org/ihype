import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { notifyUser } from '@/lib/notify';
import { cancelTicketPaymentIntent, refundTicketPaymentIntent } from '@/lib/stripe';
import { refundCapturedTicketOrder, voidReservedTicketOrder } from '@/lib/ticket-order-state';
import { log } from '@/lib/logger';
import { getAdminAlertRecipients } from '@/lib/env';
import { sendOperationalEmail } from '@/lib/mailer';

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
 * ## The one refund iHYPE still issues, and why it is not a policy exception
 *
 * Buyer-initiated refunds are gone: sales are final, and only a venue can
 * choose to refund, directly with the buyer. This path stays because it is not
 * a refund policy — it is the platform returning money it is holding.
 *
 * Payments use separate charges and transfers: a ticket captures to iHYPE's own
 * Stripe balance, and the 70/20/10 transfers only run for shows that ENDED. A
 * cancelled show never ends, so it never pays out, and the buyer's money would
 * otherwise sit on the platform's balance forever. A nonprofit that takes $0
 * cannot keep the gate for a show that did not happen.
 *
 * If refunds should instead come from the venue here too, the money has to stop
 * flowing through iHYPE first — direct charges to the venue's Connect account
 * rather than separate charges and transfers. That is a payment-architecture
 * change, not a copy change.
 *
 * Refunds every CAPTURED order and cancels every still-RESERVED (authorized but never
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
        /**
         * Same rule as a buyer-initiated refund: face value and taxes come
         * back, Stripe's fee does not, because Stripe keeps it and iHYPE
         * absorbs no fee of any kind.
         *
         * This is the harshest place that rule lands, and it is applied here
         * deliberately rather than by omission: the fan did nothing wrong — the
         * organiser cancelled — and they are still out the processing fee.
         * Refunding it instead would mean the platform paying Stripe on behalf
         * of a venue that cancelled, which the nonprofit charter does not allow
         * either. If the policy should differ for organiser cancellations, this
         * is the one line to change.
         */
        const refundableCents = order.totalChargeCents - order.processingFeeCents;
        /* On a destination charge the act's share is not in the platform
           balance to refund from — Stripe routed it with the charge. Without
           the reversal flag the default is that they KEEP it and the platform
           returns the fan's whole payment out of the application fee it
           received, so every refund would lose roughly the artist's share.
           `settlementAccountId` is stored on the order precisely so this does
           not have to ask Stripe what kind of charge it was. */
        const refundId = await refundTicketPaymentIntent(
          order.stripePaymentIntentId,
          refundableCents,
          { settlementMode: order.settlementMode, settlementAccountId: order.settlementAccountId },
        );
        await db.$transaction(async (tx) => {
          const ok = await refundCapturedTicketOrder(tx, order.id);
          if (!ok) throw new Error('Order changed state before the refund could be recorded.');
          await tx.ticketOrder.update({ where: { id: order.id }, data: { refundedAt: new Date(), stripeRefundId: refundId } });
        });
      } else {
        if (order.stripePaymentIntentId) {
          await cancelTicketPaymentIntent(
            order.stripePaymentIntentId,
            // A venue-direct intent exists only on the venue's account.
            order.settlementMode === 'VENUE_DIRECT' ? order.settlementAccountId : null,
          );
        }
        const ok = await db.$transaction((tx) => voidReservedTicketOrder(tx, order.id));
        if (!ok) { failed += 1; continue; }
      }
      refunded += 1;
      if (order.buyerUserId) {
        await notifyUser(order.buyerUserId, {
          type: 'show_canceled_refunded',
          title: `"${show.title}" was cancelled`,
          /* The platform's own sentence stays first and unconditional, so the
             refund fact is never displaced by whatever the organizer wrote —
             and the organizer's words are attributed, not blended into it.
             IT NO LONGER SAYS "IN FULL", BECAUSE IT IS NOT. The refund is
             `totalChargeCents - processingFeeCents` (see the refundableCents
             comment above): a deliberate policy, but one this message
             contradicted. Measured 2026-08-31 on a $18.37 ticket — charged
             1952c, refunded 1865c, so the fan was 87c short of a message
             promising the lot. Money copy that overstates by 4.7% is how a
             support ticket becomes a chargeback, and a chargeback costs 1500c
             in fees against the 87c in dispute. The amount is stated instead,
             which is both true and more useful than either adjective. */
          body: (() => {
            const refunded = `$${((order.totalChargeCents - order.processingFeeCents) / 100).toFixed(2)}`;
            const opening = order.processingFeeCents > 0
              ? `The organizer cancelled this event — ${refunded} has been refunded to your original payment method. The payment processing fee is not returned.`
              : `The organizer cancelled this event — ${refunded} has been refunded to your original payment method.`;
            return organizerMessage ? `${opening} From the organizer: “${organizerMessage}”` : opening;
          })(),
          link: '/tickets',
        });
      }
    } catch (error) {
      log.error('[shows/cancel]', error instanceof Error ? error : { error: String(error) }, `refund failed for order ${order.id}`);
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

  /* A refund that failed leaves a CAPTURED order on a CANCELED show with no
     retry path — the payout cron only runs for ENDED shows, so the money is
     stuck rather than double-paid, and nobody is told. The show still cancels
     (ticketing has to stop), but the admin hears about the stuck orders now
     rather than from the buyer (security sweep, 2026-09-02). */
  if (failed > 0) {
    await sendOperationalEmail(
      {
        to: getAdminAlertRecipients(),
        subject: `[iHYPE] ${failed} refund${failed === 1 ? '' : 's'} failed cancelling a show`,
        text: `Show ${showId} was cancelled but ${failed} order refund${failed === 1 ? '' : 's'} failed and need${failed === 1 ? 's' : ''} a manual refund in Stripe. Refunded: ${refunded}. Skipped (already scanned): ${skippedScanned}. Details are in Sentry under [shows/cancel].`,
        html: `<p>Show <code>${showId}</code> was cancelled but <strong>${failed}</strong> order refund${failed === 1 ? '' : 's'} failed and need${failed === 1 ? 's' : ''} a manual refund in Stripe.</p><p>Refunded: ${refunded}. Skipped (already scanned): ${skippedScanned}.</p><p>Details are in Sentry under <code>[shows/cancel]</code>.</p>`,
      },
      'show-cancel-refund-failures',
    );
  }

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
