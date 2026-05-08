import { db } from '@/lib/db';

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const testBuckets = new Map<string, RateLimitRecord>();

export function rateLimitKey(scope: string, userId?: string | null, clientAddress?: string | null) {
  if (userId) {
    return `${scope}:user:${userId}`;
  }

  const normalizedAddress = clientAddress?.split(',')[0]?.trim() || 'unknown';
  return `${scope}:ip:${normalizedAddress}`;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.retryAfterSeconds)
  };

  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }

  return headers;
}

function consumeInMemoryRateLimit(key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = testBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    testBuckets.set(key, {
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
  testBuckets.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  };
}

async function consumeDatabaseRateLimit(key: string, { limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = new Date(now + windowMs);
  const existing = await db.rateLimitBucket.findUnique({ where: { key } });

  if (!existing || existing.resetAt.getTime() <= now) {
    await db.rateLimitBucket.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        resetAt
      },
      update: {
        count: 1,
        resetAt
      }
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
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt.getTime() - now) / 1000))
    };
  }

  const updated = await db.rateLimitBucket.update({
    where: { key },
    data: {
      count: {
        increment: 1
      }
    }
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - updated.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt.getTime() - now) / 1000))
  };
}

export function consumeRateLimit(key: string, options: RateLimitOptions): RateLimitResult | Promise<RateLimitResult> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return consumeInMemoryRateLimit(key, options);
  }

  return consumeDatabaseRateLimit(key, options);
}
