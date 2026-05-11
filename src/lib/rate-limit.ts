type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

// Standard rate-limit response headers (IETF draft-6585 + RateLimit header draft)
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.retryAfterSeconds),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) })
  };
}

// Convenience: build the ip:userId composite key used by most API routes
export function rateLimitKey(prefix: string, userId: string | undefined, ip: string | null): string {
  return userId ? `${prefix}:user:${userId}` : `${prefix}:ip:${ip ?? 'unknown'}`;
}

// ---------------------------------------------------------------------------
// KV-backed implementation (Vercel KV / Redis)
// ---------------------------------------------------------------------------

async function consumeKv(key: string, { limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  const { kv } = await import('@vercel/kv');
  const windowSecs = Math.ceil(windowMs / 1000);
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, windowSecs);
  }
  const ttl = await kv.ttl(key);
  const retryAfterSeconds = Math.max(1, ttl);
  if (count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

// ---------------------------------------------------------------------------
// In-memory implementation (local dev fallback)
// ---------------------------------------------------------------------------

const globalForRateLimit = globalThis as typeof globalThis & {
  __ihypeRateLimitStore?: Map<string, RateLimitRecord>;
};

const rateLimitStore = globalForRateLimit.__ihypeRateLimitStore ?? new Map<string, RateLimitRecord>();

if (!globalForRateLimit.__ihypeRateLimitStore) {
  globalForRateLimit.__ihypeRateLimitStore = rateLimitStore;
}

function pruneExpired(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function consumeMemory(key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000)
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function consumeRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  if (process.env.KV_REST_API_URL) {
    return consumeKv(key, options);
  }
  return consumeMemory(key, options);
}
