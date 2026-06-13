import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { db } from '@/lib/db';
import { isDeviceChangeWindow, createDeviceOtp, hashDeviceToken, getDeviceCookieName } from '@/lib/admin-device';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Request a device change OTP. Only works Monday 08:00–08:59 America/New_York.
// Must be called from the currently registered device.
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

  const admin = await db.user.findUnique({
    where: { id: session.user.id },
    select: { adminDeviceTokenHash: true },
  });

  // Verify current device cookie matches registered device
  const cookieValue = request.cookies.get(getDeviceCookieName())?.value;
  if (!cookieValue || !admin?.adminDeviceTokenHash) {
    return NextResponse.json({ error: 'No registered device found.' }, { status: 403 });
  }

  const currentHash = crypto.createHash('sha256').update(cookieValue).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(currentHash), Buffer.from(admin.adminDeviceTokenHash))) {
    return NextResponse.json({ error: 'Device not recognized.' }, { status: 403 });
  }

  const otp = createDeviceOtp('admin-device-change');
  const link = `${getBaseUrl()}/admin/device-register?token=${encodeURIComponent(otp)}&mode=change`;

  await sendGenericEmail({
    to: 'admin@ihype.org',
    subject: 'iHYPE admin device change',
    text: `Open this link on your new admin device to complete the device change. It expires in 20 minutes and is only valid today (Monday 8–9 AM ET).\n\n${link}\n\nDo not forward this email. If you did not request this, your account may be compromised.`,
    html: `<p>Open this link on your <strong>new admin device</strong> to complete the device change. It expires in 20 minutes and is only valid today (Monday 8–9 AM ET).</p><p><a href="${link}">${link}</a></p><p>Do not forward this email. If you did not request this, your account may be compromised.</p>`,
  });

  // Log the event — never the OTP value
  await db.auditLog.create({
    data: {
      action: 'admin_device_change_requested',
      entityType: 'user',
      entityId: session.user.id,
      actorUserId: session.user.id,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
