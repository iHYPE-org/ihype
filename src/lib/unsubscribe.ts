import { createHmac } from 'crypto';
import { constantTimeEqual } from '@/lib/secret-compare';
import { currentSigningSecret, readSigningSecrets } from '@/lib/signing-secrets';

// Tokens are HMAC-SHA256(AUTH_SECRET, `${userId}:${PURPOSE}`) so they can be
// verified without a database lookup and keep working while logged out.
// They intentionally never expire — an unsubscribe link in an old email must
// always work. That is also why verification tries every key in the rotation
// window (signing-secrets.ts): a link in an email sent before the secret
// rotated is exactly the link most likely to be clicked after it.
const PURPOSE = 'email-unsubscribe';

function signUserId(userId: string, key: string): string {
  return createHmac('sha256', key).update(`${userId}:${PURPOSE}`).digest('hex');
}

export function createUnsubscribeToken(userId: string): string {
  const key = currentSigningSecret();
  if (!key) throw new Error('AUTH_SECRET is not configured.');
  return `${userId}.${signUserId(userId, key)}`;
}

/**
 * Returns the userId embedded in the token when the signature is valid,
 * otherwise null. Uses a constant-time comparison.
 */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  const separator = token.lastIndexOf('.');
  if (separator <= 0 || separator === token.length - 1) {
    return null;
  }

  const userId = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  return readSigningSecrets().some((key) => constantTimeEqual(signature, signUserId(userId, key))) ? userId : null;
}
