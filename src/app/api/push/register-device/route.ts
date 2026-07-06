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

  await db.nativeDeviceToken.upsert({
    where: { token },
    create: { userId: session.user.id, token, platform },
    update: { userId: session.user.id, platform },
  });

  return NextResponse.json({ ok: true });
}

/** Called on sign-out from the native shell so a shared/reset device stops receiving another user's pushes. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let token: string;
  try {
    const body = await request.json();
    token = body.token;
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  if (!token) return NextResponse.json({ error: 'token required.' }, { status: 400 });

  await db.nativeDeviceToken.deleteMany({ where: { token, userId: session.user.id } });

  return NextResponse.json({ ok: true });
}
