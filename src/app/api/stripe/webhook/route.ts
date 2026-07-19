import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { constructWebhookEvent, isStripeConfigured } from '@/lib/stripe';
import { log } from '@/lib/logger';
import { finalizeCapturedTicketOrder, voidReservedTicketOrder } from '@/lib/ticket-order-state';
import { sendIssuedTicketEmail } from '@/lib/mailer';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { notifyAdvertiser } from '@/lib/ad-campaign-notify';
import {
  buildTicketQrCodeDataUrl,
  buildTicketVerificationUrl,
  formatTicketStatus,
} from '@/lib/tickets';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    console.error('[stripe/webhook] WARNING: Using test Stripe key in production!');
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

  if (finalizedOrderId) {
    try {
      const order = await db.ticketOrder.findUnique({
        where: { id: finalizedOrderId },
        include: {
          tickets: true,
          show: {
            select: {
              title: true,
              ticketingOpensAt: true,
              venueProfile: { select: { name: true } },
            },
          },
        },
      });

      if (order) {
        const tickets = await Promise.all(
          order.tickets.map(async (ticket, index) => ({
            id: ticket.id,
            serializedId: ticket.serializedId,
            status: formatTicketStatus(ticket.status),
            verificationUrl: buildTicketVerificationUrl(ticket.serializedId),
            qrCodeDataUrl: await buildTicketQrCodeDataUrl(ticket.serializedId),
            label: `Ticket ${index + 1}`,
          })),
        );
        await sendIssuedTicketEmail({
          email: order.buyerEmail,
          name: order.buyerName,
          showTitle: order.show.title,
          venueName: order.show.venueProfile?.name,
          eventOpensAtLabel: order.show.ticketingOpensAt?.toLocaleString('en-US') ?? null,
          totalChargeLabel: formatCurrencyFromCents(order.totalChargeCents),
          tickets,
        });
      }
    } catch (error) {
      log.error('[stripe/webhook]', error instanceof Error ? error : null, `Ticket email failed for ${finalizedOrderId}`);
    }
  }

  if (authorizedAdId || cancelledAdId) {
    try {
      const ad = await db.ad.findUnique({
        where: { id: (authorizedAdId ?? cancelledAdId)! },
        select: { title: true, advertiserId: true, advertiser: { select: { email: true } } },
      });
      if (ad) {
        notifyAdvertiser(
          ad.advertiserId,
          ad.advertiser.email,
          ad.title,
          authorizedAdId ? 'APPROVED' : 'PAYMENT_FAILED',
          authorizedAdId ? 'Payment authorized.' : 'The card was declined or the checkout was abandoned.',
        );
      }
    } catch (error) {
      log.error('[stripe/webhook]', error instanceof Error ? error : null, `Advertiser notification failed for ad ${authorizedAdId ?? cancelledAdId}`);
    }
  }

  return NextResponse.json({ received: true, duplicate });
}
