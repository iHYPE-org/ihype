import { deferWork } from '@/lib/defer-work';
import { kvGet, kvIncr, kvList } from '@/lib/kv';
import { log } from '@/lib/logger';

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

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.retryAfterSeconds),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) })
  };
}

export function rateLimitKey(prefix: string, userId: string | undefined, ip: string | null): string {
  return userId ? `${prefix}:user:${userId}` : `${prefix}:ip:${ip ?? 'unknown'}`;
}

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
    if (timeout) clearTimeout(timeout);
  }
}

async function consumeKvUnsafe(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const { limit, windowMs } = options;
  const windowSecs = Math.ceil(windowMs / 1000);
  const count = await kvIncr(key, windowSecs);
  const retryAfterSeconds = windowSecs;
  if (count > limit) {
    deferWork(kvIncr(`rate-limit-hits:${key}`, 3600), 'rate-limit');
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

async function consumeKvForDevelopment(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    return await withKvTimeout(consumeKvUnsafe(key, options), 'KV rate limit');
  } catch (error) {
    log.error('[rate-limit]', error instanceof Error ? error : { error: String(error) }, 'development KV error, falling back to in-memory');
    return consumeMemory(key, options);
  }
}

export type RateLimitMetric = { bucket: string; hits: number };

export async function getRateLimitMetrics(limit = 10): Promise<RateLimitMetric[]> {
  try {
    const keys = await kvList('rate-limit-hits:');
    if (keys.length === 0) return [];
    const values = await Promise.all(keys.map((key) => kvGet<number>(key).catch(() => 0)));
    return keys
      .map((key, index) => ({
        bucket: key.replace(/^rate-limit-hits:/, ''),
        hits: Number(values[index] ?? 0)
      }))
      .filter((row) => row.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  } catch (error) {
    log.error('[rate-limit]', error instanceof Error ? error : { error: String(error) }, 'getRateLimitMetrics failed');
    return [];
  }
}

const globalForRateLimit = globalThis as typeof globalThis & {
  __ihypeRateLimitStore?: Map<string, RateLimitRecord>;
};

const rateLimitStore = globalForRateLimit.__ihypeRateLimitStore ?? new Map<string, RateLimitRecord>();
if (!globalForRateLimit.__ihypeRateLimitStore) globalForRateLimit.__ihypeRateLimitStore = rateLimitStore;

function pruneExpired(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) rateLimitStore.delete(key);
  }
}

function consumeMemory(key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
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
    const namespace = (ctx.env as Record<string, unknown>).RATE_LIMITER_DO as RateLimiterNamespace | undefined;
    if (!namespace) return null;
    return namespace.get(namespace.idFromName(key));
  } catch {
    return null;
  }
}

async function consumeDurableObject(key: string, options: RateLimitOptions): Promise<RateLimitResult | null> {
  const stub = getRateLimiterStub(key);
  if (!stub) return null;

  try {
    const result = await withKvTimeout(stub.consume(options.limit, options.windowMs), 'DO rate limit');
    if (!result.allowed) {
      deferWork(kvIncr(`rate-limit-hits:${key}`, 3600), 'rate-limit');
    }
    return result;
  } catch (error) {
    // log.error so a DO outage reaches Sentry — console.error only lands in
    // Worker logs, which nobody tails.
    log.error('[rate-limit]', error instanceof Error ? error : { error: String(error) }, 'atomic backend error');
    return null;
  }
}

export async function consumeRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const atomic = await consumeDurableObject(key, options);
  if (atomic) return atomic;

  if (process.env.NODE_ENV === 'production') {
    // Degraded mode: a DO hiccup must not become a sitewide write outage.
    // KV increments aren't atomic (concurrent requests can race the counter),
    // so run at half the normal limit to keep abuse headroom. Only if KV is
    // also down do we fail closed.
    log.error('[rate-limit]', { key }, 'RATE_LIMITER_DO unavailable in production; using KV fallback at half limit');
    const degraded: RateLimitOptions = {
      limit: Math.max(1, Math.floor(options.limit / 2)),
      windowMs: options.windowMs
    };
    try {
      return await withKvTimeout(consumeKvUnsafe(key, degraded), 'KV rate limit fallback');
    } catch (error) {
      log.error('[rate-limit]', error instanceof Error ? error : { error: String(error) }, 'KV fallback also failed; denying request');
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(options.windowMs / 1000))
      };
    }
  }

  return consumeKvForDevelopment(key, options);
}
