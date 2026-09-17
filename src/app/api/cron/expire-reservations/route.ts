import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Reservations older than this without payment capture are voided.
//
// LONGER THAN THE CHECKOUT SESSION, deliberately (second security scan,
// 2026-09-02). Stripe Checkout sessions are created with a 30-minute
// `expires_at` (src/lib/stripe.ts), and `stripePaymentIntentId` is only
// written when the webhook reports completion — so with a 15-minute TTL a
// buyer who paid at minute 16 to 30 found their order already VOID when the
// webhook arrived: money taken, no ticket. 35 minutes leaves the session
// nowhere to complete against a voided order.
const RESERVATION_TTL_MINUTES = 35;

/**
 * GET /api/cron/expire-reservations
 * Cron — runs every 5 minutes.
 * Voids RESERVED ticket orders that were never captured within the TTL window
 * and releases the seats back by decrementing ticketsSoldCount on the show.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RESERVATION_TTL_MINUTES * 60 * 1000);

  const stale = await db.ticketOrder.findMany({
    where: {
      status: 'RESERVED',
      createdAt: { lt: cutoff },
      // Only expire orders that have no payment intent started
      stripePaymentIntentId: null
    },
    select: { id: true, showId: true, quantity: true }
  });

  if (stale.length === 0) {
    return NextResponse.json({ ok: true, voided: 0, raced: 0, showsAffected: 0 });
  }

  // THE SEATS RELEASED MUST BE EXACTLY THE SEATS ACTUALLY VOIDED, and getting
  // that wrong oversells the show.
  //
  // This used to void with a `status: 'RESERVED', stripePaymentIntentId: null`
  // guard — correctly refusing an order that captured between the read above
  // and this write — and then decrement each show by the quantity summed from
  // the READ. So the one race the guard exists to defend against was also the
  // race that handed a paid buyer's seats back to the pool: the order stayed
  // CAPTURED, its seats were released anyway, and `ticketsSoldCount` fell
  // below the number of tickets really held. The next buyers bought seats that
  // did not exist. The release was also an unguarded `show.update`, so the
  // count could go negative — where both paths in `ticket-order-state.ts`
  // guard `ticketsSoldCount: { gte: quantity }` and throw when the release does
  // not apply. Two implementations of one rule, and this was the weaker.
  //
  // Grouping by (show, quantity) is what makes the release exact without a
  // statement per order: every order in a group frees the same number of
  // seats, so `count × quantity` is the true figure, whatever raced. Quantity
  // is 1..MAX_TICKETS_PER_SHOW_PER_ACCOUNT, so a show contributes at most
  // eight groups however many reservations went stale — which matters here,
  // because the run after a big on-sale is the one with the most orders in it.
  const groups = new Map<string, { showId: string; quantity: number; ids: string[] }>();
  for (const order of stale) {
    const key = `${order.showId}:${order.quantity}`;
    const group = groups.get(key) ?? { showId: order.showId, quantity: order.quantity, ids: [] };
    group.ids.push(order.id);
    groups.set(key, group);
  }

  let voided = 0;
  const showsAffected = new Set<string>();

  for (const group of groups.values()) {
    const releasedSeats = await db.$transaction(async (tx) => {
      const transitioned = await tx.ticketOrder.updateMany({
        // Still RESERVED and still unpaid: a capture landing between the read
        // above and this write must not be flipped to VOID.
        where: { id: { in: group.ids }, status: 'RESERVED', stripePaymentIntentId: null },
        data: { status: 'VOID' }
      });
      if (transitioned.count === 0) return 0;

      const seats = transitioned.count * group.quantity;
      const released = await tx.show.updateMany({
        // Never below zero: a count that has already drifted is a reason to
        // fail loudly, not to write a negative capacity the purchase guard
        // would then read as room.
        where: { id: group.showId, ticketsSoldCount: { gte: seats } },
        data: { ticketsSoldCount: { decrement: seats } }
      });
      if (released.count !== 1) {
        throw new Error(
          `Show ${group.showId} could not release ${seats} seat(s) for ${transitioned.count} expired reservation(s).`
        );
      }

      voided += transitioned.count;
      return seats;
    });

    if (releasedSeats > 0) showsAffected.add(group.showId);
  }

  return NextResponse.json({
    ok: true,
    // What was VOIDED, not what was read — the two differ by exactly the
    // orders that captured while this ran, and reporting the read count would
    // be a figure this job never measured.
    voided,
    raced: stale.length - voided,
    showsAffected: showsAffected.size
  });
}
