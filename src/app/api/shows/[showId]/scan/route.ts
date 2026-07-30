import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { awardHype } from '@/lib/hype-ledger';
import { log } from '@/lib/logger';

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
  if (ticket.status === 'VOID') {
    return NextResponse.json({ error: 'Ticket is void.', valid: false }, { status: 410 });
  }

  // Atomic check-and-set — the find above is only for the 404/VOID error
  // messages above; the actual VALID→SCANNED transition is guarded here so
  // two concurrent scans of the same ticket can't both succeed (only one
  // updateMany can ever match status: 'VALID' and flip it first).
  const scannedAt = new Date();
  const result = await db.ticket.updateMany({
    where: { id: ticket.id, status: 'VALID' },
    data: { status: 'SCANNED', scannedAt, scannedByUserId: session.user.id }
  });
  if (result.count !== 1) {
    return NextResponse.json({ error: 'Ticket already scanned.', valid: false, scannedAt: ticket.scannedAt }, { status: 409 });
  }

  const attendee = await db.user.findUnique({
    where: { email: ticket.holderEmail.toLowerCase() },
    select: { id: true },
  });
  let hypeAwarded = 0;
  if (attendee) {
    try {
      const reward = await awardHype({
        userId: attendee.id,
        amount: 5,
        source: 'EVENT_ATTENDED',
        idempotencyKey: `event-attended:${ticket.id}`,
        targetType: 'show',
        targetId: showId,
        dailyLimit: 25,
        metadata: { ticketId: ticket.id },
      });
      hypeAwarded = reward.applied ? reward.entry?.amount ?? 0 : 0;
    } catch (error) {
      log.error(
        '[show-scan]',
        error instanceof Error ? error : { error: String(error) },
        `Attendance HYPE award failed for ticket ${ticket.id}`,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    valid: true,
    ticket: { id: ticket.id, holderName: ticket.holderName, scannedAt },
    hypeAwarded,
  });
}
