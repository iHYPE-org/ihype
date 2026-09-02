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

  // Find stale reservations grouped by show so we can release seat counts atomically
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
    return NextResponse.json({ ok: true, voided: 0 });
  }

  // Group by show for the seat-count release
  const seatsByShow = new Map<string, number>();
  for (const order of stale) {
    seatsByShow.set(order.showId, (seatsByShow.get(order.showId) ?? 0) + order.quantity);
  }

  const orderIds = stale.map((o) => o.id);

  await db.$transaction([
    db.ticketOrder.updateMany({
      // Still RESERVED: a capture landing between the read above and this
      // write must not be flipped to VOID and have its seats handed back.
      where: { id: { in: orderIds }, status: 'RESERVED', stripePaymentIntentId: null },
      data: { status: 'VOID' }
    }),
    // Release seats back to each show
    ...Array.from(seatsByShow.entries()).map(([showId, qty]) =>
      db.show.update({
        where: { id: showId },
        data: { ticketsSoldCount: { decrement: qty } }
      })
    )
  ]);

  return NextResponse.json({
    ok: true,
    voided: stale.length,
    showsAffected: seatsByShow.size
  });
}
