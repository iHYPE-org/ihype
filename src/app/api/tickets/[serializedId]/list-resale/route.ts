import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ serializedId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { serializedId } = await params;
    const { resalePriceCents } = await request.json() as { resalePriceCents: number };

    const ticket = await db.ticket.findUnique({
      where: { serializedId },
      select: { id: true, status: true, ticketOrder: { select: { buyerUserId: true } }, show: { select: { ticketPriceCents: true } } }
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    if (ticket.ticketOrder.buyerUserId !== session.user.id) return NextResponse.json({ error: 'Not your ticket.' }, { status: 403 });
    if (ticket.status !== 'VALID') return NextResponse.json({ error: 'Ticket is not eligible for resale.' }, { status: 400 });
    if (resalePriceCents > (ticket.show?.ticketPriceCents ?? 0) * 1.1) {
      return NextResponse.json({ error: 'Resale price cannot exceed 110% of original price.' }, { status: 400 });
    }

    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: 'TICKET_RESALE_LISTED',
        entityType: 'Ticket',
        entityId: ticket.id,
        metadata: { serializedId, resalePriceCents }
      }
    });

    return NextResponse.json({ ok: true, message: 'Ticket listed for resale. Buyers will be notified.' });
  } catch (err) {
    console.error('[api/tickets/[serializedId]/list-resale] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
