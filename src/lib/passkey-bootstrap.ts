import { createHash, randomBytes } from 'crypto';

export const PASSKEY_BOOTSTRAP_MAX_AGE_SECONDS = 10 * 60;

export function getPasskeyBootstrapCookieName() {
  return process.env.NODE_ENV === 'production'
    ? '__Host-ihype-passkey-bootstrap'
    : 'ihype-passkey-bootstrap';
}

export function getPasskeyBootstrapCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: PASSKEY_BOOTSTRAP_MAX_AGE_SECONDS,
  };
}

export function hashPasskeyBootstrapToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createPasskeyBootstrapCapability(now = new Date()) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashPasskeyBootstrapToken(token),
    expiresAt: new Date(now.getTime() + PASSKEY_BOOTSTRAP_MAX_AGE_SECONDS * 1000),
  };
}
