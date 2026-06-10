import { kvGet, kvIncr, kvList, kvPut } from '@/lib/kv';

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
// KV-backed implementation (Cloudflare KV)
// ---------------------------------------------------------------------------

const DEFAULT_KV_TIMEOUT_MS = 1500;

function getKvTimeoutMs() {
  const parsed = Number.parseInt(process.env.RATE_LIMIT_KV_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_KV_TIMEOUT_MS;
}

async function withKvTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  const timeoutMs = getKvTimeoutMs();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function consumeKvUnsafe(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const { limit, windowMs } = options;
  const windowSecs = Math.ceil(windowMs / 1000);
  const count = await kvIncr(key, windowSecs);
  const retryAfterSeconds = windowSecs;
  if (count > limit) {
    // Track hits-per-bucket over a rolling 1h window for the admin dashboard.
    try {
      await kvIncr(`rate-limit-hits:${key}`, 3600);
    } catch {
      // best-effort
    }
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

async function consumeKv(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    return await withKvTimeout(consumeKvUnsafe(key, options), 'KV rate limit');
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
    const values = await Promise.all(keys.map((k) => kvGet<number>(k).catch(() => 0)));
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
// Durable Object implementation (atomic counters)
// ---------------------------------------------------------------------------

type RateLimiterStub = {
  consume(limit: number, windowMs: number): Promise<RateLimitResult>;
};

type RateLimiterNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): RateLimiterStub;
};

function getRateLimiterStub(key: string): RateLimiterStub | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const ns = (ctx.env as Record<string, unknown>).RATE_LIMITER_DO as RateLimiterNamespace | undefined;
    if (!ns) return null;
    return ns.get(ns.idFromName(key));
  } catch {
    return null;
  }
}

// One Durable Object per bucket key serializes increments, so counts stay
// exact under concurrent load — KV's read-then-write counter undercounts.
async function consumeDurableObject(key: string, options: RateLimitOptions): Promise<RateLimitResult | null> {
  const stub = getRateLimiterStub(key);
  if (!stub) return null;

  try {
    const result = await withKvTimeout(stub.consume(options.limit, options.windowMs), 'DO rate limit');
    if (!result.allowed) {
      // Track hits-per-bucket over a rolling 1h window for the admin dashboard.
      try {
        await kvIncr(`rate-limit-hits:${key}`, 3600);
      } catch {
        // best-effort
      }
    }
    return result;
  } catch (err) {
    console.error('[rate-limit] DO error, falling back to KV:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function consumeRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const atomic = await consumeDurableObject(key, options);
  if (atomic) return atomic;
  return consumeKv(key, options);
}
