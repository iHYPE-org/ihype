import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { getDeviceCookieName } from '@/lib/admin-device';
import { isRegisteredAdminDevice } from '@/lib/admin-device-store';

// Exempt paths: device setup/register/change endpoints don't require an already-registered device
const DEVICE_EXEMPT = [
  '/api/admin/device-setup',
  // The lockout-recovery route: requiring a registered device to ask for a
  // device registration link would be a closed loop.
  '/api/admin/device-reissue',
  '/api/admin/device-register',
  '/api/admin/device-change',
  '/api/admin/device-change/verify',
];

export async function requireAdminApi(request?: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || !isAdminSession(session)) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    };
  }

  // Device cookie check for non-exempt endpoints
  if (request) {
    const pathname = new URL(request.url).pathname;
    const isExempt = DEVICE_EXEMPT.some(p => pathname === p || pathname.startsWith(p + '/'));
    if (!isExempt) {
      const deviceCookie = request.cookies.get(getDeviceCookieName())?.value;
      const isDeviceValid = await isRegisteredAdminDevice(session.user.id, deviceCookie);
      if (!isDeviceValid) {
        return {
          session: null,
          response: NextResponse.json({ error: 'Unrecognized device.' }, { status: 403 })
        };
      }
    }
  }

  return { session, response: null };
}
