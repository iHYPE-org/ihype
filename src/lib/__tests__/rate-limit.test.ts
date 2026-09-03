import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { consumeRateLimit, describeKvRefusal, rateLimitHeaders, rateLimitKey } from '../rate-limit';

// Clear the in-process store between tests by consuming under a unique key prefix per test
let testId = 0;
function key(suffix = '') {
  return `test-${testId}-${suffix}`;
}

beforeEach(() => {
  testId++;
});

describe('consumeRateLimit', () => {
  it('allows the first request', async () => {
    const result = await consumeRateLimit(key(), { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });

  it('decrements remaining on each allowed request', async () => {
    const k = key();
    const opts = { limit: 3, windowMs: 60_000 };
    expect((await consumeRateLimit(k, opts)).remaining).toBe(2);
    expect((await consumeRateLimit(k, opts)).remaining).toBe(1);
    expect((await consumeRateLimit(k, opts)).remaining).toBe(0);
  });

  it('blocks the request exactly at the limit', async () => {
    const k = key();
    const opts = { limit: 2, windowMs: 60_000 };
    await consumeRateLimit(k, opts); // 1
    await consumeRateLimit(k, opts); // 2 — limit reached
    const result = await consumeRateLimit(k, opts); // 3 — should be blocked
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns retryAfterSeconds > 0 when blocked', async () => {
    const k = key();
    const opts = { limit: 1, windowMs: 30_000 };
    await consumeRateLimit(k, opts); // allowed
    const blocked = await consumeRateLimit(k, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets after the window expires', async () => {
    const start = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(start);

    const k = key();
    const opts = { limit: 1, windowMs: 1000 }; // 1s window (KV TTL granularity is seconds)
    await consumeRateLimit(k, opts); // consume the only slot
    const blocked = await consumeRateLimit(k, opts);
    expect(blocked.allowed).toBe(false);

    vi.setSystemTime(start + 1100); // advance past the 1s window

    const reset = await consumeRateLimit(k, opts);
    expect(reset.allowed).toBe(true);

    vi.useRealTimers();
  });

  it('independent keys do not interfere', async () => {
    const opts = { limit: 1, windowMs: 60_000 };
    await consumeRateLimit(key('a'), opts); // exhaust key-a
    const result = await consumeRateLimit(key('b'), opts); // key-b should be fresh
    expect(result.allowed).toBe(true);
  });

  it('enforces the full configured limit for a bucket that opts out of the atomic backend', async () => {
    // atomic: false routes to the KV counter on purpose. It must still count
    // to the number the caller wrote down — the halving that guards a
    // *degraded* limiter would silently enforce 1 here instead of 3.
    const k = key();
    const opts = { limit: 3, windowMs: 60_000, atomic: false as const };
    expect((await consumeRateLimit(k, opts)).allowed).toBe(true);
    expect((await consumeRateLimit(k, opts)).allowed).toBe(true);
    expect((await consumeRateLimit(k, opts)).allowed).toBe(true);
    expect((await consumeRateLimit(k, opts)).allowed).toBe(false);
  });

  it('opt-out buckets are still isolated from one another', async () => {
    const opts = { limit: 1, windowMs: 60_000, atomic: false as const };
    await consumeRateLimit(key('opt-a'), opts);
    expect((await consumeRateLimit(key('opt-b'), opts)).allowed).toBe(true);
  });

  it('remaining is never negative', async () => {
    const k = key();
    const opts = { limit: 1, windowMs: 60_000 };
    await consumeRateLimit(k, opts);
    const result = await consumeRateLimit(k, opts);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });
});

describe('rateLimitHeaders', () => {
  it('includes X-RateLimit-Remaining and X-RateLimit-Reset on allowed result', () => {
    const headers = rateLimitHeaders({ allowed: true, remaining: 4, retryAfterSeconds: 60 });
    expect(headers['X-RateLimit-Remaining']).toBe('4');
    expect(headers['X-RateLimit-Reset']).toBe('60');
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('includes Retry-After when blocked', () => {
    const headers = rateLimitHeaders({ allowed: false, remaining: 0, retryAfterSeconds: 30 });
    expect(headers['Retry-After']).toBe('30');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });
});

describe('rateLimitKey', () => {
  it('uses user-scoped key when userId is present', () => {
    expect(rateLimitKey('hype', 'user-123', '1.2.3.4')).toBe('hype:user:user-123');
  });

  it('falls back to IP-scoped key when userId is absent', () => {
    expect(rateLimitKey('search', undefined, '1.2.3.4')).toBe('search:ip:1.2.3.4');
  });

  it('uses unknown when both userId and IP are absent', () => {
    expect(rateLimitKey('search', undefined, null)).toBe('search:ip:unknown');
  });
});

describe('describeKvRefusal', () => {
  /*
   * The Sentry issue this exists for: 5 events over 22 days, every one from
   * `POST /api/analytics/track`, which passes `atomic: false`. It read as a
   * limiter outage — "KV fallback also failed; denying request" at ERROR —
   * and was a slow KV read on a beacon that the route itself says is
   * droppable. The words named a fallback that bucket does not have.
   */
  it('a bucket that opted out of the atomic backend warns, and says KV is its own backend', () => {
    const { level, message } = describeKvRefusal(true);
    expect(level).toBe('warn');
    expect(message).not.toContain('fallback');
    expect(message).toContain('non-atomic');
  });

  /*
   * The case that must keep reaching Sentry: the Durable Object failed AND
   * then KV failed, so a real limiter is down and a member is refused for
   * nothing they did.
   */
  it('a genuinely degraded bucket still reports an error', () => {
    const { level, message } = describeKvRefusal(false);
    expect(level).toBe('error');
    expect(message).toContain('fallback');
  });

  it('either way the request is refused — the level changes, the behaviour does not', () => {
    expect(describeKvRefusal(true).message).toMatch(/refus|deny/i);
    expect(describeKvRefusal(false).message).toMatch(/refus|deny/i);
  });
});
