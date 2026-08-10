import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  getAuthSessionCookieName,
  getAuthSessionCookieOptions,
} from '@/lib/auth-cookie';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { IMPERSONATOR_CLAIM } from '@/lib/impersonation';

export { AUTH_SESSION_MAX_AGE_SECONDS, getAuthSessionCookieName } from '@/lib/auth-cookie';

type AuthSessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  emailVerified?: Date | string | null;
  userSecurityVersion?: number;
};

function getEmailVerifiedIso(emailVerified: AuthSessionUser['emailVerified']) {
  if (!emailVerified) return null;
  return emailVerified instanceof Date ? emailVerified.toISOString() : emailVerified;
}

async function readUserSecurityVersion(user: AuthSessionUser) {
  if (typeof user.userSecurityVersion === 'number') return user.userSecurityVersion;

  try {
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { userSecurityVersion: true },
    });
    return dbUser?.userSecurityVersion ?? null;
  } catch (error) {
    log.error('[auth-session]', error instanceof Error ? error : { error: String(error) }, 'Unable to read user security version');
    return null;
  }
}

/**
 * Mints the session cookie for `user`.
 *
 * `impersonatorId` is the real operator's id when an admin is signing in as
 * this account, and is written into the signed token as the `imp` claim — so
 * it cannot be forged by a client, and exiting does not need a second sign-in.
 * Omit it for every ordinary sign-in, which is all of them but one route.
 */
export async function buildAuthSessionCookie(user: AuthSessionUser, impersonatorId?: string) {
  const secret = readRuntimeEnv('AUTH_SECRET');
  if (!secret) return null;

  const cookieName = getAuthSessionCookieName();
  const now = Math.floor(Date.now() / 1000);
  const securityVersion = await readUserSecurityVersion(user);
  if (securityVersion === null) return null;

  const value = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
      role: user.role,
      emailVerified: getEmailVerifiedIso(user.emailVerified),
      securityVersion,
      iat: now,
      exp: now + AUTH_SESSION_MAX_AGE_SECONDS,
      jti: crypto.randomUUID(),
      ...(impersonatorId ? { [IMPERSONATOR_CLAIM]: impersonatorId } : {}),
    },
    secret,
    salt: cookieName,
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  });

  return {
    name: cookieName,
    value,
    ...getAuthSessionCookieOptions(),
  };
}
