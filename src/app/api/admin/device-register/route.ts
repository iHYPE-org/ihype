import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { db } from '@/lib/db';
import { verifyDeviceOtp, generateDeviceToken, hashDeviceToken, getDeviceCookieName } from '@/lib/admin-device';

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
  const tokenHash = hashDeviceToken(deviceToken);

  await db.user.update({
    where: { id: session.user.id },
    data: { adminDeviceTokenHash: tokenHash, adminDeviceSetAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      action: 'admin_device_registered',
      entityType: 'user',
      entityId: session.user.id,
      actorUserId: session.user.id,
    },
  }).catch(() => {});

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getDeviceCookieName(), deviceToken, {
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
