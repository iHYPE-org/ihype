import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TTL_DAYS,
  DEFAULT_USES,
  MAX_TTL_DAYS,
  MAX_USES,
  planRedemption,
  planReviewLink,
  validateMintOptions,
} from '@/lib/review-access';

/**
 * The redemption rules, asserted rather than reasoned about.
 *
 * This is the half that fails quietly. A multi-use link that decrements but
 * never marks itself spent stays redeemable at zero — a permanent sign-in URL,
 * which is the password this design exists to avoid. One that marks itself
 * spent on the first redemption is single-use wearing a counter, and strands a
 * reviewer who comes back the next day. Neither is visible from the outside
 * until it matters.
 */
describe('planRedemption', () => {
  it('leaves a MEMBER link exactly as it was: one use, then spent', () => {
    /* null is every magic link written before this feature existed and every
       one a member requests. Changing its behaviour would break sign-in for
       the whole product, so it is the first thing asserted. */
    expect(planRedemption(null)).toEqual({ allowed: true, nextRemaining: null, markUsed: true });
  });

  it('spends a review link down to zero and marks it used exactly at zero', () => {
    expect(planRedemption(3)).toEqual({ allowed: true, nextRemaining: 2, markUsed: false });
    expect(planRedemption(2)).toEqual({ allowed: true, nextRemaining: 1, markUsed: false });
    /* The last redemption is allowed AND marks the row spent in the same
       write. Marking it a redemption later would leave a usable token behind. */
    expect(planRedemption(1)).toEqual({ allowed: true, nextRemaining: 0, markUsed: true });
  });

  it('refuses a link that is already at zero, or below it', () => {
    expect(planRedemption(0)).toEqual({ allowed: false, nextRemaining: 0, markUsed: true });
    /* Negative should be unreachable — the conditional write cannot go below
       zero — but a refusal is the only safe answer if it ever happens, and a
       silent `allowed: true` here would be an unlimited link. */
    expect(planRedemption(-1).allowed).toBe(false);
  });

  it('never returns a plan that both allows a use and leaves the count unchanged', () => {
    /* The property under all of the above: a redemption must always cost
       something, or the link is unlimited. */
    for (let remaining = 1; remaining <= 20; remaining += 1) {
      const plan = planRedemption(remaining);
      expect(plan.allowed, `at ${remaining}`).toBe(true);
      expect(plan.nextRemaining, `at ${remaining}`).toBe(remaining - 1);
    }
  });
});

describe('planReviewLink', () => {
  it('mints a 64-character hex secret and stores only its hash', () => {
    const plan = planReviewLink();
    expect(plan.token).toMatch(/^[0-9a-f]{64}$/);
    expect(plan.tokenHash).not.toBe(plan.token);
    expect(plan.tokenHash.length).toBeGreaterThan(0);
  });

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 50 }, () => planReviewLink().token));
    expect(seen.size).toBe(50);
  });

  it('takes the defaults, and honours an explicit request', () => {
    const now = new Date('2026-09-04T00:00:00.000Z');

    const fallback = planReviewLink({}, now);
    expect(fallback.remainingUses).toBe(DEFAULT_USES);
    expect(fallback.expiresAt.toISOString()).toBe(
      new Date(now.getTime() + DEFAULT_TTL_DAYS * 86_400_000).toISOString(),
    );

    const asked = planReviewLink({ uses: 3, ttlDays: 7 }, now);
    expect(asked.remainingUses).toBe(3);
    expect(asked.expiresAt.toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });
});

describe('validateMintOptions', () => {
  it('accepts the defaults and the bounds themselves', () => {
    expect(validateMintOptions({}).ok).toBe(true);
    expect(validateMintOptions({ uses: 1, ttlDays: 1 }).ok).toBe(true);
    expect(validateMintOptions({ uses: MAX_USES, ttlDays: MAX_TTL_DAYS }).ok).toBe(true);
  });

  /* Rejecting rather than clamping is the decision being asserted: an operator
     handed a silently shortened link believes they have the one they asked
     for, and finds out when a reviewer cannot get in. */
  it('rejects out-of-range and non-integer requests instead of clamping them', () => {
    const bad = [
      { uses: 0 },
      { uses: -1 },
      { uses: MAX_USES + 1 },
      { uses: 2.5 },
      { ttlDays: 0 },
      { ttlDays: MAX_TTL_DAYS + 1 },
      { ttlDays: 1.5 },
    ];
    for (const options of bad) {
      const result = validateMintOptions(options);
      expect(result.ok, JSON.stringify(options)).toBe(false);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});
