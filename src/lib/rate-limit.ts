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
  /**
   * Whether this bucket needs the exact, serialized Durable Object counter.
   * Defaults to true. Set false for high-volume buckets that only exist to
   * protect a downstream pipeline and already degrade harmlessly when a few
   * extra requests slip through — those pay the DO round-trip on every call
   * for accuracy nobody consumes, and one hot key funnels every request for
   * it through a single DO instance.
   */
  atomic?: boolean;
  /**
   * Override the Durable Object deadline for this bucket.
   *
   * The default suits a warm instance. It does not suit a bucket keyed per
   * client IP on a low-traffic endpoint, where the object is evicted between
   * uses and almost every call pays a cold start — there, a timeout is the
   * expected case rather than a fault, and the KV fallback it triggers runs
   * at half the configured limit.
   */
  timeoutMs?: number;
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

/**
 * Builds a single bucket key: per-user when signed in, else per-IP.
 *
 * NOTE the `ip` argument is IGNORED whenever `userId` is present. That is
 * intentional for most endpoints — an authenticated action should be counted
 * against the account, not the coffee shop — but it means this function alone
 * gives NO protection against one machine driving many throwaway accounts,
 * because each account gets its own fresh bucket. Thirteen call sites pass an
 * IP here that is never read.
 *
 * When an endpoint needs both (anything with money or scarce inventory behind
 * it), use `consumeDualRateLimit` instead.
 */
export function rateLimitKey(prefix: string, userId: string | undefined, ip: string | null): string {
  return userId ? `${prefix}:user:${userId}` : `${prefix}:ip:${ip ?? 'unknown'}`;
}

const DEFAULT_KV_TIMEOUT_MS = 1000;

/**
 * The DO deadline is deliberately shorter than the KV one, and the pair has a
 * combined budget rather than two independent ones. A rate-limit check sits in
 * front of the request it guards, so its cost is added to every response;
 * waiting 1.5s for a counter and *then* still having to run the KV fallback
 * meant a degraded limiter could add ~3s of latency to a request that was going
 * to be allowed anyway. That reasoning still holds, and 3s is still the number
 * being refused — the arithmetic below is what changed.
 *
 * Raised 750ms → 1800ms on 2026-08-22, with KV cut 1500ms → 1000ms so the worst
 * case (DO deadline expires, KV deadline expires) is 2.8s, still under the 3s
 * this comment has always rejected. The evidence: Sentry shows
 * `POST /api/discover/seeds/[id]/save` timing out at 750ms 158 times and still
 * counting, and each of those timeouts drops that bucket to the KV fallback at
 * *half* its configured limit — a refusal the member sees, caused by the
 * limiter rather than by their own traffic. 52 of the 57 buckets in this file
 * run on this default; only the five auth buckets carry an explicit
 * `timeoutMs: 2500`.
 *
 * 750ms was measured against a warm instance, and that is the wrong shape for
 * most buckets here. A bucket keyed per user (or per IP) on an endpoint one
 * person hits a handful of times a week has an object that is evicted between
 * uses, so nearly every call pays a cold start — the same finding that put
 * 2500ms on the auth buckets in the first place. This generalises it to the
 * default instead of leaving 52 buckets on a deadline chosen for a case they
 * are not in.
 */
const DEFAULT_DO_TIMEOUT_MS = 1800;

