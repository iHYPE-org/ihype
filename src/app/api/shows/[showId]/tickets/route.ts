import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { Role, TicketOrderStatus } from '@prisma/client/edge';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { isTicketingOpen } from '@/lib/show-detail';
import { consumeDualRateLimit } from '@/lib/rate-limit';
import { verifyTurnstileToken } from '@/lib/turnstile';
import {
  MAX_TICKETS_PER_SHOW_PER_ACCOUNT,
  isSuspiciousPurchase,
  resolvePurchaseAllowance,
} from '@/lib/ticket-purchase-guard';
import { getPaymentProcessingReadiness } from '@/lib/payments';
import { reserveShowInventory } from '@/lib/ticket-inventory';
import { detectLocationFromHeaders } from '@/lib/request-location';
import {
  createVenueDirectCheckoutSession,
  isConnectMerchantReady,
} from '@/lib/stripe';
import {
  ARTIST_SHARE_PERCENT,
  VENUE_SHARE_PERCENT,
  calculateTicketOrderFinancials,
} from '@/lib/ticketing';
import { readClientAddress } from '@/lib/request-meta';
import { PAYMENTS_UNAVAILABLE_MESSAGE, isStripeUnavailable } from '@/lib/stripe-errors';
import { voidReservedTicketOrder } from '@/lib/ticket-order-state';
import { arePaymentsEnabledRuntime, isTicketingEnabledRuntime } from '@/lib/runtime-flags';

const schema = z.object({
  quantity: z.coerce.number().int().min(1).max(MAX_TICKETS_PER_SHOW_PER_ACCOUNT),
  turnstileToken: z.string().min(1).optional(),
  affiliatePromoterProfileId: z.string().cuid().optional(),
});

