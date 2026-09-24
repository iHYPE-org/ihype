import { readRuntimeEnv } from '@/lib/runtime-env';
import { log } from '@/lib/logger';

/* Codes that mean OUR configuration is wrong, not that the visitor is a bot
   (2026-09-24, DESIGN_SYNC row 513). With a wrong or rotated secret every
   signup and every ticket purchase is refused, and until this read nothing
   said why. */
const CONFIGURATION_ERRORS = new Set(['missing-input-secret', 'invalid-input-secret']);

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = readRuntimeEnv('TURNSTILE_SECRET_KEY');
  if (!secret) return process.env.NODE_ENV !== 'production';

  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      log.error('[turnstile]', new Error(`siteverify answered HTTP ${res.status}`), 'Bot check could not be verified');
      return false;
    }
    const data = await res.json() as { success: boolean; 'error-codes'?: string[] };
    const codes = data['error-codes'] ?? [];
    if (codes.some((code) => CONFIGURATION_ERRORS.has(code))) {
      log.error('[turnstile]', new Error(`siteverify error-codes: ${codes.join(', ')}`), 'TURNSTILE_SECRET_KEY is missing or wrong — every bot check fails');
    }
    return data.success === true;
  } catch (error) {
    log.error('[turnstile]', error instanceof Error ? error : new Error(String(error)), 'siteverify unreachable — bot check refused');
    return false;
  }
}
