import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const order = await db.ticketOrder.findFirst({
    where: { buyerUserId: session.user.id, status: 'CAPTURED' },
    orderBy: { createdAt: 'desc' },
    include: {
      show: { select: { title: true, startsAt: true } },
      tickets: { select: { serializedId: true, holderName: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'No captured ticket orders found' }, { status: 404 });
  }

  const ticketList = order.tickets
    .map((t) => `• ${t.holderName} — #${t.serializedId}`)
    .join('\n');

  await sendGenericEmail({
    to: order.buyerEmail,
    subject: `Your tickets for ${order.show.title}`,
    text: `Hi ${order.buyerName},\n\nHere are your tickets for ${order.show.title}:\n\n${ticketList}\n\nConfirmation: ${order.confirmationCode}\n\nSee you there!`,
    html: `<p>Hi <strong>${order.buyerName}</strong>,</p><p>Here are your tickets for <strong>${order.show.title}</strong>:</p><ul>${order.tickets.map((t) => `<li>${t.holderName} — #${t.serializedId}</li>`).join('')}</ul><p>Confirmation: <strong>${order.confirmationCode}</strong></p>`,
  });

  return NextResponse.json({ ok: true });
}
