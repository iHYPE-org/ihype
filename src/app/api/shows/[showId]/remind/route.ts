import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { showId: id } = await params;

  const rl = await consumeRateLimit(rateLimitKey('show-remind', session.user.id, null), { limit: 60, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const show = await db.show.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

  // Toggle: check if reminder notification already exists
  const existing = await db.notification.findFirst({
    where: { userId: session.user.id, type: 'show_reminder_pending', link: `/shows/${id}` }
  });

  if (existing) {
    await db.notification.delete({ where: { id: existing.id } });
    return NextResponse.json({ reminded: false });
  }

  await db.notification.create({
    data: {
      userId: session.user.id,
      type: 'show_reminder_pending',
      body: `Reminder set for "${show.title}"`,
      link: `/shows/${id}`,
      read: false
    }
  });

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'show_reminder_set',
    entityType: 'show',
    entityId: id,
    metadata: { showTitle: show.title }
  });

  return NextResponse.json({ reminded: true });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ reminded: false });
  }

  const { showId: id } = await params;
  const existing = await db.notification.findFirst({
    where: { userId: session.user.id, type: 'show_reminder_pending', link: `/shows/${id}` }
  });

  return NextResponse.json({ reminded: Boolean(existing) });
}
