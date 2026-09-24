import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { isShowOrganizer, ORGANIZER_SHOW_SELECT } from '@/lib/show-organizer';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const { showId } = await params;
  const show = await db.show.findUnique({ where: { id: showId }, select: { id: true, ...ORGANIZER_SHOW_SELECT } });
  if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  // The organiser rule the show page draws this editor under (row 513) —
  // the creator alone was refused to a venue or headliner owner it showed it to.
  if (!isShowOrganizer(session, show)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const rate = await consumeRateLimit(`show-setlist:${session.user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) return NextResponse.json({ error: 'Too many updates.' }, { status: 429 });

  let body: { tracks?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }
  const tracks = Array.isArray(body.tracks)
    ? body.tracks
        .map((t) => (typeof t === 'string' ? t.trim().slice(0, 200) : ''))
        .filter((t) => t.length > 0)
        .slice(0, 100)
    : [];

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'show_setlist',
    entityType: 'show',
    entityId: show.id,
    ipAddress: readClientAddress(request),
    metadata: { showId: show.id, tracks }
  });

  return NextResponse.json({ ok: true, tracks });
}
