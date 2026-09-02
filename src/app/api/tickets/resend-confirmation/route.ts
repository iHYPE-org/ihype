import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { escapeHtml } from '@/lib/html-escape';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const rl = await consumeRateLimit(rateLimitKey('ticket-resend', session.user.id, null), { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

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
      html: `<p>Hi <strong>${escapeHtml(order.buyerName)}</strong>,</p><p>Here are your tickets for <strong>${escapeHtml(order.show.title)}</strong>:</p><ul>${order.tickets.map((t) => `<li>${escapeHtml(t.holderName)} — #${t.serializedId}</li>`).join('')}</ul><p>Confirmation: <strong>${order.confirmationCode}</strong></p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[api/tickets/resend-confirmation]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
