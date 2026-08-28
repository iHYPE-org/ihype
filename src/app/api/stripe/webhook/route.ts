import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client/edge';
import { db } from '@/lib/db';
import { constructWebhookEvent, getStripe, isStripeConfigured } from '@/lib/stripe';
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
  let savedPaymentMethod: {
    userId: string;
    paymentMethodId: string;
    brand: string | null;
    last4: string | null;
  } | null = null;

  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object;
    if (checkoutSession.mode === 'setup' && checkoutSession.metadata?.purpose === 'ticket_payment_method') {
      const userId = checkoutSession.metadata.userId;
      const setupIntentId = typeof checkoutSession.setup_intent === 'string' ? checkoutSession.setup_intent : null;
      if (userId && setupIntentId) {
        const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId, { expand: ['payment_method'] });
        const paymentMethod = typeof setupIntent.payment_method === 'string' ? null : setupIntent.payment_method;
        if (paymentMethod?.id) {
          savedPaymentMethod = {
            userId,
            paymentMethodId: paymentMethod.id,
            brand: paymentMethod.card?.brand ?? null,
            last4: paymentMethod.card?.last4 ?? null,
          };
        }
      }
    }
  }

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

      if (savedPaymentMethod) {
        await tx.user.updateMany({
          where: { id: savedPaymentMethod.userId },
          data: {
            storedPaymentTokenRef: savedPaymentMethod.paymentMethodId,
            storedPaymentTokenBrand: savedPaymentMethod.brand,
            storedPaymentTokenLast4: savedPaymentMethod.last4,
          },
        });
      }

      switch (event.type) {
        /* THREE EVENTS, NOT ONE, and only the first was handled.
         *
         * Stripe is explicit that `checkout.session.completed` means the
         * customer "successfully AUTHORIZED the payment by submitting the
         * Checkout form", and that the next step is to "wait for the payment
         * to succeed or fail". For a card that is the same instant, which is
         * why one handler looked sufficient. For a delayed-notification method
         * — ACH, SEPA, Pay by Bank, Boleto, BLIK — it is 2 to 14 days later,
         * and the outcome arrives as `checkout.session.async_payment_succeeded`
         * or `..._failed`.
         *
         * We do not pin `payment_method_types`, so Checkout offers whatever the
         * account has enabled. These methods are reachable.
         *
         * The `payment_status === 'paid'` guard below was already right and is
         * what stopped the dangerous half of this: a ticket was never issued
         * before the money landed. What it could not do is issue one AFTER.
         * With no async handler, an ACH buyer paid, the funds arrived, and no
         * ticket was ever created — money taken, nothing delivered, and no
         * error anywhere because every handler did exactly what it said.
         *
         * A failure was the mirror image: the session has already COMPLETED, so
         * `checkout.session.expired` never fires for it, and the reserved order
         * sat holding a seat forever against a payment that will never arrive.
         */
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded': {
          const checkoutSession = event.data.object;
          if (
            checkoutSession.mode === 'payment' &&
            checkoutSession.payment_status === 'paid' &&
            checkoutSession.metadata?.purpose === 'ticket_purchase'
          ) {
            const confirmationCode = checkoutSession.metadata.confirmationCode;
            const paymentIntentId = typeof checkoutSession.payment_intent === 'string'
              ? checkoutSession.payment_intent
              : null;
            if (confirmationCode && paymentIntentId) {
              const order = await tx.ticketOrder.findUnique({
                where: { confirmationCode },
                select: { id: true },
              });
              if (order) {
                await tx.ticketOrder.update({
                  where: { id: order.id },
                  data: { stripePaymentIntentId: paymentIntentId },
                });
                /* Safe to receive twice. A card sale sends `completed` already
                   paid and no async event; a bank debit sends `completed`
                   unpaid and then `async_payment_succeeded` paid. Should both
                   ever arrive paid, `finalizeCapturedTicketOrder` reports
                   `changed: false` on the second and no tickets are reissued. */
                const finalized = await finalizeCapturedTicketOrder(tx, order.id, new Date(event.created * 1000));
                if (finalized.changed) capturedOrderId = order.id;
              }
            }
          }
          break;
        }

        case 'checkout.session.async_payment_failed': {
          /* The bank debit was declined days after checkout. Release the seat.
             `checkout.session.expired` cannot do this — the session completed,
             so it never expires — and nothing else was watching, so the order
             held capacity indefinitely for a sale that had already failed. */
          const checkoutSession = event.data.object;
          if (checkoutSession.metadata?.purpose === 'ticket_purchase') {
            const confirmationCode = checkoutSession.metadata.confirmationCode;
            if (confirmationCode) {
              const order = await tx.ticketOrder.findUnique({
                where: { confirmationCode },
                select: { id: true },
              });
              if (order) await voidReservedTicketOrder(tx, order.id);
            }
          }
          break;
        }

        case 'checkout.session.expired': {
          const checkoutSession = event.data.object;
          if (checkoutSession.metadata?.purpose === 'ticket_purchase') {
            const confirmationCode = checkoutSession.metadata.confirmationCode;
            if (confirmationCode) {
              const order = await tx.ticketOrder.findUnique({
                where: { confirmationCode },
                select: { id: true },
              });
              if (order) await voidReservedTicketOrder(tx, order.id);
            }
          }
          break;
        }

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
          /* `charges_enabled` is the wrong signal and this used to trust it.
             It asks whether the account can accept CARD PAYMENTS; iHYPE
             captures every ticket to its own balance and pays the 70/20/10 out
             as transfers, so a connected account never requests
             `card_payments` and reports `charges_enabled: false` no matter how
             completely it has onboarded. Writing that into
             `stripeConnectOnboarded` meant the flag could never become true:
             the "Verified" pill in payout settings stayed off forever and the
             Connect health cron flagged every correctly-onboarded account.

             `payouts_enabled` is the closest v1 field to the real question —
             can money reach this account — so the flag can now at least turn
             ON here. The authoritative check is `isConnectPayoutReady()` in
             the return route, which reads the v2 recipient capability
             directly; this handler is a backstop for a status that changes
             later (a verification lapsing), and is deliberately one-way: it
             never clears a flag the capability check has set, because a v1
             event about a v2 account is the less informed of the two. */
          const account = event.data.object;
          if (account.payouts_enabled) {
            await tx.profile.updateMany({
              where: { stripeConnectAccountId: account.id },
              data: { stripeConnectOnboarded: true },
            });
          }
          break;
        }

        case 'charge.dispute.created': {
          /* DETECTED, NOT AUTOMATED, and the distinction is deliberate.
           *
           * Where this lands depends entirely on the settlement mode, and the
           * two cases are opposites:
           *   - VENUE_DIRECT: the charge is on the venue, so Stripe debits the
           *     VENUE. Under this platform's Stripe-managed risk configuration
           *     an unrecoverable shortfall is Stripe's. iHYPE is not involved.
           *   - DESTINATION / PLATFORM: Stripe debits the PLATFORM, "with or
           *     without on_behalf_of". This is the exposure the 1.5% reserve
           *     line funds, against a fund that starts at zero.
           *
           * Stripe's guidance for the second case is to recover by reversing
           * the transfer to the act. That is real money taken back from a
           * musician, sometimes for a show they played, and it is not a
           * decision a webhook handler should make unattended. So this reports
           * and a human decides. `log.error` is what reaches Sentry here;
           * `console.error` lands in Worker logs nobody tails. */
          const dispute = event.data.object;
          log.error(
            '[stripe/webhook]',
            null,
            `DISPUTE ${dispute.id}: ${dispute.amount} ${dispute.currency} on charge ${typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id} — reason ${dispute.reason}. Check the order's settlementMode before acting: VENUE_DIRECT is the venue's, DESTINATION and PLATFORM are ours.`,
          );
          break;
        }

        case 'charge.updated': {
          /* A SKIPPED TRANSFER, which mode 2 has no other way to notice.
           *
           * On an asynchronous payment method there is a gap between
           * authorization and funds landing. If the destination account loses
           * its transfer capability or is closed in that window, Stripe SKIPS
           * the transfer and leaves the money in the platform balance, marking
           * it by setting `transfer_data` to null on the charge.
           *
           * That is silent here in a way it is not for other modes:
           * `DESTINATION` deliberately writes NO AccountsPayableEntry for the
           * act, because the transfer is supposed to be atomic with the charge.
           * So a skipped transfer leaves nobody owed anything in our database
           * and the act's 70% sitting on the platform, with every row looking
           * correct. Nothing else would ever ask. */
          const charge = event.data.object;
          if (
            charge.metadata?.settlementMode === 'destination' &&
            charge.transfer_data === null &&
            charge.status === 'succeeded'
          ) {
            log.error(
              '[stripe/webhook]',
              null,
              `SKIPPED TRANSFER on charge ${charge.id} (${charge.amount} ${charge.currency}): the destination lost its transfer capability or was closed, so the act's share is sitting in the platform balance with no payable row behind it. Create the transfer manually once the account is fixed.`,
            );
          }
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
