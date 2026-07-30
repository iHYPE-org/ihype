import { db } from '@/lib/db';
import { notifyAdvertiser } from '@/lib/ad-campaign-notify';
import { sendIssuedTicketEmail } from '@/lib/mailer';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import {
  buildTicketQrCodeDataUrl,
  buildTicketVerificationUrl,
  formatTicketStatus,
} from '@/lib/tickets';
import { log } from '@/lib/logger';

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

async function deliverTicketOrder(orderId: string) {
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
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
  if (!order) throw new Error(`Ticket order ${orderId} no longer exists.`);

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
    idempotencyKey: `ticket-issued/${orderId}`,
    email: order.buyerEmail,
    name: order.buyerName,
    showTitle: order.show.title,
    venueName: order.show.venueProfile?.name,
    eventOpensAtLabel: order.show.ticketingOpensAt?.toLocaleString('en-US') ?? null,
    totalChargeLabel: formatCurrencyFromCents(order.totalChargeCents),
    tickets,
  });
}

async function deliverAdvertiserStatus(entityId: string, approved: boolean) {
  const ad = await db.ad.findUnique({
    where: { id: entityId },
    select: { title: true, advertiserId: true, advertiser: { select: { email: true } } },
  });
  if (!ad) throw new Error(`Ad ${entityId} no longer exists.`);
  await notifyAdvertiser(
    ad.advertiserId,
    ad.advertiser.email,
    ad.title,
    approved ? 'APPROVED' : 'PAYMENT_FAILED',
    approved ? 'Payment authorized.' : 'The card was declined or the checkout was abandoned.',
    undefined,
    `${approved ? 'ad-approved' : 'ad-payment-failed'}/${entityId}`,
  );
}

async function deliver(type: string, entityId: string) {
  if (type === 'TICKET_ISSUED') return deliverTicketOrder(entityId);
  if (type === 'AD_APPROVED') return deliverAdvertiserStatus(entityId, true);
  if (type === 'AD_PAYMENT_FAILED') return deliverAdvertiserStatus(entityId, false);
  throw new Error(`Unsupported notification job type: ${type}`);
}

export async function processNotificationJobs(limit = 10) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const candidates = await db.notificationJob.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
    },
    orderBy: { createdAt: 'asc' },
    take: Math.max(1, Math.min(limit, 25)),
    select: { id: true, type: true, entityId: true, attempts: true },
  });

  let completed = 0;
  let failed = 0;
  for (const job of candidates) {
    const claimed = await db.notificationJob.updateMany({
      where: {
        id: job.id,
        status: 'PENDING',
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
      },
      data: { lockedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;

    try {
      await deliver(job.type, job.entityId);
      await db.notificationJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date(), lockedAt: null, lastError: null },
      });
      completed += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const terminal = attempts >= MAX_ATTEMPTS;
      const delayMinutes = Math.min(360, 2 ** attempts);
      await db.notificationJob.update({
        where: { id: job.id },
        data: {
          status: terminal ? 'FAILED' : 'PENDING',
          lockedAt: null,
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60 * 1000),
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
        },
      });
      log.error(
        '[notification-jobs]',
        error instanceof Error ? error : { error: String(error) },
        `${job.type} delivery failed (attempt ${attempts}/${MAX_ATTEMPTS})`,
      );
      failed += 1;
    }
  }

  return { selected: candidates.length, completed, failed };
}
