import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketOrderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { ticketOrderId } = await params;

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
    where: { id: ticketOrderId },
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

  await db.ticketOrder.update({
    where: { id: ticketOrderId },
    data: { transferredAt: new Date(), transferredToEmail: toEmail },
  });

  const ticketList = order.tickets
    .map((t) => `• ${t.holderName} — #${t.serializedId}`)
    .join('\n');

  await sendGenericEmail({
    to: toEmail,
    subject: `Ticket transfer: ${order.show.title}`,
    text: `You've received tickets for ${order.show.title}!\n\n${ticketList}\n\nOriginal confirmation: ${order.confirmationCode}`,
    html: `<p>You've received tickets for <strong>${order.show.title}</strong>!</p><ul>${order.tickets.map((t) => `<li>${t.holderName} — #${t.serializedId}</li>`).join('')}</ul><p>Confirmation: <strong>${order.confirmationCode}</strong></p>`,
  }).catch(() => {});

  return NextResponse.json({ transferred: true });
}
