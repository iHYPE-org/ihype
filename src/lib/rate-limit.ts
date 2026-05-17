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

async function consumeKv(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const { kv } = await import('@vercel/kv');
    const { limit, windowMs } = options;
    const windowSecs = Math.ceil(windowMs / 1000);
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, windowSecs);
    }
    const ttl = await kv.ttl(key);
    const retryAfterSeconds = Math.max(1, ttl);
    if (count > limit) {
      // Track hits-per-bucket over a rolling 1h window for the admin dashboard.
      try {
        const hitsKey = `rate-limit-hits:${key}`;
        const hits = await kv.incr(hitsKey);
        if (hits === 1) await kv.expire(hitsKey, 3600);
      } catch {
        // best-effort
      }
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds };
  } catch (err) {
    console.error('[rate-limit] KV error, falling back to in-memory:', err);
    return consumeMemory(key, options);
  }
}

export type RateLimitMetric = { bucket: string; hits: number };

// Returns top N rate-limited buckets by hit count over the last hour.
// Requires Vercel KV; returns [] in local dev.
export async function getRateLimitMetrics(limit = 10): Promise<RateLimitMetric[]> {
  if (!process.env.KV_REST_API_URL) return [];
  try {
    const { kv } = await import('@vercel/kv');
    const keys: string[] = [];
    let cursor: string | number = 0;
    // SCAN until exhausted or until we collect a reasonable number of keys.
    do {
      const result = (await kv.scan(cursor as number, { match: 'rate-limit-hits:*', count: 200 })) as unknown as [string | number, string[]];
      cursor = result[0];
      for (const k of result[1]) keys.push(k);
      if (keys.length > 2000) break;
    } while (Number(cursor) !== 0);
    if (keys.length === 0) return [];
    const values = await Promise.all(keys.map((k) => kv.get<number>(k).catch(() => 0)));
    const rows: RateLimitMetric[] = keys.map((k, i) => ({
      bucket: k.replace(/^rate-limit-hits:/, ''),
      hits: Number(values[i] ?? 0)
    }));
    return rows
      .filter((r) => r.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  } catch (err) {
    console.error('[rate-limit] getRateLimitMetrics failed:', err);
    return [];
  }
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
