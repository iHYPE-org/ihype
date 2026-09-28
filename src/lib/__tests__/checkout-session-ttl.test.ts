import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECKOUT_SESSION_TTL_SECONDS } from '@/lib/stripe';

/* Stripe refuses an `expires_at` under 30 minutes from ITS creation time, and
   ours is computed a network round trip earlier from a floored clock — so the
   TTL needs a margin above 1800 s. And the reservation cron must not void an
   order whose session can still be paid, so the TTL stays under its window. */
describe('ticket Checkout Session lifetime', () => {
  it('clears Stripe’s 30-minute floor with a margin', () => {
    expect(CHECKOUT_SESSION_TTL_SECONDS).toBeGreaterThanOrEqual(30 * 60 + 60);
  });

  it('ends before the reservation cron voids the order', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/cron/expire-reservations/route.ts'), 'utf8');
    const minutes = Number(/const RESERVATION_TTL_MINUTES = (\d+);/.exec(src)?.[1]);
    expect(minutes).toBeGreaterThan(0);
    expect(CHECKOUT_SESSION_TTL_SECONDS).toBeLessThan(minutes * 60);
  });

  it('is the value the session is created with', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/stripe.ts'), 'utf8');
    expect(src).toContain('expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS');
    expect(src).not.toMatch(/expires_at: [^\n]*30 \* 60/);
  });
});
