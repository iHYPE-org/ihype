import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const MAX_DEVICES_PER_USER = 10;

/**
 * Registers a native (iOS/Android) push token from the Capacitor shell —
 * see src/components/NativePushRegistration.tsx, which calls this once the
 * native runtime hands back a real APNs/FCM token. Mirrors the existing
 * /api/push/subscribe (Web Push) route's shape and device-cap behavior.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: { token?: string; platform?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  const { token, platform } = body;
  if (!token || (platform !== 'IOS' && platform !== 'ANDROID')) {
    return NextResponse.json({ error: 'token and platform (IOS|ANDROID) are required.' }, { status: 400 });
  }
  if (token.length > 1024) {
    return NextResponse.json({ error: 'token too long.' }, { status: 400 });
  }

  const existing = await db.nativeDeviceToken.count({ where: { userId: session.user.id } });
  if (existing >= MAX_DEVICES_PER_USER) {
    const oldest = await db.nativeDeviceToken.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (oldest) await db.nativeDeviceToken.delete({ where: { id: oldest.id } });
  }

  /* RE-HOMED TO WHOEVER IS SIGNED IN ON THE DEVICE (2026-09-24, row 513).
     This refused a token bound to another account, copying the Web Push
     rule — but a native token is handed out only to this app on this phone,
     and a push always lands on the phone that holds it. So the refusal did
     not protect anyone: it left the previous account's pushes arriving on a
     phone someone else now uses, and gave the account signed in on it none.
     Re-homing can only ever move pushes TO the device's current user. */
  await db.nativeDeviceToken.upsert({
    where: { token },
    create: { userId: session.user.id, token, platform },
    update: { userId: session.user.id, platform },
  });

  return NextResponse.json({ ok: true });
}

/** Sign-out from the native shell (`unregisterNativePushDevice`), so a shared
 *  device stops receiving the signed-out account's pushes. Only the caller's
 *  own binding is removed. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }
  if (typeof body.token !== 'string' || !body.token || body.token.length > 1024) {
    return NextResponse.json({ error: 'token is required.' }, { status: 400 });
  }
  await db.nativeDeviceToken.deleteMany({ where: { token: body.token, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
