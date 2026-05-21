import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { showId } = await params;
  const show = await db.show.findUnique({ where: { id: showId }, select: { id: true, creatorId: true } });
  if (!show) {
    return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  }
  if (show.creatorId !== session.user.id && !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await request.json();
  const { ticketId } = body as { ticketId?: string };
  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId is required.' }, { status: 400 });
  }

  const ticket = await db.ticket.findFirst({
    where: { showId, serializedId: ticketId }
  });
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found for this show.', valid: false }, { status: 404 });
  }
  if (ticket.status === 'SCANNED' || ticket.scannedAt) {
    return NextResponse.json({ error: 'Ticket already scanned.', valid: false, scannedAt: ticket.scannedAt }, { status: 409 });
  }
  if (ticket.status === 'VOID') {
    return NextResponse.json({ error: 'Ticket is void.', valid: false }, { status: 410 });
  }

  const updated = await db.ticket.update({
    where: { id: ticket.id },
    data: { status: 'SCANNED', scannedAt: new Date(), scannedByUserId: session.user.id }
  });

  return NextResponse.json({ ok: true, valid: true, ticket: { id: updated.id, holderName: updated.holderName, scannedAt: updated.scannedAt } });
}
