import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/secret-compare';
import { db } from '@/lib/db';
import { createDeviceOtp } from '@/lib/admin-device';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Requires ALLOW_ADMIN_SETUP=true and ADMIN_SETUP_SECRET bearer token.
// Clears any existing device registration and sends a one-time setup link
// to admin@ihype.org. The link itself is never logged.
export async function POST(request: NextRequest) {
  if (process.env.ALLOW_ADMIN_SETUP !== 'true') {
    return NextResponse.json({ error: 'Setup disabled.' }, { status: 410 });
  }

  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret || !verifyBearerToken(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!process.env.ADMIN_DEVICE_SECRET) {
    return NextResponse.json({ error: 'ADMIN_DEVICE_SECRET is not configured.' }, { status: 500 });
  }

  const admin = await db.user.findFirst({
    where: { email: 'admin@ihype.org' },
    select: { id: true },
  });

  if (!admin) {
    return NextResponse.json({ error: 'Admin account not found. Run the account setup first.' }, { status: 404 });
  }

  // Clear existing device registration
  await db.user.update({
    where: { id: admin.id },
    data: { adminDeviceTokenHash: null, adminDeviceSetAt: null },
  });

  const otp = createDeviceOtp('admin-device-setup');
  const link = `${getBaseUrl()}/admin/device-register?token=${encodeURIComponent(otp)}`;

  await sendGenericEmail({
    to: 'admin@ihype.org',
    subject: 'iHYPE admin device setup',
    text: `Open this link on your admin device to complete setup. It expires in 20 minutes.\n\n${link}\n\nDo not forward this email.`,
    html: `<p>Open this link on your admin device to complete setup. It expires in 20 minutes.</p><p><a href="${link}">${link}</a></p><p>Do not forward this email.</p>`,
  });

  // Log the event but never the OTP value
  await db.auditLog.create({
    data: {
      action: 'admin_device_setup_sent',
      entityType: 'user',
      entityId: admin.id,
      actorUserId: admin.id,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
