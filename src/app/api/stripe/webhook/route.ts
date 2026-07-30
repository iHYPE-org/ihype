import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client/edge';
import { db } from '@/lib/db';
import { constructWebhookEvent, isStripeConfigured } from '@/lib/stripe';
import { log } from '@/lib/logger';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { finalizeCapturedTicketOrder, voidReservedTicketOrder } from '@/lib/ticket-order-state';
import { processNotificationJobs } from '@/lib/notification-jobs';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && readRuntimeEnv('STRIPE_SECRET_KEY')?.startsWith('sk_test_')) {
    log.error('[stripe/webhook]', null, 'WARNING: Using test Stripe key in production!');
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });

  const payload = await request.text();
  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (error) {
    log.error('[stripe/webhook]', error instanceof Error ? error : null, 'Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let finalizedOrderId: string | null = null;
  let authorizedAdId: string | null = null;
  let cancelledAdId: string | null = null;
  let duplicate = false;

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.processedWebhookEvent.findUnique({
        where: { source_eventId: { source: 'stripe', eventId: event.id } },
        select: { id: true },
      });
      if (existing) {
        return {
          duplicate: true,
          finalizedOrderId: null as string | null,
          authorizedAdId: null as string | null,
          cancelledAdId: null as string | null,
        };
      }

      let capturedOrderId: string | null = null;
      let authorizedAdId: string | null = null;
      let cancelledAdId: string | null = null;

      switch (event.type) {
        case 'payment_intent.amount_capturable_updated': {
          // Fires when a manual-capture PaymentIntent's amount_capturable
          // changes — including the moment it first becomes capturable,
          // i.e. successful authorization. Ticket orders react to
          // `payment_intent.succeeded` (explicit capture) instead; ad
          // campaigns react HERE, since capture only ever happens much
          // later at campaign settlement (see the ad-settlement cron) —
          // the campaign needs to go live the moment the hold succeeds,
          // not when it's eventually captured.
          const paymentIntent = event.data.object;
          const ad = await tx.ad.findUnique({
            where: { stripePaymentIntentId: paymentIntent.id },
            select: { id: true, status: true, runDays: true },
          });
          if (ad && ad.status === 'AWAITING_PAYMENT') {
            const startsAt = new Date(event.created * 1000);
            const endsAt = new Date(startsAt.getTime() + (ad.runDays ?? 7) * 24 * 60 * 60 * 1000);
            await tx.ad.update({
              where: { id: ad.id },
              data: { status: 'APPROVED', authorizedAt: startsAt, startsAt, endsAt },
            });
            authorizedAdId = ad.id;
          }
          break;
        }

        case 'payment_intent.payment_failed':
        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object;
          const orders = await tx.ticketOrder.findMany({
            where: { stripePaymentIntentId: paymentIntent.id },
            select: { id: true },
          });
          for (const order of orders) await voidReservedTicketOrder(tx, order.id);

          const ad = await tx.ad.findUnique({
            where: { stripePaymentIntentId: paymentIntent.id },
            select: { id: true, status: true },
          });
          if (ad && ad.status === 'AWAITING_PAYMENT') {
            await tx.ad.update({ where: { id: ad.id }, data: { status: 'CANCELLED' } });
            cancelledAdId = ad.id;
          }
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          const order = await tx.ticketOrder.findUnique({
            where: { stripePaymentIntentId: paymentIntent.id },
            select: { id: true },
          });
          if (order) {
            const finalized = await finalizeCapturedTicketOrder(tx, order.id, new Date(event.created * 1000));
            if (finalized.changed) capturedOrderId = order.id;
          }
          break;
        }

        case 'account.updated': {
          const account = event.data.object;
          await tx.profile.updateMany({
            where: { stripeConnectAccountId: account.id },
            data: { stripeConnectOnboarded: account.charges_enabled },
          });
          break;
        }

        default:
          break;
      }

      if (capturedOrderId) {
        await tx.notificationJob.upsert({
          where: { dedupeKey: `ticket-issued:${capturedOrderId}` },
          create: { type: 'TICKET_ISSUED', dedupeKey: `ticket-issued:${capturedOrderId}`, entityId: capturedOrderId },
          update: {},
        });
      }
      if (authorizedAdId) {
        await tx.notificationJob.upsert({
          where: { dedupeKey: `ad-approved:${authorizedAdId}` },
          create: { type: 'AD_APPROVED', dedupeKey: `ad-approved:${authorizedAdId}`, entityId: authorizedAdId },
          update: {},
        });
      }
      if (cancelledAdId) {
        await tx.notificationJob.upsert({
          where: { dedupeKey: `ad-payment-failed:${cancelledAdId}` },
          create: { type: 'AD_PAYMENT_FAILED', dedupeKey: `ad-payment-failed:${cancelledAdId}`, entityId: cancelledAdId },
          update: {},
        });
      }

      await tx.processedWebhookEvent.create({
        data: { source: 'stripe', eventId: event.id },
      });
      return { duplicate: false, finalizedOrderId: capturedOrderId, authorizedAdId, cancelledAdId };
    });

    duplicate = result.duplicate;
    finalizedOrderId = result.finalizedOrderId;
    authorizedAdId = result.authorizedAdId;
    cancelledAdId = result.cancelledAdId;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      duplicate = true;
    } else {
      log.error('[stripe/webhook]', error instanceof Error ? error : null, `Processing failed for ${event.id}`);
      return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
    }
  }

  // Delivery is backed by a transactional job written alongside the payment
  // state above. Try immediately for low latency; the cron worker retries any
  // transient failure without asking Stripe to replay an already-processed
  // business event.
  if (finalizedOrderId || authorizedAdId || cancelledAdId || duplicate) {
    await processNotificationJobs(5);
  }

  return NextResponse.json({ received: true, duplicate });
}
