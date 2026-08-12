import { describe, expect, it } from 'vitest';
import {
  STRIPE_FIXED_CENTS,
  STRIPE_PERCENT,
  calculateProcessingFee,
  stripeCutOf,
} from '../stripe-fees';

describe('stripe processing fee', () => {
  /**
   * The rule this module exists for: iHYPE is a nonprofit and absorbs no fee.
   * Whatever Stripe takes out of the charge, the quoted fee must cover — for
   * every price, not just the convenient ones.
   */
  it('never leaves the platform absorbing a cent, at any price', () => {
    for (let subtotal = 1; subtotal <= 50_000; subtotal += 7) {
      const { feeCents, totalCents } = calculateProcessingFee(subtotal);
      const taken = stripeCutOf(totalCents);
      expect(
        totalCents - taken,
        `at ${subtotal}¢ Stripe takes ${taken}¢ from a ${totalCents}¢ charge, leaving ${totalCents - taken}¢`,
      ).toBeGreaterThanOrEqual(subtotal);
      expect(feeCents).toBe(totalCents - subtotal);
    }
  });

  it('grosses up rather than adding a flat percentage', () => {
    // The mock's $0.82 is 2.9% of the SUBTOTAL plus 30¢. Stripe charges on the
    // total, so that number under-collects by 3¢ and the platform eats it.
    const naive = Math.round(1800 * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
    expect(naive).toBe(82);

    const { feeCents, totalCents } = calculateProcessingFee(1800);
    expect(feeCents).toBe(85);
    expect(totalCents).toBe(1885);
    // And the difference is not academic: the naive charge really is short.
    expect(stripeCutOf(1882)).toBeGreaterThan(naive);
  });

  it('charges nothing on a free ticket', () => {
    // Stripe is never called for a $0 order, so passing on a 30¢ fixed fee
    // would be inventing a charge on something the product calls free.
    expect(calculateProcessingFee(0)).toEqual({ feeCents: 0, totalCents: 0 });
    expect(calculateProcessingFee(-100)).toEqual({ feeCents: 0, totalCents: 0 });
  });

  it('rounds the total up, never down', () => {
    // A half-cent rounded down is the platform absorbing a fee. The buyer pays
    // at most one cent more than the exact figure; the platform pays none.
    const { totalCents } = calculateProcessingFee(1000);
    const exact = (1000 + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT);
    expect(totalCents).toBe(Math.ceil(exact));
    expect(totalCents).toBeGreaterThanOrEqual(exact);
  });

  it('scales with the amount, so a bigger ticket carries a bigger fee', () => {
    const small = calculateProcessingFee(500).feeCents;
    const large = calculateProcessingFee(15_000).feeCents;
    expect(large).toBeGreaterThan(small);
    // The fixed 30¢ dominates a small ticket, which is worth being able to see.
    expect(small).toBeGreaterThan(STRIPE_FIXED_CENTS);
  });
});
