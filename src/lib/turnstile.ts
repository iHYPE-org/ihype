import { readRuntimeEnv } from '@/lib/runtime-env';

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
    if (!res.ok) return false;
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
