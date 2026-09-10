import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canWorkTheDoor, DOOR_SHOW_SELECT } from '@/lib/door-access';
import { resolveScanTimestamp } from '@/lib/door-manifest';
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
  const show = await db.show.findUnique({ where: { id: showId }, select: DOOR_SHOW_SELECT });
  if (!show) {
    return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  }
  /* The venue's owner and the headliner's owner, not only the creator: the
     venue dashboard has always linked its owner here, and a show created by a
     promoter or by the act answered that owner 403 at their own door. Same
     four people as the cancel route, read from one place (`door-access.ts`). */
  if (!canWorkTheDoor(session, show)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await request.json();
  const { ticketId, scannedAt: claimedAt } = body as { ticketId?: string; scannedAt?: unknown };
  if (!ticketId || typeof ticketId !== 'string') {
    return NextResponse.json({ error: 'ticketId is required.' }, { status: 400 });
  }

  /* As typed, or lower-cased: minted ids are lower-case hex and a door types
     `0X…` as easily as `0x…`, while other writers (the e2e fixture's `IHY-…`)
     store upper case that a blanket lower-casing would never find. */
  const typed = ticketId.trim();
  const ticket = await db.ticket.findFirst({
    where: { showId, serializedId: { in: [...new Set([typed, typed.toLowerCase()])] } }
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
  /* A door phone that lost signal posts its scans when the network returns,
     each carrying the moment the fan actually walked in. That is the time the
     record should hold — attendance analytics and a dispute both ask WHEN a
     ticket was used, not when the phone reconnected. Honoured only when
     plausible (past, within a week); otherwise the server clock stands. */
  const scannedAt = resolveScanTimestamp(claimedAt);
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
