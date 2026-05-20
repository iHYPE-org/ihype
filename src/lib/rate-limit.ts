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

import { kvGet, kvIncr, kvList } from '@/lib/kv';

// ---------------------------------------------------------------------------
// KV-backed implementation (Cloudflare KV)
// ---------------------------------------------------------------------------

async function consumeKv(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const { limit, windowMs } = options;
    const windowSecs = Math.ceil(windowMs / 1000);
    const count = await kvIncr(key, windowSecs);
    const retryAfterSeconds = windowSecs;
    if (count > limit) {
      // Track hits-per-bucket over a rolling 1h window for the admin dashboard.
      try {
        const hitsKey = `rate-limit-hits:${key}`;
        await kvIncr(hitsKey, 3600);
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
export async function getRateLimitMetrics(limit = 10): Promise<RateLimitMetric[]> {
  try {
    const keys = await kvList('rate-limit-hits:');
    if (keys.length === 0) return [];
    const values = await Promise.all(keys.map((k) => kvGet<string>(k).catch(() => null)));
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

const MEMORY_STORE_MAX = 5_000;

function consumeMemory(key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);
  // Safety cap: if the store is still too large after pruning, evict the oldest entries
  if (rateLimitStore.size >= MEMORY_STORE_MAX) {
    const evict = Math.ceil(MEMORY_STORE_MAX * 0.1);
    let evicted = 0;
    for (const k of rateLimitStore.keys()) {
      if (evicted >= evict) break;
      rateLimitStore.delete(k);
      evicted++;
    }
  }

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
  return consumeKv(key, options);
}

export const RATE_LIMIT_PRESETS = {
  auth:           { limit: 10, windowMs: 60_000 },
  follow:         { limit: 60, windowMs: 60_000 },
  bookingRequest: { limit: 10, windowMs: 60 * 60_000 },
  hype:           { limit: 30, windowMs: 60_000 },
  upload:         { limit: 5,  windowMs: 5 * 60_000 },
  default:        { limit: 20, windowMs: 60_000 },
} as const;
