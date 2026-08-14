import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { db } from '@/lib/db';
import { verifyDeviceOtp, generateDeviceToken, getDeviceCookieName, signDeviceCookieValue } from '@/lib/admin-device';
import { registerAdminDevice } from '@/lib/admin-device-store';

/**
 * A name for the device, so a list of them can be revoked meaningfully.
 *
 * Derived from the user agent rather than asked for: the registration link is
 * opened once, often on a phone, and a form field there is a step between the
 * operator and the console. Coarse on purpose — this labels a row in a list,
 * it is not fingerprinting, and it is never used to decide access.
 */
function deviceLabel(request: NextRequest): string {
  const ua = request.headers.get('user-agent') ?? '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android device';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux device';
  return 'Unknown device';
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { token?: string } | null;
  if (!body?.token || !verifyDeviceOtp(body.token, 'admin-device-setup')) {
    return NextResponse.json({ error: 'Invalid or expired setup token.' }, { status: 400 });
  }

  const deviceToken = generateDeviceToken();

  // An INSERT, not an overwrite. This write used to replace the single
  // `User.adminDeviceTokenHash`, so registering a phone silently signed the
  // laptop out of the console.
  await registerAdminDevice(session.user.id, deviceToken, deviceLabel(request));

  await db.auditLog.create({
    data: {
      action: 'admin_device_registered',
      entityType: 'user',
      entityId: session.user.id,
      actorUserId: session.user.id,
    },
  }).catch(() => {});

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getDeviceCookieName(), signDeviceCookieValue(deviceToken), {
    httpOnly: true,
    secure: true,
    // Lax, not Strict. Strict withholds the cookie on every cross-site
    // navigation — including a click from webmail — so an administrator
    // arriving from their own sign-in email presented as an UNREGISTERED
    // device and was bounced to the registration page. This cookie is only
    // ever read on a GET navigation and is checked alongside a session, so
    // Strict bought nothing here and cost the email entry path.
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
