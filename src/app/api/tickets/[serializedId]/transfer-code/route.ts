import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import {
  TRANSFER_CODE_TTL_MS,
  createTransferCode,
  formatTransferCode,
} from '@/lib/ticket-transfer-code';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/tickets/[serializedId]/transfer-code` — mint the code that hands
 * this order to another account.
 *
 * NOTE ON THE PARAM NAME: `serializedId` here is the TicketOrder id, not a
 * ticket's serialized id. That is inherited from the sibling `transfer/` route,
 * which looks up `db.ticketOrder.findUnique({ where: { id: serializedId } })`
 * under the same param, and the two are kept identical on purpose — a member
 * reaching this from the same page must not have to know that one of the two
 * transfer buttons means something different by the id in the URL.
 *
 * Ownership is `buyerUserId`, matching the email transfer, because that is the
 * column every ticket list is scoped by and therefore the only one that means
 * "this is mine".
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ serializedId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  /* Same budget as the email transfer. Minting is cheap but it is not free:
     each code is a live bearer claim on a paid ticket, and an unbounded mint
     loop would leave a trail of them. */
  const limit = await consumeRateLimit(
    rateLimitKey('ticket-transfer-code', session.user.id, null),
    { limit: 10, windowMs: 60 * 60 * 1000 },
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { serializedId: orderId } = await params;

  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerUserId: true,
      status: true,
      tickets: { select: { status: true } },
    },
  });

  if (!order || order.buyerUserId !== session.user.id) {
    /* One answer for missing and not-yours: a distinct 403 would confirm that
       an order id exists, and order ids are the only thing an attacker has to
       guess here. */
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status !== 'CAPTURED') {
    return NextResponse.json(
      { error: 'Only a paid order can be transferred' },
      { status: 400 },
    );
  }

  /* A scanned ticket has already been used to get through the door, and
     reissuing it hands over something that cannot be scanned again — the
     recipient would receive a dead ticket and find out at the venue. The email
     transfer does NOT check this, which is a real gap in that route; it is
     checked here rather than nowhere, and noted so the same guard can be added
     there. */
  if (order.tickets.some((ticket) => ticket.status === 'SCANNED')) {
    return NextResponse.json(
      { error: 'A ticket in this order has already been scanned, so it cannot be transferred' },
      { status: 409 },
    );
  }

  const code = createTransferCode();
  const expiresAt = new Date(Date.now() + TRANSFER_CODE_TTL_MS);

  /* Minting ROTATES: any previous unclaimed code for this order is expired on
     the spot. Otherwise every code a member ever generated stays live for its
     full three days, so a code shown to the wrong person and then re-minted
     would still work — the member would reasonably believe generating a new one
     had replaced the old. Done in a transaction so there is no instant where
     both the old and new codes are live. */
  await db.$transaction([
    db.ticketTransferCode.updateMany({
      where: { ticketOrderId: order.id, claimedAt: null },
      data: { expiresAt: new Date() },
    }),
    db.ticketTransferCode.create({
      data: { code, ticketOrderId: order.id, createdById: session.user.id, expiresAt },
    }),
  ]);

  return NextResponse.json(
    { code: formatTransferCode(code), expiresAt: expiresAt.toISOString() },
    /* Never cached, by anything: this is a bearer credential and a shared cache
       in front of it would hand one member's code to another. */
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
