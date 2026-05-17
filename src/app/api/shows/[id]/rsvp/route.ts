import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

async function countRsvps(showId: string) {
  // De-dupe by actor to count distinct attendees.
  const rows = await db.auditLog.findMany({
    where: { action: 'show_rsvp', entityType: 'show', entityId: showId },
    select: { actorUserId: true, metadata: true }
  });
  const active = rows.filter((r) => {
    const meta = (r.metadata ?? {}) as { state?: string };
    return meta.state !== 'cancelled';
  });
  const seen = new Set<string>();
  for (const r of active) {
    if (r.actorUserId) seen.add(r.actorUserId);
  }
  return seen.size;
}

async function getUserRsvp(showId: string, userId: string): Promise<boolean> {
  const last = await db.auditLog.findFirst({
    where: {
      action: 'show_rsvp',
      entityType: 'show',
      entityId: showId,
      actorUserId: userId
    },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true }
  });
  if (!last) return false;
  const meta = (last.metadata ?? {}) as { state?: string };
  return meta.state !== 'cancelled';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to RSVP.' }, { status: 401 });
  }
  const clientAddress = readClientAddress(request);
  const rate = await consumeRateLimit(`show-rsvp:${session.user.id}`, {
    limit: 30,
    windowMs: 60 * 60 * 1000
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many RSVP toggles.' }, { status: 429 });
  }

  const { id: showId } = await params;
  const show = await db.show.findUnique({ where: { id: showId }, select: { id: true } });
  if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });

  const wasGoing = await getUserRsvp(show.id, session.user.id);
  const nextState = wasGoing ? 'cancelled' : 'going';
  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'show_rsvp',
    entityType: 'show',
    entityId: show.id,
    ipAddress: clientAddress,
    metadata: { showId: show.id, state: nextState }
  });

  const count = await countRsvps(show.id);
  return NextResponse.json({ going: !wasGoing, count });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id: showId } = await params;
  const [count, going] = await Promise.all([
    countRsvps(showId),
    session?.user?.id ? getUserRsvp(showId, session.user.id) : Promise.resolve(false)
  ]);
  return NextResponse.json({ going, count });
}
