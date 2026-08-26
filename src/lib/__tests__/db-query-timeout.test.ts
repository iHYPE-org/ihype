import { describe, expect, it, vi } from 'vitest';

/**
 * THE QUERY-TIMEOUT TIMER MUST BE CLEARED, and nothing else asserts it.
 *
 * `src/lib/db.ts` races every Prisma call against a 25-second timeout so a hung
 * query cannot silently eat a Worker's 60s wall clock. `Promise.race` settles as
 * soon as the query wins — but it does NOT cancel the loser, so an uncleared
 * timer stays live for 25 seconds holding a closure over `model`, `operation`
 * and `args`.
 *
 * In production that is invisible: a Worker invocation is short and the isolate
 * is gone long before the timers matter. In a long-lived process it is a leak
 * with no ceiling, and on 2026-08-26 it killed the authenticated e2e shard —
 * the wrangler dev server reached 1393 MB, spent ~95% of its time in GC
 * (`average mu = 0.046`), dragged `User.findUnique` out to 2 seconds and aborted
 * on signal 6 mid-suite. Whichever test was running when it died failed on
 * whatever its assertion happened to be, which is why the "flaky" test was a
 * different one every run and why three rounds of locator fixes never settled
 * the file.
 *
 * The extension itself cannot be imported here — `db.ts` constructs a real
 * PrismaClient at module scope against the wasm/workerd engine. So this test
 * pins the SHAPE instead: the same race, run many times, must leave no pending
 * timer. Run against the pre-fix shape it reports one timer per call.
 */
describe('the db query timeout does not outlive its query', () => {
  it('leaves no pending timer once the query has won the race', async () => {
    vi.useFakeTimers();
    try {
      // Mirrors makePrisma()'s $allOperations wrapper.
      async function withTimeout<T>(query: () => Promise<T>): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('DB query timeout after 25s')), 25_000);
        });
        try {
          return await Promise.race([query(), timeout]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }

      for (let i = 0; i < 200; i += 1) {
        await expect(withTimeout(async () => 'ok')).resolves.toBe('ok');
      }

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still rejects when the query really does hang', async () => {
    vi.useFakeTimers();
    try {
      async function withTimeout<T>(query: () => Promise<T>): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('DB query timeout after 25s')), 25_000);
        });
        try {
          return await Promise.race([query(), timeout]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }

      // A query that never settles — the case the timeout exists for. Clearing
      // the timer in `finally` must not defuse it before it has fired, which is
      // the obvious way to "fix" the leak and break the protection.
      const pending = withTimeout(() => new Promise(() => {}));
      const assertion = expect(pending).rejects.toThrow('DB query timeout after 25s');
      await vi.advanceTimersByTimeAsync(25_000);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
