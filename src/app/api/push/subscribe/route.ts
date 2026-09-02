import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const MAX_SUBSCRIPTIONS_PER_USER = 10;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let sub: { endpoint: string; keys: { auth: string; p256dh: string }; pushGenre?: string; pushCity?: string };
  try {
    sub = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  if (!sub?.endpoint || !sub?.keys?.auth || !sub?.keys?.p256dh) {
    return NextResponse.json({ error: 'Missing subscription fields.' }, { status: 400 });
  }
  if (sub.endpoint.length > 2048 || sub.keys.auth.length > 256 || sub.keys.p256dh.length > 256) {
    return NextResponse.json({ error: 'Subscription fields too long.' }, { status: 400 });
  }
  const pushGenre = typeof sub.pushGenre === 'string' ? sub.pushGenre.slice(0, 64) : undefined;
  const pushCity  = typeof sub.pushCity  === 'string' ? sub.pushCity.slice(0, 100) : undefined;

  const existing = await db.pushSubscription.count({ where: { userId: session.user.id } });
  if (existing >= MAX_SUBSCRIPTIONS_PER_USER) {
    // Remove the oldest subscription to make room before adding the new one
    const oldest = await db.pushSubscription.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (oldest) await db.pushSubscription.delete({ where: { id: oldest.id } });
  }

  /* An endpoint already bound to ANOTHER account is refused rather than
     re-homed (second security scan, 2026-09-02): the upsert used to overwrite
     `userId`, so whoever learned a member's push endpoint could take their
     device's notifications. */
  const boundTo = await db.pushSubscription.findUnique({ where: { endpoint: sub.endpoint }, select: { userId: true } });
  if (boundTo && boundTo.userId !== session.user.id) {
    return NextResponse.json({ error: 'This device is registered to another account.' }, { status: 409 });
  }
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId: session.user.id,
      endpoint: sub.endpoint,
      auth: sub.keys.auth,
      p256dh: sub.keys.p256dh,
      ...(pushGenre !== undefined ? { pushGenre } : {}),
      ...(pushCity  !== undefined ? { pushCity  } : {}),
    },
    update: {
      userId: session.user.id,
      auth: sub.keys.auth,
      p256dh: sub.keys.p256dh,
      ...(pushGenre !== undefined ? { pushGenre } : {}),
      ...(pushCity  !== undefined ? { pushCity  } : {}),
    }
  });

  return NextResponse.json({ ok: true });
}
