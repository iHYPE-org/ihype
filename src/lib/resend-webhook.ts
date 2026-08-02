import { createHmac } from 'crypto';
import { constantTimeEqual } from '@/lib/secret-compare';

export function verifyResendSignature(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
  toleranceMs = 300_000
): boolean {
  // Resend uses Svix signatures. The `whsec_` value shown in the Resend
  // dashboard is not the HMAC key itself: the portion after the prefix is a
  // base64-encoded key. Hashing with the literal dashboard value rejects every
  // legitimate delivery after a secret rotation.
  const encodedSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  if (!encodedSecret || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedSecret)) {
    return false;
  }

  const signingKey = Buffer.from(encodedSecret, 'base64');
  if (signingKey.length < 16) {
    return false;
  }

  const timestampMs = Number(svixTimestamp) * 1000;
  if (!svixId || !Number.isFinite(timestampMs)) {
    return false;
  }

  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > toleranceMs) {
    return false;
  }

  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const hmac = createHmac('sha256', signingKey).update(toSign).digest('base64');
  const expected = `v1,${hmac}`;
  const signatures = svixSignature.split(' ');
  return signatures.some((sig) => constantTimeEqual(sig, expected));
}
