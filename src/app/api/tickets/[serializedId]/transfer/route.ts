import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { createSerializedTicketId } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serializedId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const rl = await consumeRateLimit(rateLimitKey('ticket-transfer', session.user.id, null), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { serializedId } = await params;

  let body: { toEmail?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const toEmail = body.toEmail?.trim().toLowerCase();
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const order = await db.ticketOrder.findUnique({
    where: { id: serializedId },
    include: {
      show: { select: { title: true, startsAt: true } },
      tickets: { select: { serializedId: true, holderName: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.buyerUserId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (order.status !== 'CAPTURED') {
    return NextResponse.json({ error: 'Only captured orders can be transferred' }, { status: 400 });
  }

  // Reissue every ticket in the order with a fresh serializedId rather than
  // just emailing the recipient the existing one. Every ticket surface
  // (the QR page, the scan endpoints) looks tickets up by serializedId with
  // no other ownership check, so the original buyer — who may have already
  // opened/screenshotted/printed the QR before initiating this transfer —
  // would otherwise still hold a fully valid, scannable copy after
  // "transferring" it; whoever scanned first would win. Rotating the id
  // makes the old QR 404 immediately, and only the freshly emailed one
  // works. holderName falls back to the recipient's email since a transfer
  // doesn't collect a real name.
  const recipientName = toEmail.split('@')[0];
  const reissued = await db.$transaction(
    order.tickets.map((t) =>
      db.ticket.update({
        where: { serializedId: t.serializedId },
        data: {
          serializedId: createSerializedTicketId(),
          holderName: recipientName,
          holderEmail: toEmail,
          reassignCount: { increment: 1 },
          reassignedAt: new Date(),
        },
        select: { serializedId: true },
      })
    )
  );

  await db.ticketOrder.update({
    where: { id: serializedId },
    data: { transferredAt: new Date(), transferredToEmail: toEmail },
  });

  const ticketList = reissued.map((t) => `• #${t.serializedId}`).join('\n');

  await sendGenericEmail({
    to: toEmail,
    subject: `Ticket transfer: ${order.show.title}`,
    text: `You've received tickets for ${order.show.title}!\n\n${ticketList}\n\nOriginal confirmation: ${order.confirmationCode}`,
    html: `<p>You've received tickets for <strong>${order.show.title}</strong>!</p><ul>${reissued.map((t) => `<li>#${t.serializedId}</li>`).join('')}</ul><p>Confirmation: <strong>${order.confirmationCode}</strong></p>`,
  }).catch(() => {});

  return NextResponse.json({ transferred: true });
}
