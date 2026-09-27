import { isAllowedAdminEmail } from '@/lib/admin-allowlist';
import { generateDeviceToken, getDeviceCookieName, signDeviceCookieValue } from '@/lib/admin-device';
import { isRegisteredAdminDevice, registerAdminDevice } from '@/lib/admin-device-store';
import { markAdminReauth } from '@/lib/admin-confirmation';
import { recordAuditEvent } from '@/lib/audit';
import { log } from '@/lib/logger';

/**
 * ONE PASSKEY OPENS THE CONSOLE (owner, 2026-09-27: "When I log into the
 * admin account on my iOS device, it takes me on a long run around to
 * authenticate and ultimately doesn't let me in. I want to be able to use a
 * passkey.").
 *
 * Until this, an administrator on a new device used a passkey TWICE: once to
 * sign in, then again on `/admin/device-register` to bind the device, because
 * the binding ceremony (`/api/admin/device-passkey`) was its own route. Both
 * are a fresh WebAuthn assertion by a credential registered to the same
 * account, so the second proved nothing the first had not. A passkey sign-in
 * by an administrator now binds the device and arms the step-up window in the
 * same response.
 *
 * What is deliberately NOT covered: a MAGIC-LINK sign-in. The inbox is not a
 * passkey (the owner's 2026-08-24 rule: "passkey only security"), so an
 * administrator arriving by link still meets `/admin/device-register`, whose
 * one control is the passkey.
 *
 * It never fails a sign-in. A binding that cannot be written costs the
 * administrator one more tap on the register page; a sign-in that errors
 * because of it costs them the account.
 */

export function adminDeviceLabel(userAgent: string): string {
  if (/iPhone/i.test(userAgent)) return 'iPhone';
  if (/iPad/i.test(userAgent)) return 'iPad';
  if (/Android/i.test(userAgent)) return 'Android device';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'Mac';
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Linux/i.test(userAgent)) return 'Linux device';
  return 'Unknown device';
}

export type AdminDeviceCookie = {
  name: string;
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
};

export function adminDeviceCookie(value: string): AdminDeviceCookie {
  return {
    name: getDeviceCookieName(),
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  };
}

/**
 * Called after a passkey assertion has been VERIFIED for `user`. Returns the
 * device cookie to set, or null when the user is not an administrator, the
 * device is already registered, or the write failed.
 */
export async function bindAdminDeviceAfterPasskey(input: {
  user: { id: string; role: string | null; email: string | null };
  existingDeviceCookie: string | null | undefined;
  userAgent: string;
  ipAddress?: string | null;
}): Promise<AdminDeviceCookie | null> {
  const { user } = input;
  if (user.role !== 'ADMIN' || !isAllowedAdminEmail(user.email)) return null;

  // The step-up window: a passkey was just presented, so the first
  // destructive action does not ask for it again. Best-effort by design.
  await markAdminReauth(user.id);

  try {
    if (await isRegisteredAdminDevice(user.id, input.existingDeviceCookie)) return null;

    const token = generateDeviceToken();
    await registerAdminDevice(user.id, token, `${adminDeviceLabel(input.userAgent)} (passkey sign-in)`);
    await recordAuditEvent({
      actorUserId: user.id,
      action: 'admin_device_registered_passkey',
      entityType: 'user',
      entityId: user.id,
      ipAddress: input.ipAddress ?? null,
      metadata: { via: 'sign-in' },
    });
    return adminDeviceCookie(signDeviceCookieValue(token));
  } catch (error) {
    log.error('admin passkey sign-in: device binding failed', error instanceof Error ? error : { error: String(error) });
    return null;
  }
}
