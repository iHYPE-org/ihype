import { kvGet, kvPut } from '@/lib/kv';

// Structural type for a Durable Object namespace — avoids importing
// @cloudflare/workers-types which is not available in the Next.js build.
type DONamespace = {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): { fetch(url: string | Request, init?: RequestInit): Promise<Response> };
};

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
// Durable Object-backed implementation (atomic, CF Workers runtime)
// ---------------------------------------------------------------------------

async function getRateLimiterNamespace(): Promise<DONamespace | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const ns = (ctx.env as Record<string, unknown>).RATE_LIMITER;
    return (ns as DONamespace) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// KV-backed implementation (CF Pages / Workers without DO binding)
// ---------------------------------------------------------------------------

async function consumeKv(key: string, { limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  const record = await kvGet<{ count: number; resetAt: number }>(key);
  const now = Date.now();

  if (record === null || record.resetAt <= now) {
    const count = 1;
    await kvPut(key, JSON.stringify({ count, resetAt: now + windowMs }), { ex: Math.ceil(windowMs / 1000) });
    const retryAfterSeconds = Math.ceil(windowMs / 1000);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
  }

  const count = record.count + 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  await kvPut(key, JSON.stringify({ count, resetAt: record.resetAt }), { ex: retryAfterSeconds });
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

// ---------------------------------------------------------------------------
// Durable Object-backed implementation (atomic — requires DO binding)
// ---------------------------------------------------------------------------

async function consumeDO(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const ns = await getRateLimiterNamespace();
  if (!ns) return consumeKv(key, options);

  const id = ns.idFromName(key);
  const stub = ns.get(id);

  const response = await stub.fetch('https://do/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: options.limit, windowMs: options.windowMs }),
  });

  return response.json() as Promise<RateLimitResult>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getRateLimitMetrics(): Promise<[]> {
  return [];
}

export async function consumeRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  return consumeDO(key, options);
}
