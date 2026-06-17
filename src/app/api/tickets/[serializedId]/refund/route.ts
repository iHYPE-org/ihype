import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ serializedId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const rl = await consumeRateLimit(rateLimitKey('ticket-refund', session.user.id, null), { limit: 5, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { serializedId } = await params;

  const order = await db.ticketOrder.findUnique({
    where: { id: serializedId },
    include: { show: { select: { title: true } } },
  });

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.buyerUserId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (order.status === 'VOID') return NextResponse.json({ error: 'Order already voided' }, { status: 409 });

  const supportRequest = await db.supportRequest.create({
    data: {
      requesterUserId: session.user.id,
      type: 'TICKET_REFUND',
      subject: `Refund request for order ${serializedId}`,
      details: `Show: ${order.show?.title ?? serializedId}. Amount paid: $${(order.subtotalCents / 100).toFixed(2)}.`,
      priority: 'HIGH',
      status: 'OPEN',
    },
  });

  return NextResponse.json({ submitted: true, ticketId: supportRequest.id });
}
