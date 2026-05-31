import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';

export const AUTH_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

type AuthSessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  emailVerified?: Date | string | null;
  userSecurityVersion?: number;
};

export function getAuthSessionCookieName() {
  return process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
}

function getEmailVerifiedIso(emailVerified: AuthSessionUser['emailVerified']) {
  if (!emailVerified) return null;
  return emailVerified instanceof Date ? emailVerified.toISOString() : emailVerified;
}

async function readUserSecurityVersion(user: AuthSessionUser) {
  if (typeof user.userSecurityVersion === 'number') {
    return user.userSecurityVersion;
  }

  try {
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { userSecurityVersion: true }
    });

    return dbUser?.userSecurityVersion ?? null;
  } catch (err) {
    console.error('[auth-session] Unable to read user security version:', err);
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
      jti: crypto.randomUUID()
    },
    secret,
    salt: cookieName
  });

  return {
    name: cookieName,
    value,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS
  };
}
