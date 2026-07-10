import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { Role, TicketOrderStatus } from '@prisma/client';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { sendIssuedTicketEmail } from '@/lib/mailer';
import { notifyUser } from '@/lib/notify';
import { getPaymentProcessingReadiness } from '@/lib/payments';
import { detectLocationFromHeaders } from '@/lib/request-location';
import {
  cancelTicketPaymentIntent,
  captureTicketPaymentIntent,
  createTicketPaymentIntent,
  getOrCreateStripeCustomer,
} from '@/lib/stripe';
import {
  calculateTicketOrderFinancials,
  formatCurrencyFromCents,
} from '@/lib/ticketing';
import { readClientAddress } from '@/lib/request-meta';
import {
  buildTicketQrCodeDataUrl,
  buildTicketVerificationUrl,
  formatTicketStatus,
} from '@/lib/tickets';
import {
  finalizeCapturedTicketOrder,
  voidReservedTicketOrder,
} from '@/lib/ticket-order-state';

const schema = z.object({
  quantity: z.coerce.number().int().min(1).max(8),
  affiliatePromoterProfileId: z.string().cuid().optional(),
  stripePaymentMethodId: z.string().startsWith('pm_').optional(),
});

class TicketAvailabilityError extends Error {}
class PaymentAuthorizationError extends Error {}

