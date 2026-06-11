import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { AccountsPayableCategory, Role, TicketOrderStatus } from '@prisma/client/wasm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { sendIssuedTicketEmail } from '@/lib/mailer';
import { isPaymentProcessingConfigured } from '@/lib/payments';
import { detectLocationFromHeaders } from '@/lib/request-location';
import {
  captureTicketPaymentIntent,
  createTicketPaymentIntent,
  getOrCreateStripeCustomer,
  isStripeConfigured
} from '@/lib/stripe';
import {
  calculateTicketOrderFinancials,
  formatCurrencyFromCents
} from '@/lib/ticketing';
import { readClientAddress } from '@/lib/request-meta';
import {
  buildTicketQrCodeDataUrl,
  buildTicketVerificationUrl,
  createSerializedTicketId,
  formatTicketStatus
} from '@/lib/tickets';

const schema = z.object({
  quantity: z.coerce.number().int().min(1).max(8),
  affiliatePromoterProfileId: z.string().cuid().optional(),
  stripePaymentMethodId: z.string().startsWith('pm_').optional()
});

function shouldCaptureTicketsNow(show: { status: string; ticketingOpensAt: Date | null }) {
  const now = Date.now();
  return show.status === 'LIVE' || Boolean(show.ticketingOpensAt && show.ticketingOpensAt.getTime() <= now);
}