class TicketAvailabilityError extends Error {}
/** Per-account, per-show cap — a refusal the buyer can act on, not a fault. */
class TicketPurchaseLimitError extends Error {}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Fan login required' }, { status: 401 });
  }

  const [ticketingEnabled, paymentsEnabled] = await Promise.all([
    isTicketingEnabledRuntime(),
    arePaymentsEnabledRuntime(),
  ]);
  if (!ticketingEnabled || !paymentsEnabled) {
    return NextResponse.json(
      { error: 'New ticket purchases are temporarily paused.', code: !ticketingEnabled ? 'TICKETING_PAUSED' : 'PAYMENTS_PAUSED' },
      { status: 503, headers: { 'Retry-After': '300' } },
    );
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

  // Two buckets, both must pass. The per-user limit was the only one before,
  // and because rateLimitKey() drops the IP whenever a session exists, one
  // machine running fifty throwaway accounts got fifty independent buckets —
  // 4,000 tickets an hour entirely within the stated limit.
  const clientAddress = readClientAddress(request);
  const rl = await consumeDualRateLimit('ticket-purchase', session.user.id, clientAddress, {
    user: { limit: 10, windowMs: 60 * 60 * 1000 },
    ip: { limit: 25, windowMs: 60 * 60 * 1000 },
  });
  if (!rl.allowed) {
    log.error(
      '[ticket-purchase]',
      { userId: session.user.id, scope: rl.scope },
      'Ticket purchase rate limit exceeded',
    );
    return NextResponse.json(
      { error: 'Too many ticket requests. Try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.result.retryAfterSeconds ?? 60) } },
    );
  }

  let reservedOrderId: string | null = null;

  try {
    const { showId } = await params;
    const body = schema.parse(await request.json());

    // Proof of humanity, before any Stripe customer is created or inventory is
    // touched. verifyTurnstileToken fails CLOSED in production when
    // TURNSTILE_SECRET_KEY is set and the token is missing or invalid, and
    // open in development so local work needs no Cloudflare account.
    /* The reads start WITH the bot check, not after it (2026-09-24, DESIGN_SYNC
       row 513): they are read-only, and nothing below them writes, creates a
       Stripe customer or touches inventory until the check has passed. */
    const readsP = Promise.all([
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
          createdAt: true,
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
    // A refused check never awaits the reads; this only keeps a failure of
    // theirs from surfacing as an unhandled rejection.
    readsP.catch(() => undefined);

    const humanVerified = await verifyTurnstileToken(body.turnstileToken, clientAddress ?? undefined);
    if (!humanVerified) {
      log.error(
        '[ticket-purchase]',
        { userId: session.user.id, showId },
        'Ticket purchase failed the bot check',
      );
      return NextResponse.json(
        { error: 'Bot check failed. Refresh the page and try again.', code: 'BOT_CHECK_FAILED' },
        { status: 400 },
      );
    }

    const [user, show] = await readsP;

    if (!user || user.role !== Role.FAN) {
      return NextResponse.json({ error: 'Only fan accounts can reserve or purchase tickets.' }, { status: 403 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Verify your email address before purchasing tickets.', code: 'EMAIL_NOT_VERIFIED' },
        { status: 403 },
      );
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
    /* On sale, not merely ticketed. `isTicketingOpen()` is the one rule every
       other surface already reads — `showRowTrail()` prints "Tickets soon"
       from it, and `TicketSaleCard` renders no form when it is false — and
       until now the purchase route was the only place that ignored it. A show
       created with a future `ticketingOpensAt` would take the money anyway,
       while the card told the buyer they would be charged when the venue
       opened the event. Nothing charges later; there is no reserve-then-
       capture path. So a closed sale is refused here rather than half-honoured. */
    if (!isTicketingOpen(show)) {
      return NextResponse.json(
        { error: 'Tickets for this show are not on sale yet.', code: 'TICKETING_NOT_OPEN' },
        { status: 409 },
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
        return NextResponse.json({ error: 'The profile credited for this referral was not found' }, { status: 400 });
      }

      const showOwnerIds = [show.headlinerProfile?.ownerId, show.venueProfile?.ownerId].filter(Boolean);
      if (showOwnerIds.includes(affiliatePromoterProfile.ownerId)) {
        return NextResponse.json(
          { error: 'Artists and venues cannot earn referral credit on their own shows' },
          { status: 400 },
        );
      }
      /* Nor can the buyer refer themselves (second security scan, 2026-09-02).
         Any owned profile can connect payouts, so a fan naming their own
         profile here withheld 10% from the artist and venue and had the cron
         pay it back to them after the show — cashback funded by the acts. */
      if (affiliatePromoterProfile.ownerId === session.user.id) {
        return NextResponse.json(
          { error: 'You cannot earn referral credit on your own purchase' },
          { status: 400 },
        );
      }
    }

    /* THE VENUE IS THE MERCHANT ON EVERY SALE, OR THERE IS NO SALE
     * (owner, 2026-09-25: "No sales until onboarded").
     *
     * The charge is created on the venue's own Stripe account: their name is
     * on the buyer's statement, disputes and refunds are debited from them,
     * and they collect and remit the tax. iHYPE claims only the artist's 75%
     * as an application fee and pays it onward, and holds nothing else.
     *
     * Until this date two fallbacks let a sale proceed without that — a
     * destination charge to the headliner, and a platform-settled charge with
     * iHYPE as merchant — so that a fan was never stopped by a venue's
     * paperwork. Both made iHYPE the merchant of record, carrying disputes it
     * cannot fund and a tax obligation it has nobody to file, and both are
     * gone. The refusal comes BEFORE any inventory is reserved or any Stripe
     * customer is created, so a refused buyer holds nothing.
     *
     * MERCHANT-ready, not payout-ready: `card_payments` is what lets a charge
     * be created ON the account; `stripe_transfers` only lets money be sent to
     * it (row 155). A Stripe outage during the check is a 503, not a silent
     * step down to a mode that no longer exists. */
    const venueConnectId = show.venueProfile?.stripeConnectAccountId ?? null;
    const [venueDirectAccountId, buyerLocation] = await Promise.all([
      venueConnectId
        ? isConnectMerchantReady(venueConnectId).then((ready: boolean) => (ready ? venueConnectId : null))
        : Promise.resolve(null),
      detectLocationFromHeaders(request.headers),
    ]);
    if (!venueDirectAccountId) {
      return NextResponse.json(
        {
          error: 'Tickets for this show go on sale once the venue finishes setting up payments.',
          code: 'VENUE_NOT_PAYMENT_READY',
        },
        { status: 409 },
      );
    }

    /* The charter split, not the show's stored percentages: a show created
       under the old 70/20/10 carries 20/70 on its row, and a sale today is
       made under today's terms. */
    const financials = calculateTicketOrderFinancials({
      ticketPriceCents: show.ticketPriceCents,
      quantity: body.quantity,
      venuePayoutPercent: VENUE_SHARE_PERCENT,
      artistPayoutPercent: ARTIST_SHARE_PERCENT,
      buyerLocation,
      venueLocation: {
        postalCode: show.venueProfile?.postalCode,
        stateRegion: show.venueProfile?.stateRegion,
        country: show.venueProfile?.country,
      },
    });

    // Advisory only — never blocks. Refusing a fan who signed up minutes ago
    // because their favourite band just announced a date would punish the most
    // common legitimate reason to create an iHYPE account at all. This exists
    // so an attack in progress is visible in Sentry rather than silent.
    if (isSuspiciousPurchase({
      // Null rather than 0 when unknown: 0 would read as "brand new account"
      // and alert on every purchase.
      accountAgeMinutes: user.createdAt
        ? Math.floor((Date.now() - user.createdAt.getTime()) / 60_000)
        : null,
      humanVerified,
    })) {
      log.error(
        '[ticket-purchase]',
        { userId: user.id, showId: show.id, quantity: body.quantity },
        'Ticket purchase from a very new account — advisory, not blocked',
      );
    }

    const confirmationCode = randomUUID().split('-')[0].toUpperCase();
    const order = await db.$transaction(async (tx) => {
      // Per-account cap for this show, counted across every order that still
      // holds inventory — RESERVED as well as CAPTURED. A bot that opens
      // reservations and never captures would otherwise sit on an allocation
      // while counting as zero.
      //
      // Residual race, stated rather than hidden: this counts and then
      // inserts inside one ReadCommitted transaction, so two simultaneous
      // requests can both observe the same total. It is NOT the primary
      // defence — the two rate-limit buckets above are atomic (Durable
      // Object), so a burst is bounded at 10 orders per account and 25 per
      // address per hour regardless of who wins this race. Closing it
      // completely needs a per-(buyer, show) aggregate to guard with the same
      // conditional updateMany the capacity check uses, which is a migration
      // and belongs in prisma/migrations-pending. Escalating this transaction
      // to Serializable would be the wrong fix: every buyer for a show writes
      // the same Show row, so on-sale traffic would abort constantly.
      const heldAggregate = await tx.ticketOrder.aggregate({
        where: {
          showId: show.id,
          buyerUserId: user.id,
          status: { not: TicketOrderStatus.VOID },
        },
        _sum: { quantity: true },
      });
      const allowance = resolvePurchaseAllowance(heldAggregate._sum.quantity ?? 0, body.quantity);
      if (!allowance.allowed) {
        throw new TicketPurchaseLimitError(allowance.reason ?? 'Ticket limit reached for this show.');
      }

      // The capacity rule lives in `ticket-inventory.ts` — one conditional
      // write, evaluated against the row's live value, shared with the three
      // paths that give seats back. See that file before changing any of it.
      const reserved = await reserveShowInventory(tx, {
        showId: show.id,
        quantity: body.quantity,
        ticketCapacity: show.ticketCapacity,
      });
      if (!reserved) {
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
          affiliatePromoterProfileId: affiliatePromoterProfile?.id,
          // What Stripe routed with the charge. buildPayableEntries reads this
          // at capture so it does not write a payable for a share the act has
          // already been paid.
          settlementMode: 'VENUE_DIRECT',
          settlementAccountId: venueDirectAccountId,
          subtotalCents: financials.subtotalCents,
          taxLocalCents: financials.localCents,
          taxStateCents: financials.stateCents,
          taxCountryCents: financials.countryCents,
          taxInternationalCents: financials.internationalCents,
          totalTaxCents: financials.totalTaxCents,
          processingFeeCents: financials.processingFeeCents,
          reserveFeeCents: financials.reserveFeeCents,
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

    /* The venue-direct session takes no `stripeCustomerId` — a customer saved
       on the platform does not exist on the venue's account, and passing one
       would be rejected. */
    const checkout = await createVenueDirectCheckoutSession({
      amountCents: financials.totalChargeCents,
      venueAccountId: venueDirectAccountId,
      artistPayoutCents: financials.artistPayoutCents,
      showId: show.id,
      showSlug: show.slug,
      showTitle: show.title,
      quantity: body.quantity,
      ticketOrderConfirmationCode: order.confirmationCode,
    });
    return NextResponse.json(
      {
        order: { id: order.id, confirmationCode: order.confirmationCode, status: order.status },
        tickets: [],
        financials,
        captureMode: 'checkout',
        checkoutUrl: checkout.checkoutUrl,
        message: 'Continue to Stripe to pay securely. Tickets are issued only after Stripe confirms payment.',
      },
      { status: 201 },
    );
  } catch (error) {
    if (reservedOrderId) {
      await db.$transaction((tx) => voidReservedTicketOrder(tx, reservedOrderId!)).catch((cleanupError) => {
        log.error('[ticket-purchase]', cleanupError instanceof Error ? cleanupError : null, `Failed to void order ${reservedOrderId}`);
      });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid order payload' }, { status: 400 });
    }
    if (error instanceof TicketPurchaseLimitError) {
      // 409, not 500: the buyer asked for something the rules refuse, and the
      // message names the limit so they can adjust the quantity and retry.
      return NextResponse.json(
        { error: error.message, code: 'TICKET_LIMIT_REACHED' },
        { status: 409 },
      );
    }
    if (error instanceof TicketAvailabilityError) {
      return NextResponse.json({ error: 'Not enough tickets remain, or ticket availability changed. Please retry.' }, { status: 409 });
    }
    if (isStripeUnavailable(error)) {
      /* Stripe down, unreachable, rate-limiting us, or refusing our key: none
         of that is this order's fault and none of it is a 500 to hide behind
         "could not complete". The reservation above was already voided, so
         the sentence about released seats is true. 503 with Retry-After is
         what a client and a monitor both know how to read. */
      log.error('[ticket-purchase]', error instanceof Error ? error : null, 'Stripe unavailable during checkout');
      return NextResponse.json(
        { error: PAYMENTS_UNAVAILABLE_MESSAGE, code: 'PAYMENTS_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '120' } },
      );
    }
    log.error('[ticket-purchase]', error instanceof Error ? error : null, 'Ticket order failed');
    return NextResponse.json({ error: 'Could not complete this ticket order' }, { status: 500 });
  }
}
