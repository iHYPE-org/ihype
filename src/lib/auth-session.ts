import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  getAuthSessionCookieName,
  getAuthSessionCookieOptions,
} from '@/lib/auth-cookie';

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

export async function buildAuthSessionCookie(user: AuthSessionUser) {
  const secret = process.env.AUTH_SECRET;
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
