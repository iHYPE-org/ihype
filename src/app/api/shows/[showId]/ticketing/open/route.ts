import { NextResponse } from 'next/server';
import { TicketOrderStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendIssuedTicketEmail } from '@/lib/mailer';
import { getPaymentProcessingReadiness } from '@/lib/payments';
import { isAdminSession } from '@/lib/permissions';
import { captureTicketPaymentIntent } from '@/lib/stripe';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { finalizeCapturedTicketOrder } from '@/lib/ticket-order-state';
import {
  buildTicketQrCodeDataUrl,
  buildTicketVerificationUrl,
  formatTicketStatus,
} from '@/lib/tickets';

function canOpenEvent(
  sessionUserId: string | undefined,
  isAdmin: boolean,
  show: {
    creatorId: string;
    venueProfile?: { ownerId: string } | null;
    promoterProfile?: { ownerId: string } | null;
  },
) {
  if (!sessionUserId) return false;
  return Boolean(
    isAdmin ||
      sessionUserId === show.creatorId ||
      show.venueProfile?.ownerId === sessionUserId ||
      show.promoterProfile?.ownerId === sessionUserId,
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const { showId } = await params;
  const show = await db.show.findUnique({
    where: { id: showId },
    include: {
      venueProfile: { select: { ownerId: true, name: true } },
      promoterProfile: { select: { ownerId: true } },
      ticketOrders: {
        where: { status: TicketOrderStatus.RESERVED },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          buyerName: true,
          buyerEmail: true,
          totalChargeCents: true,
          stripePaymentIntentId: true,
        },
      },
    },
  });

  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });
  if (!show.isTicketed) {
    return NextResponse.json({ error: 'This show is not configured for ticketing.' }, { status: 400 });
  }
  if (!canOpenEvent(session.user.id, isAdminSession(session), show)) {
    return NextResponse.json(
      { error: 'Only the venue, promoter, creator, or admin can open this event.' },
      { status: 403 },
    );
  }

  const readiness = getPaymentProcessingReadiness();
  if (show.ticketOrders.length > 0 && !readiness.ready) {
    return NextResponse.json(
      { error: 'Paid ticketing is temporarily unavailable.', code: 'TICKET_PAYMENTS_DISABLED' },
      { status: 503 },
    );
  }

  const openedAt = new Date();
  const capturedOrderIds: string[] = [];
  const pendingOrderIds: string[] = [];

  for (const order of show.ticketOrders) {
    if (!order.stripePaymentIntentId) {
      pendingOrderIds.push(order.id);
      log.error('[ticketing/open]', null, `Reserved order ${order.id} has no Stripe PaymentIntent`);
      continue;
    }

    try {
      await captureTicketPaymentIntent(order.stripePaymentIntentId);
      const finalized = await db.$transaction((tx) =>
        finalizeCapturedTicketOrder(tx, order.id, openedAt),
      );
      capturedOrderIds.push(order.id);

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

      await sendIssuedTicketEmail({
        email: order.buyerEmail,
        name: order.buyerName,
        showTitle: show.title,
        venueName: show.venueProfile?.name,
        eventOpensAtLabel: openedAt.toLocaleString('en-US'),
        totalChargeLabel: formatCurrencyFromCents(order.totalChargeCents),
        tickets,
      }).catch((error) => {
        log.error('[ticketing/open]', error instanceof Error ? error : null, `Ticket email failed for ${order.id}`);
      });
    } catch (error) {
      // A network error can occur after Stripe accepted capture. Keep the order
      // reserved so payment_intent.succeeded can reconcile it safely.
      pendingOrderIds.push(order.id);
      log.error('[ticketing/open]', error instanceof Error ? error : null, `Capture pending reconciliation for ${order.id}`);
    }
  }

  await db.show.update({
    where: { id: show.id },
    data: { ticketingOpensAt: openedAt },
  });

  return NextResponse.json({
    openedAt: openedAt.toISOString(),
    capturedOrderCount: capturedOrderIds.length,
    pendingReconciliationCount: pendingOrderIds.length,
    capturedOrderIds,
    pendingOrderIds,
    message:
      pendingOrderIds.length > 0
        ? `Event opened. ${capturedOrderIds.length} order${capturedOrderIds.length === 1 ? '' : 's'} captured and ${pendingOrderIds.length} left for payment reconciliation.`
        : `Event opened. ${capturedOrderIds.length} reserved order${capturedOrderIds.length === 1 ? '' : 's'} captured and issued.`,
  });
}