function shouldCaptureTicketsNow(show: { status: string; ticketingOpensAt: Date | null }) {
  const now = Date.now();
  return show.status === 'LIVE' || Boolean(show.ticketingOpensAt && show.ticketingOpensAt.getTime() <= now);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Fan login required' }, { status: 401 });
  }

  const readiness = getPaymentProcessingReadiness();
  if (!readiness.ready) {
    return NextResponse.json(
      {
        error: 'Paid ticketing is temporarily unavailable.',
        code: 'TICKET_PAYMENTS_DISABLED',
      },
      { status: 503 },
    );
  }

  const rl = await consumeRateLimit(
    rateLimitKey('ticket-purchase', session.user.id, readClientAddress(request)),
    { limit: 10, windowMs: 60 * 60 * 1000 },
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many ticket requests. Try again later.' }, { status: 429 });
  }

  let reservedOrderId: string | null = null;
  let paymentIntentId: string | null = null;
  let paymentCaptured = false;

  try {
    const { showId } = await params;
    const body = schema.parse(await request.json());

    const [user, show] = await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          emailVerified: true,
          isEighteenOrOlder: true,
          storedPaymentTokenRef: true,
          stripeCustomerId: true,
        },
      }),
      db.show.findUnique({
        where: { id: showId },
        include: {
          venueProfile: {
            select: {
              id: true,
              name: true,
              postalCode: true,
              stateRegion: true,
              country: true,
              stripeConnectAccountId: true,
              ownerId: true,
            },
          },
          headlinerProfile: {
            select: {
              id: true,
              name: true,
              stripeConnectAccountId: true,
              ownerId: true,
            },
          },
          promoterProfile: { select: { id: true, name: true } },
        },
      }),
    ]);

    if (!user || user.role !== Role.FAN) {
      return NextResponse.json({ error: 'Only fan accounts can reserve or purchase tickets.' }, { status: 403 });
    }
    if (!user.emailVerified) {
      return NextResponse.json({ error: 'Verify your email address before purchasing tickets.' }, { status: 403 });
    }
    if (!user.isEighteenOrOlder) {
      return NextResponse.json(
        {
          error: 'Ticket purchases require you to be 18 or older. Confirm your age in Settings to buy tickets.',
          code: 'AGE_18_REQUIRED',
        },
        { status: 403 },
      );
    }
    if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

    if (
      !show.isTicketed ||
      !show.ticketPriceCents ||
      show.venuePayoutPercent === null ||
      show.artistPayoutPercent === null
    ) {
      return NextResponse.json({ error: 'This show is not configured for ticket sales' }, { status: 400 });
    }
    if (!['SCHEDULED', 'LIVE'].includes(show.status)) {
      return NextResponse.json({ error: 'Tickets are only available for scheduled or live shows' }, { status: 400 });
    }

    const storedPaymentMethod = user.storedPaymentTokenRef?.startsWith('pm_')
      ? user.storedPaymentTokenRef
      : null;
    const paymentMethodId = body.stripePaymentMethodId ?? storedPaymentMethod;
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Add a valid Stripe payment method before reserving tickets.' },
        { status: 400 },
      );
    }

    let affiliatePromoterProfile: {
      id: string;
      type: string;
      name: string;
      ownerId: string;
    } | null = null;
    if (body.affiliatePromoterProfileId) {
      affiliatePromoterProfile = await db.profile.findUnique({
        where: { id: body.affiliatePromoterProfileId },
        select: { id: true, type: true, name: true, ownerId: true },
      });
      if (!affiliatePromoterProfile) {
        return NextResponse.json({ error: 'Affiliate promoter profile not found' }, { status: 400 });
      }

      const showOwnerIds = [show.headlinerProfile?.ownerId, show.venueProfile?.ownerId].filter(Boolean);
      if (showOwnerIds.includes(affiliatePromoterProfile.ownerId)) {
        return NextResponse.json(
          { error: 'Artists and venues cannot earn referral credit on their own shows' },
          { status: 400 },
        );
      }
    }

    const buyerLocation = await detectLocationFromHeaders(request.headers);
    const financials = calculateTicketOrderFinancials({
      ticketPriceCents: show.ticketPriceCents,
      quantity: body.quantity,
      venuePayoutPercent: show.venuePayoutPercent,
      artistPayoutPercent: show.artistPayoutPercent,
      promoterPayoutPercent: show.promoterPayoutPercent,
      buyerLocation,
      venueLocation: {
        postalCode: show.venueProfile?.postalCode,
        stateRegion: show.venueProfile?.stateRegion,
        country: show.venueProfile?.country,
      },
    });

    const customerId = await getOrCreateStripeCustomer({
      userId: user.id,
      email: user.email ?? '',
      name: user.name,
      existingCustomerId: user.stripeCustomerId,
    });
    if (!user.stripeCustomerId) {
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId, storedPaymentTokenRef: paymentMethodId },
      });
    } else if (body.stripePaymentMethodId && body.stripePaymentMethodId !== user.storedPaymentTokenRef) {
      await db.user.update({
        where: { id: user.id },
        data: { storedPaymentTokenRef: paymentMethodId },
      });
    }

    const confirmationCode = randomUUID().split('-')[0].toUpperCase();
    const order = await db.$transaction(async (tx) => {
      const remainingCapacityGuard = show.ticketCapacity === null
        ? {}
        : { ticketsSoldCount: { lte: show.ticketCapacity - body.quantity } };

      // The ticketsSoldCount comparison below is the atomic capacity guard —
      // it's evaluated against the row's live value at update time, so it
      // alone is sufficient to prevent overselling under concurrent
      // reservations. Do not also gate on show.updatedAt: that column is
      // bumped by any write to the row (including another buyer's own
      // successful reservation moments earlier), so pinning it to a value
      // read before this transaction started would reject concurrent,
      // still-within-capacity purchases as spurious "availability changed"
      // errors.
      const reserved = await tx.show.updateMany({
        where: {
          id: show.id,
          isTicketed: true,
          status: { in: ['SCHEDULED', 'LIVE'] },
          ...remainingCapacityGuard,
        },
        data: { ticketsSoldCount: { increment: body.quantity } },
      });
      if (reserved.count !== 1) {
        throw new TicketAvailabilityError('Ticket availability changed before the reservation completed.');
      }

      return tx.ticketOrder.create({
        data: {
          confirmationCode,
          showId: show.id,
          buyerUserId: user.id,
          buyerName: user.name?.trim() || user.username,
          buyerEmail: user.email?.trim().toLowerCase() ?? '',
          quantity: body.quantity,
          status: TicketOrderStatus.RESERVED,
          paymentTokenRef: paymentMethodId,
          affiliatePromoterProfileId: affiliatePromoterProfile?.id,
          subtotalCents: financials.subtotalCents,
          taxLocalCents: financials.localCents,
          taxStateCents: financials.stateCents,
          taxCountryCents: financials.countryCents,
          taxInternationalCents: financials.internationalCents,
          totalTaxCents: financials.totalTaxCents,
          totalChargeCents: financials.totalChargeCents,
          venuePayoutCents: financials.venuePayoutCents,
          artistPayoutCents: financials.artistPayoutCents,
          promoterPayoutCents: financials.promoterPayoutCents,
          locationCity: buyerLocation?.city,
          locationStateRegion: buyerLocation?.stateRegion,
          locationCountry: buyerLocation?.country,
          locationPostalCode: buyerLocation?.postalCode,
        },
      });
    });
    reservedOrderId = order.id;

    const authorization = await createTicketPaymentIntent({
      amountCents: financials.totalChargeCents,
      stripeCustomerId: customerId,
      paymentMethodId,
      showId: show.id,
      ticketOrderConfirmationCode: order.confirmationCode,
      venueConnectAccountId: show.venueProfile?.stripeConnectAccountId,
      artistConnectAccountId: show.headlinerProfile?.stripeConnectAccountId,
      venuePayoutCents: financials.venuePayoutCents,
      artistPayoutCents: financials.artistPayoutCents,
    });
    paymentIntentId = authorization.paymentIntentId;

    if (authorization.status !== 'requires_capture') {
      throw new PaymentAuthorizationError(
        authorization.status === 'requires_action'
          ? 'The payment method requires additional authentication.'
          : `The payment authorization was not accepted (${authorization.status}).`,
      );
    }

    await db.ticketOrder.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntentId },
    });

    const captureNow = shouldCaptureTicketsNow(show);
    if (!captureNow) {
      return NextResponse.json(
        {
          order: { ...order, stripePaymentIntentId: paymentIntentId },
          tickets: [],
          financials,
          captureMode: 'reserved',
          message: `Your ticket request is reserved for ${show.title}. The authorized payment will be captured only when the event opens.`,
        },
        { status: 201 },
      );
    }

    await captureTicketPaymentIntent(paymentIntentId);
    paymentCaptured = true;

    let finalized;
    try {
      finalized = await db.$transaction((tx) => finalizeCapturedTicketOrder(tx, order.id));
    } catch (error) {
      log.error(
        '[ticket-purchase]',
        error instanceof Error ? error : null,
        `Stripe captured order ${order.id}, but database finalization is pending webhook reconciliation`,
      );
      return NextResponse.json(
        {
          orderId: order.id,
          confirmationCode: order.confirmationCode,
          captureMode: 'reconciling',
          message: 'Payment was captured and ticket issuance is being reconciled. Do not submit another order.',
        },
        { status: 202 },
      );
    }

    const tickets = await Promise.all(
      finalized.tickets.map(async (ticket, index) => ({
        id: ticket.id,
        serializedId: ticket.serializedId,
        status: formatTicketStatus(ticket.status),
        verificationUrl: buildTicketVerificationUrl(ticket.serializedId),
        qrCodeDataUrl: await buildTicketQrCodeDataUrl(ticket.serializedId),
        label: `Ticket ${index + 1}`,
      })),
    );

    try {
      await sendIssuedTicketEmail({
        email: order.buyerEmail,
        name: order.buyerName,
        showTitle: show.title,
        venueName: show.venueProfile?.name,
        eventOpensAtLabel: show.ticketingOpensAt?.toLocaleString('en-US') ?? null,
        totalChargeLabel: formatCurrencyFromCents(financials.totalChargeCents),
        tickets,
      });
    } catch (error) {
      log.error('[ticket-purchase]', error instanceof Error ? error : null, `Ticket email failed for order ${order.id}`);
    }

    if (affiliatePromoterProfile) {
      const qty = body.quantity;
      await notifyUser(affiliatePromoterProfile.ownerId, {
        type: 'PROMOTER_SALE',
        title: 'Your link sold a ticket',
        body: `${qty === 1 ? 'A ticket' : `${qty} tickets`} to ${show.title} sold through your promo link.`,
        link: '/me/promote',
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        order: { ...order, status: TicketOrderStatus.CAPTURED, chargedAt: new Date(), stripePaymentIntentId: paymentIntentId },
        tickets,
        financials,
        captureMode: 'captured',
        message: `Payment captured and ${tickets.length} ticket${tickets.length === 1 ? '' : 's'} issued for ${show.title}.`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (reservedOrderId && !paymentCaptured) {
      if (paymentIntentId) await cancelTicketPaymentIntent(paymentIntentId).catch(() => {});
      await db.$transaction((tx) => voidReservedTicketOrder(tx, reservedOrderId!)).catch((cleanupError) => {
        log.error('[ticket-purchase]', cleanupError instanceof Error ? cleanupError : null, `Failed to void order ${reservedOrderId}`);
      });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid order payload' }, { status: 400 });
    }
    if (error instanceof TicketAvailabilityError) {
      return NextResponse.json({ error: 'Not enough tickets remain, or ticket availability changed. Please retry.' }, { status: 409 });
    }
    if (error instanceof PaymentAuthorizationError) {
      return NextResponse.json({ error: error.message, code: 'PAYMENT_AUTHORIZATION_FAILED' }, { status: 402 });
    }

    log.error('[ticket-purchase]', error instanceof Error ? error : null, 'Ticket order failed');
    return NextResponse.json({ error: 'Could not complete this ticket order' }, { status: 500 });
  }
}
