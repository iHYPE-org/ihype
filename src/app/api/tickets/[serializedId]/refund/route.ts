import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { refundTicketPaymentIntent, cancelTicketPaymentIntent } from '@/lib/stripe';
import { refundCapturedTicketOrder, voidReservedTicketOrder } from '@/lib/ticket-order-state';

export const dynamic = 'force-dynamic';

/**
 * Real self-serve refund — used to only file a SupportRequest and leave the
 * order/tickets/capacity completely untouched. Stripe is the source of
 * truth: the refund/cancel call happens first, and the DB only reflects it
 * once Stripe confirms, never the other way around.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ serializedId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const rl = await consumeRateLimit(rateLimitKey('ticket-refund', session.user.id, null), { limit: 5, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { serializedId } = await params;

  const order = await db.ticketOrder.findUnique({
    where: { id: serializedId },
    include: {
      show: { select: { title: true, startsAt: true } },
      tickets: { select: { status: true } },
    },
  });

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.buyerUserId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (order.status === 'VOID') return NextResponse.json({ error: 'Order already refunded or voided' }, { status: 409 });
  if (order.show?.startsAt && order.show.startsAt.getTime() - Date.now() < 48 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Cancellation closes 48h before the show — transfer your tickets instead' }, { status: 400 });
  }
  if (order.tickets.some((t) => t.status === 'SCANNED')) {
    return NextResponse.json({ error: 'This order has already been used for entry and can\'t be refunded' }, { status: 400 });
  }

  try {
    if (order.status === 'CAPTURED') {
      if (!order.stripePaymentIntentId) {
        return NextResponse.json({ error: 'No payment on file for this order.' }, { status: 400 });
      }
      const refundId = await refundTicketPaymentIntent(order.stripePaymentIntentId);
      await db.$transaction(async (tx) => {
        const ok = await refundCapturedTicketOrder(tx, order.id);
        if (!ok) throw new Error('Order changed state before the refund could be recorded.');
        await tx.ticketOrder.update({ where: { id: order.id }, data: { refundedAt: new Date(), stripeRefundId: refundId } });
      });
    } else {
      // RESERVED — never actually charged (payment only authorized), so
      // there's nothing to refund; cancel the authorization instead.
      if (order.stripePaymentIntentId) {
        await cancelTicketPaymentIntent(order.stripePaymentIntentId);
      }
      const ok = await db.$transaction((tx) => voidReservedTicketOrder(tx, order.id));
      if (!ok) throw new Error('Order changed state before the cancellation could be recorded.');
    }
  } catch (error) {
    console.error('[tickets/refund] failed', order.id, error);
    return NextResponse.json({ error: 'Could not process the refund. Please try again or contact support.' }, { status: 502 });
  }

  return NextResponse.json({ refunded: true });
}