function getKvTimeoutMs() {
  const parsed = Number.parseInt(process.env.RATE_LIMIT_KV_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_KV_TIMEOUT_MS;
}

/**
 * Resolves the Durable Object deadline: per-bucket override, then the env
 * override, then the default. Exported so the precedence is testable — a
 * bucket silently running on a deadline it did not ask for is exactly what
 * produced 67 cold-start timeouts on the sign-in path.
 */
export function resolveDoTimeoutMs(override?: number, envValue?: string): number {
  if (override && override > 0) return override;
  const parsed = Number.parseInt(envValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DO_TIMEOUT_MS;
}

function getDoTimeoutMs(override?: number) {
  return resolveDoTimeoutMs(override, process.env.RATE_LIMIT_DO_TIMEOUT_MS);
}

async function withTimeout<T>(operation: Promise<T>, label: string, timeoutMs: number): Promise<T> {
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

function withKvTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  return withTimeout(operation, label, getKvTimeoutMs());
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

/**
 * Three outcomes, kept distinct on purpose. Collapsing "there is no binding"
 * and "the call failed" into a single null is what made the production
 * degradation unreadable: every failed call logged BOTH an error at the call
 * site and a "RATE_LIMITER_DO unavailable" line from the fallback, so Sentry
 * showed two unrelated-looking issues with different counts describing one
 * fault, and the louder of the two named the wrong cause.
 */
type AtomicOutcome =
  | { kind: 'ok'; result: RateLimitResult }
  | { kind: 'unavailable' }
  | { kind: 'error' };

async function consumeDurableObject(key: string, options: RateLimitOptions): Promise<AtomicOutcome> {
  const stub = getRateLimiterStub(key);
  if (!stub) return { kind: 'unavailable' };

  try {
    const result = await withTimeout(
      stub.consume(options.limit, options.windowMs),
      'DO rate limit',
      getDoTimeoutMs(options.timeoutMs)
    );
    if (!result.allowed) {
      deferWork(kvIncr(`rate-limit-hits:${key}`, 3600), 'rate-limit');
    }
    return { kind: 'ok', result };
  } catch (error) {
    // log.error so a DO outage reaches Sentry — console.error only lands in
    // Worker logs, which nobody tails. This is the only line logged for a
    // failed call; the fallback below stays silent so one fault is one issue.
    // Timeout and "the DO threw" are the same outcome but not the same
    // problem: the first is usually a cold instance on a rarely-used key, the
    // second means the object itself is failing. They were indistinguishable
    // in Sentry, which is why 67 cold-start timeouts on /api/auth/passkey/auth
    // read as an ongoing backend fault.
    const timedOut = error instanceof Error && error.message.includes('timed out');
    log.error(
      '[rate-limit]',
      error instanceof Error ? error : { error: String(error) },
      timedOut
        ? `atomic backend timed out after ${getDoTimeoutMs(options.timeoutMs)}ms, falling back to KV at half limit`
        : 'atomic backend error, falling back to KV at half limit',
    );
    return { kind: 'error' };
  }
}

/**
 * How to report a KV failure that ends in a refusal.
 *
 * Two different events reach that point and only one of them is a fault.
 *
 * A DEGRADED bucket got there because the Durable Object failed AND then KV
 * failed: its limiter is entirely down and a member is being refused for no
 * reason of their own. That is an error and belongs in Sentry.
 *
 * An OPTED-OUT bucket has no fallback to have failed — KV is its chosen
 * primary, and `atomic: false` is the caller saying this bucket may be
 * approximate. `/api/analytics/track` is the one that reaches here in practice
 * (5 events in 22 days, one iPhone on a slow network), and by that route's own
 * reasoning a refusal there drops one analytics beacon and nothing else.
 *
 * Reporting both at ERROR under the words "KV fallback also failed" was wrong
 * twice: it named a fallback that does not exist for these buckets, and it put
 * a dropped beacon in Sentry beside real faults. This module has already been
 * bitten once by a misleading log line — one DO fault surfaced as two issues,
 * the louder naming the wrong cause — which is the whole reason the 3-way
 * `AtomicOutcome` exists. The refusal itself is unchanged in both cases:
 * failing closed is the safe default for a limiter.
 */
export function describeKvRefusal(optedOut: boolean): { level: 'warn' | 'error'; message: string } {
  return optedOut
    ? { level: 'warn', message: 'KV timed out for a non-atomic bucket; refusing this request' }
    : { level: 'error', message: 'KV fallback also failed; denying request' };
}

export async function consumeRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const optedOut = options.atomic === false;
  const atomic: AtomicOutcome = optedOut ? { kind: 'unavailable' } : await consumeDurableObject(key, options);
  if (atomic.kind === 'ok') return atomic.result;

  if (process.env.NODE_ENV === 'production') {
    // Degraded mode: a DO hiccup must not become a sitewide write outage.
    // KV increments aren't atomic (concurrent requests can race the counter),
    // so run at half the normal limit to keep abuse headroom. Only if KV is
    // also down do we fail closed.
    //
    // A bucket that opted out of the DO is not degraded — KV is its intended
    // backend — so it keeps its full configured limit and logs nothing.
    // Halving an opt-out bucket would silently enforce half the number the
    // caller wrote down.
    if (!optedOut && atomic.kind === 'unavailable') {
      // Only a genuinely absent binding is reported here; a failed call
      // already logged its own error above, so one fault stays one issue.
      log.error('[rate-limit]', { key }, 'RATE_LIMITER_DO binding missing in production; using KV fallback at half limit');
    }
    const effective: RateLimitOptions = optedOut
      ? options
      : { limit: Math.max(1, Math.floor(options.limit / 2)), windowMs: options.windowMs };
    try {
      return await withKvTimeout(
        consumeKvUnsafe(key, effective),
        optedOut ? 'KV rate limit' : 'KV rate limit fallback',
      );
    } catch (error) {
      const { level, message } = describeKvRefusal(optedOut);
      if (level === 'warn') log.warn('[rate-limit]', { key }, message);
      else log.error('[rate-limit]', error instanceof Error ? error : { error: String(error) }, message);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(options.windowMs / 1000))
      };
    }
  }

  return consumeKvForDevelopment(key, options);
}

/**
 * Counts an action against the ACCOUNT and the CLIENT ADDRESS as two
 * independent buckets, both of which must pass.
 *
 * `rateLimitKey` alone cannot stop the attack that matters for ticketing: one
 * machine, fifty throwaway accounts, fifty fresh per-user buckets. Combining
 * the two into a single `user+ip` key would be worse than useless — rotating
 * either half would mint a brand new bucket.
 *
 * The IP limit is deliberately looser than the per-user one. A household, a
 * venue's wifi, a university hall and a corporate NAT all legitimately present
 * one address for many buyers, so this is sized to stop a script rather than
 * to police a shared connection. An absent address (`null`) skips the IP
 * bucket rather than lumping every unknown client into one shared counter,
 * which would let one unidentifiable client lock out all the others.
 */
export async function consumeDualRateLimit(
  prefix: string,
  userId: string,
  ip: string | null,
  options: { user: RateLimitOptions; ip: RateLimitOptions },
): Promise<{ allowed: boolean; scope: 'user' | 'ip' | null; result: RateLimitResult }> {
  const userResult = await consumeRateLimit(`${prefix}:user:${userId}`, options.user);
  if (!userResult.allowed) return { allowed: false, scope: 'user', result: userResult };

  if (!ip) return { allowed: true, scope: null, result: userResult };

  const ipResult = await consumeRateLimit(`${prefix}:ip:${ip}`, options.ip);
  if (!ipResult.allowed) return { allowed: false, scope: 'ip', result: ipResult };

  return { allowed: true, scope: null, result: userResult };
}
