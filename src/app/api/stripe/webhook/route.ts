import { NextResponse, type NextRequest } from 'next/server';
import { TicketOrderStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { constructWebhookEvent, isStripeConfigured } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe events. Idempotent — each event ID is only acted on once
 * because the unique stripePaymentIntentId constraint prevents double-processing.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const payload = await request.text();

  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (err) {
    console.error('[stripe/webhook]', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // Drop duplicate deliveries using the shared idempotency log.
  try {
    await db.processedWebhookEvent.create({
      data: { source: 'stripe', eventId: event.id }
    });
  } catch (err) {
    console.error('[stripe/webhook]', err);
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      // PaymentIntent authorized — fan's card hold is confirmed.
      // Nothing to do here; we capture manually on event open.
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await db.ticketOrder.updateMany({
        where: { stripePaymentIntentId: pi.id, status: TicketOrderStatus.RESERVED },
        data: { status: TicketOrderStatus.VOID }
      });
      break;
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object;
      await db.ticketOrder.updateMany({
        where: { stripePaymentIntentId: pi.id, status: TicketOrderStatus.RESERVED },
        data: { status: TicketOrderStatus.VOID }
      });
      break;
    }

    case 'account.updated': {
      // Connect Express account details changed — re-check onboarding status.
      const account = event.data.object;
      if (account.charges_enabled) {
        await db.profile.updateMany({
          where: { stripeConnectAccountId: account.id },
          data: { stripeConnectOnboarded: true }
        });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
