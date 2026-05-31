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
  const timestampMs = Number(svixTimestamp) * 1000;
  if (!svixId || !Number.isFinite(timestampMs)) {
    return false;
  }

  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > toleranceMs) {
    return false;
  }

  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const hmac = createHmac('sha256', secret).update(toSign).digest('base64');
  const expected = `v1,${hmac}`;
  const signatures = svixSignature.split(' ');
  return signatures.some((sig) => constantTimeEqual(sig, expected));
}
