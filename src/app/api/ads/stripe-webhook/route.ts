import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_AD_WEBHOOK_SECRET;
  if (!stripeKey?.startsWith('sk_') || !webhookSecret) {
    return NextResponse.json({ error: 'Payment not configured.' }, { status: 503 });
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' });

  const sig = request.headers.get('stripe-signature') ?? '';
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[ads/stripe-webhook]', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Drop duplicate deliveries using the shared idempotency log.
  try {
    await db.processedWebhookEvent.create({
      data: { source: 'stripe-ads', eventId: event.id }
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const adId = session.metadata?.adId;
    if (adId) {
      await db.adSubmission.update({ where: { id: adId }, data: { status: 'active' } });
      if (session.subscription) {
        await db.auditLog.create({
          data: {
            actorUserId: null,
            action: 'AD_SUBSCRIPTION_CREATED',
            entityType: 'AdSubmission',
            entityId: adId,
            metadata: { stripeSubscriptionId: session.subscription as string },
          }
        });
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const log = await db.auditLog.findFirst({
      where: { action: 'AD_SUBSCRIPTION_CREATED', metadata: { path: ['stripeSubscriptionId'], equals: sub.id } }
    });
    if (log?.entityId) {
      await db.adSubmission.update({ where: { id: log.entityId }, data: { status: 'expired' } });
    }
  }

  return NextResponse.json({ received: true });
}
