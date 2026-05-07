import { describe, it, expect, beforeEach } from 'vitest';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '../rate-limit';

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
    const k = key();
    const opts = { limit: 1, windowMs: 50 }; // 50ms window
    await consumeRateLimit(k, opts); // consume the only slot
    const blocked = await consumeRateLimit(k, opts);
    expect(blocked.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 60)); // wait for window to expire

    const reset = await consumeRateLimit(k, opts);
    expect(reset.allowed).toBe(true);
  });

  it('independent keys do not interfere', async () => {
    const opts = { limit: 1, windowMs: 60_000 };
    await consumeRateLimit(key('a'), opts); // exhaust key-a
    const result = await consumeRateLimit(key('b'), opts); // key-b should be fresh
    expect(result.allowed).toBe(true);
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
