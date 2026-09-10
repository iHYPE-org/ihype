import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canWorkTheDoor, DOOR_SHOW_SELECT } from '@/lib/door-access';
import { DOOR_MANIFEST_VERSION, hashTicketCode, type DoorManifest } from '@/lib/door-manifest';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * The guest list a door phone downloads before it loses signal.
 *
 * Every ticket to the show, as a hash of its code plus the holder's name for
 * the ones still VALID, and hashes only for the ones already SCANNED. Never
 * a `serializedId`: that is the credential, and this response lands on a
 * phone that gets handed around a doorway. See `src/lib/door-manifest.ts` for
 * the two rules.
 *
 * Gated to the people who may work the door (`canWorkTheDoor`), answered
 * `private, no-store` because it is one show's whole attendance, and rate
 * limited because it reads every ticket row: a door refreshes its list a few
 * times a night, not a few times a second.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { showId } = await params;
  const show = await db.show.findFirst({
    where: { OR: [{ id: showId }, { slug: showId }] },
    select: DOOR_SHOW_SELECT,
  });
  if (!show) {
    return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  }
  if (!canWorkTheDoor(session, show)) {
    return NextResponse.json({ error: 'Only the show\'s organizer can download the door list.' }, { status: 403 });
  }

  const rate = await consumeRateLimit(rateLimitKey('door-manifest', session.user.id, null), {
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many downloads. Try again in a few minutes.' }, { status: 429 });
  }

  const tickets = await db.ticket.findMany({
    where: { showId: show.id, status: { in: ['VALID', 'SCANNED'] } },
    select: { serializedId: true, holderName: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  const valid: DoorManifest['valid'] = [];
  const scanned: string[] = [];
  for (const ticket of tickets) {
    const h = await hashTicketCode(show.id, ticket.serializedId);
    if (ticket.status === 'VALID') valid.push({ h, name: ticket.holderName });
    else scanned.push(h);
  }

  const manifest: DoorManifest = {
    v: DOOR_MANIFEST_VERSION,
    showId: show.id,
    showSlug: show.slug,
    title: show.title,
    startsAt: show.startsAt.toISOString(),
    fetchedAt: new Date().toISOString(),
    valid,
    scanned,
  };

  return NextResponse.json(manifest, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
