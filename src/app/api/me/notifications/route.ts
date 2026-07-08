import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/me/notifications — the signed-in user's notification feed.
// Fills DESIGN_SYNC gap row 29/#173: cron jobs (post-show recaps, nearby-show
// alerts, RSVP reminders) have been writing Notification rows with no
// user-facing way to read them.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === '1';
  const take = Math.min(Math.max(Number(url.searchParams.get('take')) || 50, 1), 100);

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.user.id, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, type: true, body: true, read: true, link: true, createdAt: true }
    }),
    db.notification.count({ where: { userId: session.user.id, read: false } })
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

// POST /api/me/notifications — mark notifications read.
// Body: { ids: string[] } for specific rows, or { all: true } for everything.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { ids?: unknown; all?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (body.all === true) {
    const result = await db.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true }
    });
    return NextResponse.json({ ok: true, updated: result.count });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 100)
    : [];
  if (!ids.length) {
    return NextResponse.json({ error: 'Provide ids: string[] or all: true.' }, { status: 400 });
  }

  // Scoped to the session user so nobody can mark someone else's rows.
  const result = await db.notification.updateMany({
    where: { id: { in: ids }, userId: session.user.id },
    data: { read: true }
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
