import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { isAllowedAdminEmail } from '@/lib/admin-allowlist';
import { getPasskeyAuthenticationOptions, verifyPasskeyAuthentication } from '@/lib/passkey';
import { generateDeviceToken, getDeviceCookieName, signDeviceCookieValue } from '@/lib/admin-device';
import { registerAdminDevice } from '@/lib/admin-device-store';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { recordAuditEvent } from '@/lib/audit';
import { log } from '@/lib/logger';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export const dynamic = 'force-dynamic';

const CHALLENGE_COOKIE = 'admin_pk_challenge';

/**
 * Register the current browser as an admin device with a PASSKEY, not an
 * email (owner, 2026-08-24: "Admin Mode needs passkey only security, and
 * doesn't need email access requirement").
 *
 * The console's device binding used to have exactly one way in: an emailed
 * one-time link (`/api/admin/device-reissue`). That made the admin's INBOX
 * the root of trust for the console — weaker than the passkey the admin
 * already signs in with, and a dependency on email delivery for the one
 * account that administrates email problems. A fresh WebAuthn assertion is
 * the stronger proof: phishing-resistant, presence-verified, and it cannot
 * be forwarded the way a link can.
 *
 * Three things must hold at once, same bar as the email path it supersedes:
 *  1. a live session that is an administrator (role + allowlist);
 *  2. a passkey REGISTERED TO THAT SAME ACCOUNT — the assertion's resolved
 *     user is compared to the session's, so an attacker with a stolen admin
 *     session still cannot bind a device with their own passkey;
 *  3. the ceremony itself, against a single-use five-minute challenge.
 *
 * The emailed path stays for genuine recovery (a lost authenticator), but it
 * is no longer a requirement on the normal road into the console.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session) || !isAllowedAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const rl = await consumeRateLimit(`admin-device-pk:${readClientAddress(request) ?? 'unknown'}`, {
    limit: 10, windowMs: 60 * 1000, timeoutMs: 2500,
  });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });

  // Scoped to the admin's own credentials — this is not a discoverable
  // ceremony; the whole point is proving THIS account's key is present.
  const options = await getPasskeyAuthenticationOptions(session.user.id);
  if (!options.allowCredentials?.length) {
    return NextResponse.json(
      { error: 'No passkey on the admin account yet — register one in Settings first.' },
      { status: 400 },
    );
  }
  const response = NextResponse.json(options);
  response.cookies.set(CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });
  return response;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session) || !isAllowedAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const rl = await consumeRateLimit(`admin-device-pk:${readClientAddress(request) ?? 'unknown'}`, {
    limit: 10, windowMs: 60 * 1000, timeoutMs: 2500,
  });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });

  const challenge = request.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) return NextResponse.json({ error: 'The passkey challenge expired — try again.' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as AuthenticationResponseJSON | null;
  if (!body?.id) return NextResponse.json({ error: 'Invalid passkey response.' }, { status: 400 });

  try {
    // Returns the credential owner's userId, or null. The assertion must
    // resolve to the SIGNED-IN admin, not merely to some valid account — see
    // the header note.
    const verifiedUserId = await verifyPasskeyAuthentication(body, challenge);
    if (!verifiedUserId || verifiedUserId !== session.user.id) {
      return NextResponse.json({ error: 'That passkey does not belong to this admin account.' }, { status: 403 });
    }
  } catch (error) {
    log.error('admin device-passkey: verification failed', { error });
    return NextResponse.json({ error: 'Passkey verification failed.' }, { status: 400 });
  }

  const ua = request.headers.get('user-agent') ?? '';
  const label = /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
    : /Android/i.test(ua) ? 'Android device'
    : /Macintosh|Mac OS X/i.test(ua) ? 'Mac'
    : /Windows/i.test(ua) ? 'Windows PC'
    : /Linux/i.test(ua) ? 'Linux device'
    : 'Unknown device';

  const deviceToken = generateDeviceToken();
  await registerAdminDevice(session.user.id, deviceToken, `${label} (passkey)`);
  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'admin_device_registered_passkey',
    entityType: 'user',
    entityId: session.user.id,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getDeviceCookieName(), signDeviceCookieValue(deviceToken), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set(CHALLENGE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