function buildAccountsPayableEntries({
  ticketOrderId,
  showId,
  venueProfileId,
  headlinerProfileId,
  affiliatePromoterProfileId,
  financials
}: {
  ticketOrderId: string;
  showId: string;
  venueProfileId: string | null;
  headlinerProfileId: string | null;
  affiliatePromoterProfileId: string | null;
  financials: ReturnType<typeof calculateTicketOrderFinancials>;
}) {
  const entries: Array<{
    ticketOrderId: string;
    showId: string;
    profileId: string | null;
    category: AccountsPayableCategory;
    amountCents: number;
    payeeLabel: string;
    note: string;
  }> = [];

  if (financials.localCents > 0) {
    entries.push({
      ticketOrderId,
      showId,
      profileId: null,
      category: 'TAX_LOCAL',
      amountCents: financials.localCents,
      payeeLabel: 'Local tax payable',
      note: 'Buyer location matched the local venue area.'
    });
  }

  if (financials.stateCents > 0) {
    entries.push({
      ticketOrderId,
      showId,
      profileId: null,
      category: 'TAX_STATE',
      amountCents: financials.stateCents,
      payeeLabel: 'State / province tax payable',
      note: 'Buyer location matched the venue state / province.'
    });
  }

  if (financials.countryCents > 0) {
    entries.push({
      ticketOrderId,
      showId,
      profileId: null,
      category: 'TAX_COUNTRY',
      amountCents: financials.countryCents,
      payeeLabel: 'Country tax payable',
      note: 'Buyer location matched the venue country.'
    });
  }

  if (financials.internationalCents > 0) {
    entries.push({
      ticketOrderId,
      showId,
      profileId: null,
      category: 'TAX_INTERNATIONAL',
      amountCents: financials.internationalCents,
      payeeLabel: 'International tax payable',
      note: 'Buyer location is outside the venue country.'
    });
  }

  if (financials.venuePayoutCents > 0 && venueProfileId) {
    entries.push({
      ticketOrderId,
      showId,
      profileId: venueProfileId,
      category: 'VENUE_PAYOUT',
      amountCents: financials.venuePayoutCents,
      payeeLabel: 'Venue payout',
      note: 'Venue ticket payout allocation.'
    });
  }

  if (financials.artistPayoutCents > 0 && headlinerProfileId) {
    entries.push({
      ticketOrderId,
      showId,
      profileId: headlinerProfileId,
      category: 'ARTIST_PAYOUT',
      amountCents: financials.artistPayoutCents,
      payeeLabel: 'Artist payout',
      note: 'Artist ticket payout allocation.'
    });
  }

  if (financials.promoterPayoutCents > 0) {
    entries.push({
      ticketOrderId,
      showId,
      profileId: affiliatePromoterProfileId,
      category: 'PROMOTER_AFFILIATE',
      amountCents: financials.promoterPayoutCents,
      payeeLabel: affiliatePromoterProfileId ? 'Affiliate promoter payout' : 'Promoter affiliate pool',
      note: affiliatePromoterProfileId
        ? 'Affiliate promoter payout from linked sales.'
        : 'Affiliate promoter payout pending assignment.'
    });
  }

  return entries;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Fan login required' }, { status: 401 });
  }

  // 10 ticket orders per hour per user — prevents scripted bulk-buy abuse
  const rl = await consumeRateLimit(
    rateLimitKey('ticket-purchase', session.user.id, readClientAddress(request)),
    { limit: 10, windowMs: 60 * 60 * 1000 }
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many ticket requests. Try again later.' }, { status: 429 });
  }

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
          storedPaymentTokenRef: true,
          storedPaymentTokenBrand: true,
          storedPaymentTokenLast4: true,
          stripeCustomerId: true
        }
      }),
      db.show.findUnique({
        where: { id: showId },
        include: {
          venueProfile: { select: { id: true, name: true, postalCode: true, stateRegion: true, country: true, stripeConnectAccountId: true, ownerId: true } },
          headlinerProfile: { select: { id: true, name: true, stripeConnectAccountId: true, ownerId: true } },
          promoterProfile: { select: { id: true, name: true } }
        }
      })
    ]);

    if (!user || user.role !== Role.FAN) {
      return NextResponse.json({ error: 'Only fan accounts can reserve or purchase tickets.' }, { status: 403 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ error: 'Verify your email address before purchasing tickets.' }, { status: 403 });
    }

    const stripeActive = isStripeConfigured() && body.stripePaymentMethodId;
    if (!stripeActive && !user.storedPaymentTokenRef) {
      return NextResponse.json(
        { error: 'Add a payment method to your fan account before reserving tickets.' },
        { status: 400 }
      );
    }

    if (!show) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }

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

    if (show.ticketCapacity !== null && show.ticketsSoldCount + body.quantity > show.ticketCapacity) {
      return NextResponse.json({ error: 'Not enough tickets remain for this order' }, { status: 400 });
    }

    let affiliatePromoterProfile = null;
    if (body.affiliatePromoterProfileId) {
      affiliatePromoterProfile = await db.profile.findUnique({
        where: { id: body.affiliatePromoterProfileId },
        select: { id: true, type: true, name: true, ownerId: true }
      });

      if (!affiliatePromoterProfile) {
        return NextResponse.json({ error: 'Affiliate promoter profile not found' }, { status: 400 });
      }

      // Double-dipping prevention: artists/venues cannot earn promoter credit on their own shows
      const showOwnerIds = [show.headlinerProfile?.ownerId, show.venueProfile?.ownerId].filter(Boolean);
      if (showOwnerIds.includes(affiliatePromoterProfile.ownerId)) {
        return NextResponse.json(
          { error: 'Artists and venues cannot earn referral credit on their own shows' },
          { status: 400 }
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
        country: show.venueProfile?.country
      }
    });

    const captureNow = shouldCaptureTicketsNow(show);

    if (captureNow && !isPaymentProcessingConfigured()) {
      return NextResponse.json(
        {
          error:
            'Ticket payment capture is not configured yet. Add STRIPE_SECRET_KEY before selling live tickets.'
        },
        { status: 501 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const createdOrder = await tx.ticketOrder.create({
        data: {
          confirmationCode: randomUUID().split('-')[0].toUpperCase(),
          showId: show.id,
          buyerUserId: user.id,
          buyerName: user.name?.trim() || user.username,
          buyerEmail: user.email?.trim().toLowerCase() ?? '',
          quantity: body.quantity,
          status: captureNow ? TicketOrderStatus.CAPTURED : TicketOrderStatus.RESERVED,
          paymentTokenRef: user.storedPaymentTokenRef,
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
          chargedAt: captureNow ? new Date() : null
        }
      });

      const createdTickets = captureNow
        ? await Promise.all(
            Array.from({ length: body.quantity }, () =>
              tx.ticket.create({
                data: {
                  serializedId: createSerializedTicketId(),
                  ticketOrderId: createdOrder.id,
                  showId: show.id,
                  venueProfileId: show.venueProfileId,
                  holderName: createdOrder.buyerName,
                  holderEmail: createdOrder.buyerEmail
                }
              })
            )
          )
        : [];

      if (captureNow) {
        const accountsPayableEntries = buildAccountsPayableEntries({
          ticketOrderId: createdOrder.id,
          showId: show.id,
          venueProfileId: show.venueProfileId,
          headlinerProfileId: show.headlinerProfileId,
          affiliatePromoterProfileId: affiliatePromoterProfile?.id ?? null,
          financials
        });

        if (accountsPayableEntries.length) {
          await tx.accountsPayableEntry.createMany({
            data: accountsPayableEntries
          });
        }
      }

      await tx.show.update({
        where: { id: show.id },
        data: {
          ticketsSoldCount: {
            increment: body.quantity
          }
        }
      });

      return {
        createdOrder,
        createdTickets
      };
    });

    // --- Stripe payment processing (when configured and payment method provided) ---
    if (stripeActive && body.stripePaymentMethodId) {
      const customerId = await getOrCreateStripeCustomer({
        userId: user.id,
        email: user.email ?? '',
        name: user.name,
        existingCustomerId: user.stripeCustomerId
      });

      if (!user.stripeCustomerId) {
        await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
      }

      const { paymentIntentId } = await createTicketPaymentIntent({
        amountCents: financials.totalChargeCents,
        stripeCustomerId: customerId,
        paymentMethodId: body.stripePaymentMethodId,
        showId: show.id,
        ticketOrderConfirmationCode: result.createdOrder.confirmationCode,
        venueConnectAccountId: show.venueProfile?.stripeConnectAccountId,
        artistConnectAccountId: show.headlinerProfile?.stripeConnectAccountId,
        venuePayoutCents: financials.venuePayoutCents,
        artistPayoutCents: financials.artistPayoutCents
      });

      await db.ticketOrder.update({
        where: { id: result.createdOrder.id },
        data: { stripePaymentIntentId: paymentIntentId, paymentTokenRef: paymentIntentId }
      });

      if (captureNow) {
        await captureTicketPaymentIntent(paymentIntentId);
      }
    }

    const tickets = await Promise.all(
      result.createdTickets.map(async (ticket, index) => ({
        id: ticket.id,
        serializedId: ticket.serializedId,
        status: formatTicketStatus(ticket.status),
        verificationUrl: buildTicketVerificationUrl(ticket.serializedId),
        qrCodeDataUrl: await buildTicketQrCodeDataUrl(ticket.serializedId),
        label: `Ticket ${index + 1}`
      }))
    );

    if (captureNow && tickets.length) {
      await sendIssuedTicketEmail({
        email: result.createdOrder.buyerEmail,
        name: result.createdOrder.buyerName,
        showTitle: show.title,
        venueName: show.venueProfile?.name,
        eventOpensAtLabel: show.ticketingOpensAt?.toLocaleString('en-US') ?? null,
        totalChargeLabel: formatCurrencyFromCents(financials.totalChargeCents),
        tickets
      });
    }

    return NextResponse.json(
      {
        order: result.createdOrder,
        tickets,
        financials,
        captureMode: captureNow ? 'captured' : 'reserved',
        message: captureNow
          ? `Tickets charged to your stored token and issued for ${show.title}. Each ticket now has a serialized single-use QR code.`
          : `Your ticket request is reserved for ${show.title}. Your stored token will only be charged when the venue officially opens the event.`
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid order payload' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not complete this ticket order' }, { status: 500 });
  }
}
