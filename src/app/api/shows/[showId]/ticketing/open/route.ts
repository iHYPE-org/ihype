import { NextResponse } from 'next/server';
import { AccountsPayableCategory, AccountsPayableStatus, TicketOrderStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendIssuedTicketEmail } from '@/lib/mailer';
import { isPaymentProcessingConfigured } from '@/lib/payments';
import { canManageOwnedResource, isAdminSession } from '@/lib/permissions';
import { captureTicketPaymentIntent } from '@/lib/stripe';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import {
  buildTicketQrCodeDataUrl,
  buildTicketVerificationUrl,
  createSerializedTicketId,
  formatTicketStatus
} from '@/lib/tickets';

function canOpenEvent(
  sessionUserId: string | undefined,
  isAdmin: boolean,
  show: {
    creatorId: string;
    venueProfile?: { ownerId: string } | null;
    promoterProfile?: { ownerId: string } | null;
  }
) {
  if (!sessionUserId) {
    return false;
  }

  if (isAdmin || sessionUserId === show.creatorId) {
    return true;
  }

  if (show.venueProfile?.ownerId === sessionUserId) {
    return true;
  }

  if (show.promoterProfile?.ownerId === sessionUserId) {
    return true;
  }

  return false;
}

function buildPayableEntries(show: {
  id: string;
  venueProfileId: string | null;
  headlinerProfileId: string | null;
}, order: {
  id: string;
  affiliatePromoterProfileId: string | null;
  taxLocalCents: number;
  taxStateCents: number;
  taxCountryCents: number;
  taxInternationalCents: number;
  venuePayoutCents: number;
  artistPayoutCents: number;
  promoterPayoutCents: number;
}) {
  const entries: Array<{
    ticketOrderId: string;
    showId: string;
    profileId: string | null;
    category: AccountsPayableCategory;
    status: AccountsPayableStatus;
    amountCents: number;
    payeeLabel: string;
    note: string;
  }> = [];

  const pushIfAmount = (
    amountCents: number,
    category: AccountsPayableCategory,
    payeeLabel: string,
    note: string,
    profileId: string | null = null
  ) => {
    if (amountCents <= 0) {
      return;
    }

    entries.push({
      ticketOrderId: order.id,
      showId: show.id,
      profileId,
      category,
      status: AccountsPayableStatus.PENDING,
      amountCents,
      payeeLabel,
      note
    });
  };

  pushIfAmount(order.taxLocalCents, 'TAX_LOCAL', 'Local tax payable', 'Charged at venue event open.');
  pushIfAmount(order.taxStateCents, 'TAX_STATE', 'State / province tax payable', 'Charged at venue event open.');
  pushIfAmount(order.taxCountryCents, 'TAX_COUNTRY', 'Country tax payable', 'Charged at venue event open.');
  pushIfAmount(order.taxInternationalCents, 'TAX_INTERNATIONAL', 'International tax payable', 'Charged at venue event open.');
  pushIfAmount(order.venuePayoutCents, 'VENUE_PAYOUT', 'Venue payout', 'Venue payout from captured ticket order.', show.venueProfileId);
  pushIfAmount(order.artistPayoutCents, 'ARTIST_PAYOUT', 'Artist payout', 'Artist payout from captured ticket order.', show.headlinerProfileId);
  pushIfAmount(
    order.promoterPayoutCents,
    'PROMOTER_AFFILIATE',
    order.affiliatePromoterProfileId ? 'Affiliate promoter payout' : 'Promoter affiliate pool',
    'Affiliate payout from captured ticket order.',
    order.affiliatePromoterProfileId
  );

  return entries;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { showId } = await params;
  const isAdmin = isAdminSession(session);

  const show = await db.show.findUnique({
    where: { id: showId },
    include: {
      venueProfile: true,
      promoterProfile: true,
      headlinerProfile: true,
      ticketOrders: {
        where: { status: TicketOrderStatus.RESERVED },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          confirmationCode: true,
          buyerName: true,
          buyerEmail: true,
          quantity: true,
          totalChargeCents: true,
          taxLocalCents: true,
          taxStateCents: true,
          taxCountryCents: true,
          taxInternationalCents: true,
          venuePayoutCents: true,
          artistPayoutCents: true,
          promoterPayoutCents: true,
          affiliatePromoterProfileId: true,
          stripePaymentIntentId: true
        }
      }
    }
  });

  if (!show) {
    return NextResponse.json({ error: 'Show not found' }, { status: 404 });
  }

  if (!show.isTicketed) {
    return NextResponse.json({ error: 'This show is not configured for ticketing.' }, { status: 400 });
  }

  if (!canOpenEvent(session.user.id, isAdmin, show)) {
    return NextResponse.json({ error: 'Only the venue, promoter, creator, or admin can open this event.' }, { status: 403 });
  }

  const openedAt = new Date();

  if (show.ticketOrders.length > 0 && !isPaymentProcessingConfigured()) {
    return NextResponse.json(
      {
        error:
          'Reserved ticket orders cannot be captured until STRIPE_SECRET_KEY is configured in production.'
      },
      { status: 501 }
    );
  }

  const captureResult = await db.$transaction(async (tx) => {
    await tx.show.update({
      where: { id: show.id },
      data: {
        ticketingOpensAt: openedAt
      }
    });

    const capturedOrders: Array<{
      order: (typeof show.ticketOrders)[number];
      tickets: Array<{
        id: string;
        serializedId: string;
        status: string;
        verificationUrl: string;
        qrCodeDataUrl: string;
        label: string;
      }>;
    }> = [];

    for (const order of show.ticketOrders) {
      const createdTickets = await Promise.all(
        Array.from({ length: order.quantity }, () =>
          tx.ticket.create({
            data: {
              serializedId: createSerializedTicketId(),
              ticketOrderId: order.id,
              showId: show.id,
              venueProfileId: show.venueProfileId,
              holderName: order.buyerName,
              holderEmail: order.buyerEmail
            }
          })
        )
      );

      await tx.ticketOrder.update({
        where: { id: order.id },
        data: {
          status: TicketOrderStatus.CAPTURED,
          chargedAt: openedAt
        }
      });

      const payableEntries = buildPayableEntries(show, order);
      if (payableEntries.length) {
        await tx.accountsPayableEntry.createMany({
          data: payableEntries
        });
      }

      const responseTickets = await Promise.all(
        createdTickets.map(async (ticket, index) => ({
          id: ticket.id,
          serializedId: ticket.serializedId,
          status: formatTicketStatus(ticket.status),
          verificationUrl: buildTicketVerificationUrl(ticket.serializedId),
          qrCodeDataUrl: await buildTicketQrCodeDataUrl(ticket.serializedId),
          label: `Ticket ${index + 1}`
        }))
      );

      capturedOrders.push({
        order,
        tickets: responseTickets
      });
    }

    return capturedOrders;
  });

  await Promise.all(
    captureResult.map(({ order, tickets }) =>
      sendIssuedTicketEmail({
        email: order.buyerEmail,
        name: order.buyerName,
        showTitle: show.title,
        venueName: show.venueProfile?.name,
        eventOpensAtLabel: openedAt.toLocaleString('en-US'),
        totalChargeLabel: formatCurrencyFromCents(order.totalChargeCents),
        tickets
      })
    )
  );

  return NextResponse.json({
    openedAt: openedAt.toISOString(),
    capturedOrderCount: captureResult.length,
    message:
      captureResult.length > 0
        ? `Event opened. ${captureResult.length} reserved order${captureResult.length === 1 ? '' : 's'} were charged and issued.`
        : 'Event opened. No reserved orders were waiting for capture.'
  });
}
