import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { db } from '@/lib/db';
import { isDeviceChangeWindow, verifyDeviceOtp, generateDeviceToken, hashDeviceToken, getDeviceCookieName } from '@/lib/admin-device';

export const dynamic = 'force-dynamic';

// Verify device change OTP and register the new device.
// Time window is re-checked here to prevent requesting at 8:58 and verifying at 9:05.
export async function POST(request: NextRequest) {
  if (!isDeviceChangeWindow()) {
    return NextResponse.json(
      { error: 'Device changes are only allowed Monday 8–9 AM Eastern Time.' },
      { status: 403 }
    );
  }

  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { token?: string } | null;
  if (!body?.token || !verifyDeviceOtp(body.token, 'admin-device-change')) {
    return NextResponse.json({ error: 'Invalid or expired change token.' }, { status: 400 });
  }

  const deviceToken = generateDeviceToken();
  const tokenHash = hashDeviceToken(deviceToken);

  await db.user.update({
    where: { id: session.user.id },
    data: { adminDeviceTokenHash: tokenHash, adminDeviceSetAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      action: 'admin_device_changed',
      entityType: 'user',
      entityId: session.user.id,
      actorUserId: session.user.id,
    },
  }).catch(() => {});

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getDeviceCookieName(), deviceToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
