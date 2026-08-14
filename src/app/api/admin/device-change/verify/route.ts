import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { db } from '@/lib/db';
import { isDeviceChangeWindow, verifyDeviceOtp, generateDeviceToken, getDeviceCookieName, signDeviceCookieValue } from '@/lib/admin-device';
import { registerAdminDevice } from '@/lib/admin-device-store';

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

  // Adds a device rather than replacing the one on file. Before AdminDevice
  // this was the ONLY way to move the console to another machine, and it is
  // gated to Monday 8-9am Eastern — so a laptop-to-phone swap was a
  // once-a-week, one-hour operation. Registering an additional device no
  // longer needs this route at all; it stays for deliberate rotation.
  await registerAdminDevice(session.user.id, deviceToken, 'Changed device');

  await db.auditLog.create({
    data: {
      action: 'admin_device_changed',
      entityType: 'user',
      entityId: session.user.id,
      actorUserId: session.user.id,
    },
  }).catch(() => {});

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getDeviceCookieName(), signDeviceCookieValue(deviceToken), {
    httpOnly: true,
    secure: true,
    // Lax for the same reason as the setup path in
    // src/app/api/admin/device-register/route.ts: a Strict cookie is withheld
    // on arrival from an email link, which is exactly how this one is issued.
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
