import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { createDeviceOtp } from '@/lib/admin-device';
import { isAllowedAdminEmail, DEFAULT_ADMIN_EMAIL } from '@/lib/admin-allowlist';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { consumeAdminSetupRateLimit } from '@/lib/admin-setup-rate-limit';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Emails a fresh device-registration link to a signed-in administrator.
 *
 * ## Why this exists
 *
 * Losing the admin device cookie used to mean losing `/admin` entirely. The
 * layout redirects an admin without a valid device cookie to
 * `/admin/device-register`, that page needs a one-time token in the URL, and
 * every way to obtain one was gated behind `ALLOW_ADMIN_SETUP` — an
 * environment variable that is (correctly) off in production. So the recovery
 * for "my cookie is gone" was: edit the Worker's environment, curl an endpoint
 * with a bearer secret, click a link within 20 minutes, and turn the variable
 * back off. That happened for real: an admin with a device registered two days
 * earlier arrived from an email link, was bounced to a page reading "No token
 * provided", and could not get back in without Cloudflare access.
 *
 * `/api/admin/device-change` is not that path either — it requires the Monday
 * 08:00–08:59 ET window AND the currently registered device, so it can only
 * ever move a working device, never replace a lost one.
 *
 * ## Why this is safe to open
 *
 * Three things have to be true at once, and the caller must already hold two
 * of them:
 *
 *  1. **A live session that is an administrator.** `isAdminSession()` plus the
 *     allowlist, which permits only `admin@ihype.org` (or `ADMIN_ALLOWED_EMAILS`)
 *     to hold the role at all.
 *  2. **The administrator's own inbox**, because the link is only ever sent to
 *     the signed-in admin's address after it is re-checked against the
 *     allowlist. A caller cannot name a destination.
 *  3. The link itself, which expires in 20 minutes and is single-purpose.
 *
 * That is the same bar `/api/admin/device-change` already sets (admin session +
 * admin inbox), and a strictly lower-risk one than the alternative it replaces:
 * flipping `ALLOW_ADMIN_SETUP` also re-opens `/api/admin/setup`, which can
 * bootstrap a passkey onto the admin account.
 *
 * ## What it deliberately does NOT do
 *
 * It does not clear the existing registration. `/api/admin/device-setup` nulls
 * `adminDeviceTokenHash` before sending, so a link that is never opened leaves
 * the account with no registered device at all — it turns a recoverable state
 * into a worse one. Here the old device keeps working until a new link is
 * actually completed, and `/api/admin/device-register` swaps the hash then.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  // Both checks, not either: `isAdminSession` asks about the role, the
  // allowlist asks whether this address may hold it.
  if (!session?.user?.id || !isAdminSession(session) || !isAllowedAdminEmail(email)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rateLimit = await consumeAdminSetupRateLimit(request);
  if (!rateLimit.allowed) {
    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'admin_device_reissue_rate_limited',
      entityType: 'admin-setup',
      ipAddress: readClientAddress(request),
    });
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  if (!readRuntimeEnv('ADMIN_DEVICE_SECRET')) {
    return NextResponse.json({ error: 'ADMIN_DEVICE_SECRET is not configured.' }, { status: 500 });
  }

  const otp = createDeviceOtp('admin-device-setup');
  const link = `${getBaseUrl()}/admin/device-register?token=${encodeURIComponent(otp)}`;
  // Never the request's idea of who to email — the session's, re-checked above.
  const to = email ?? DEFAULT_ADMIN_EMAIL;

  try {
    await sendGenericEmail({
      to,
      subject: 'iHYPE admin device setup',
      text: `Open this link on the device you want to register. It expires in 20 minutes.\n\n${link}\n\nIf you did not request this, your admin session may be compromised — sign out everywhere and rotate your credentials.`,
      html: `<p>Open this link on the device you want to register. It expires in 20 minutes.</p><p><a href="${link}">${link}</a></p><p>If you did not request this, your admin session may be compromised — sign out everywhere and rotate your credentials.</p>`,
    });
  } catch (err) {
    // A send failure must not read as success: the whole point of this route is
    // that the link arrives.
    log.error('[admin/device-reissue] send failed', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Could not send the link. Try again shortly.' }, { status: 502 });
  }

  // The OTP is never logged, here or in the audit trail.
  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'admin_device_reissue_sent',
    entityType: 'user',
    entityId: session.user.id,
    ipAddress: readClientAddress(request),
  });

  return NextResponse.json({ ok: true, sentTo: to });
}
