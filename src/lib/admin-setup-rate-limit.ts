import { consumeRateLimit, rateLimitKey, type RateLimitResult } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const WINDOW_MS = 60 * 60 * 1000;

export async function consumeAdminSetupRateLimit(request: Request): Promise<RateLimitResult> {
  const perIp = await consumeRateLimit(
    rateLimitKey('admin-setup', undefined, readClientAddress(request)),
    { limit: 5, windowMs: WINDOW_MS },
  );
  if (!perIp.allowed) return perIp;

  return consumeRateLimit('admin-setup:global', { limit: 25, windowMs: WINDOW_MS });
}
