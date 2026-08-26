import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { createSerializedTicketId } from '@/lib/tickets';
import { normalizeTransferCode } from '@/lib/ticket-transfer-code';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/tickets/claim` — redeem a transfer code and take the order.
 *
 * This is the half that makes a transfer real. The pre-existing email transfer
 * rewrites `Ticket.holderEmail` and leaves `TicketOrder.buyerUserId` alone,
 * while every ticket list in the app reads `where: { buyerUserId }` — so an
 * emailed transfer left the order in the sender's list forever and never put it
 * in the recipient's. Claiming moves `buyerUserId`, so the ticket leaves one
 * account and appears in the other.
 *
 * The serialized ids are rotated for the same reason the email transfer rotates
 * them: every ticket surface looks a ticket up by serializedId with no further
 * ownership check, so a sender who had already opened or screenshotted the QR
 * would otherwise still hold a scannable copy, and whoever scanned first would
 * win.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  /* Tight, because this endpoint takes a guessable-in-principle secret. The
     keyspace is ~1.1e12 so brute force is hopeless anyway, but a limit is what
     makes that a fact about the system rather than about the arithmetic. Keyed
     on the account, so one member cannot spend another's budget. */
  const limit = await consumeRateLimit(
    rateLimitKey('ticket-claim', session.user.id, null),
    { limit: 12, windowMs: 60 * 60 * 1000 },
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const submitted = typeof (raw as { code?: unknown })?.code === 'string'
    ? (raw as { code: string }).code
    : '';
  const code = normalizeTransferCode(submitted);
  if (!code) {
    return NextResponse.json({ error: "That doesn't look like a transfer code." }, { status: 400 });
  }

  const record = await db.ticketTransferCode.findUnique({
    where: { code },
    select: {
      id: true,
      createdById: true,
      claimedAt: true,
      expiresAt: true,
      ticketOrder: {
        select: {
          id: true,
          status: true,
          buyerUserId: true,
          show: { select: { title: true } },
          tickets: { select: { serializedId: true, status: true } },
        },
      },
    },
  });

  /* Unknown, expired and already-claimed are ONE answer. Telling them apart
     tells a stranger holding a wrong code whether it was ever a real one, which
     is the only signal worth having when guessing. */
  const now = new Date();
  const unusable = !record
    || record.claimedAt !== null
    || record.expiresAt.getTime() <= now.getTime();
  if (unusable) {
    return NextResponse.json(
      { error: 'That code is not valid any more. Ask for a fresh one.' },
      { status: 404 },
    );
  }

  if (record.createdById === session.user.id) {
    return NextResponse.json(
      { error: 'That is your own transfer code — give it to whoever is taking the ticket.' },
      { status: 409 },
    );
  }

  const order = record.ticketOrder;
  if (order.status !== 'CAPTURED') {
    return NextResponse.json({ error: 'That order can no longer be transferred' }, { status: 409 });
  }
  if (order.tickets.some((ticket) => ticket.status === 'SCANNED')) {
    return NextResponse.json(
      { error: 'A ticket in that order has already been scanned' },
      { status: 409 },
    );
  }

  const holderName = session.user.name?.trim() || session.user.email?.split('@')[0] || 'Ticket holder';
  const holderEmail = session.user.email ?? '';

  try {
    const claimed = await db.$transaction(async (tx) => {
      /* Single-use is enforced HERE, as a conditional update, not by the
         `claimedAt === null` read above. Two people submitting the same code at
         the same moment both pass that read; only one can match this write, and
         the loser is told the code is spent rather than both being handed the
         same tickets. Same shape as the ad-impression budget guard and the
         ticket-scan transition. */
      const spend = await tx.ticketTransferCode.updateMany({
        where: { id: record.id, claimedAt: null },
        data: { claimedAt: now, claimedById: session.user.id },
      });
      if (spend.count === 0) return null;

      for (const ticket of order.tickets) {
        await tx.ticket.update({
          where: { serializedId: ticket.serializedId },
          data: {
            serializedId: createSerializedTicketId(),
            holderName,
            holderEmail,
            reassignCount: { increment: 1 },
            reassignedAt: now,
          },
        });
      }

      /* The ownership move. Without this the claimer would hold valid QRs that
         never appear in their account, and the sender would keep the order in
         theirs — which is precisely the defect of the email path. */
      await tx.ticketOrder.update({
        where: { id: order.id },
        data: {
          buyerUserId: session.user.id,
          transferredAt: now,
          transferredToEmail: holderEmail || null,
        },
      });

      return true;
    });

    if (!claimed) {
      return NextResponse.json(
        { error: 'That code was just used by someone else.' },
        { status: 409 },
      );
    }
  } catch (error) {
    log.error('[api/tickets/claim]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'That transfer could not be completed.' }, { status: 500 });
  }

  return NextResponse.json({
    claimed: true,
    orderId: order.id,
    showTitle: order.show.title,
    ticketCount: order.tickets.length,
  });
}
