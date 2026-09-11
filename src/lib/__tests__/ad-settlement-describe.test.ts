import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/stripe', () => ({ settleAdCampaign: vi.fn(), isStripeConfigured: () => false }));
vi.mock('@/lib/ad-campaign-notify', () => ({ notifyAdvertiser: vi.fn() }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/defer-work', () => ({ deferWork: vi.fn() }));

import { describeSettlement, settlementRecord } from '@/lib/ad-settlement';

describe('describeSettlement', () => {
  it('names the amount, the timing and the Stripe reference when money was refunded', () => {
    const text = describeSettlement({ action: 'refund', amountCents: 7500, chargedCents: 4500 }, false, 're_test_123');
    expect(text).toContain('charged $45.00');
    expect(text).toContain('unspent $75.00 has been refunded');
    expect(text).toContain('5–10 business days');
    expect(text).toContain('Refund reference: re_test_123');
  });

  it('still states the timing when the refund id is unknown, and never invents one', () => {
    const text = describeSettlement({ action: 'refund', amountCents: 12000, chargedCents: 0 }, false, null);
    expect(text).toContain('full $120.00 has been refunded');
    expect(text).toContain('business days');
    expect(text).not.toContain('Refund reference');
  });

  it('says nothing about a refund when nothing was refunded', () => {
    const text = describeSettlement({ action: 'none', chargedCents: 12000 }, true);
    expect(text).toContain('paused for 60 days');
    expect(text).toContain('nothing to refund');
    expect(text).not.toContain('business days');
  });
});

/**
 * A SPONSORSHIP BUYS TIME, AND EVERY SENTENCE ABOVE WAS WRITTEN FOR A METER
 * (2026-09-11). Sponsorship is the only model on sale, so until this date
 * every settlement email the product could actually send described the
 * retired per-impression model. The figures were right throughout; the nouns
 * were not, which is why nothing failed.
 */
describe('describeSettlement for a sponsorship', () => {
  const SPONSORSHIP = 'SPONSORSHIP';

  it('refunds the unused part of the TERM, never an unspent budget', () => {
    const text = describeSettlement({ action: 'refund', amountCents: 22500, chargedCents: 7500 }, false, 're_x', SPONSORSHIP);
    expect(text).toContain('the part of your sponsorship term that ran');
    expect(text).toContain('$225.00, covering the days you did not use');
    expect(text, 'a sponsorship spends nothing').not.toContain('spend actually delivered');
    expect(text).not.toContain('unspent');
  });

  it('does not blame underdelivery for a full refund on a term that never ran', () => {
    /* The metered branch here reads "delivered less than the $0.50 minimum a
       card can be charged". A sponsor who cancels on day one is refunded in
       full for the opposite reason — they used none of the term — and being
       told their campaign underdelivered is a different claim about their
       own spot. */
    const text = describeSettlement({ action: 'refund', amountCents: 30000, chargedCents: 0 }, false, null, SPONSORSHIP);
    expect(text).toContain('None of your sponsorship term had run');
    expect(text).toContain('full $300.00 has been refunded');
    expect(text).not.toContain('minimum a card can be charged');
  });

  it('says the term ran rather than that a budget was delivered', () => {
    const text = describeSettlement({ action: 'none', chargedCents: 30000 }, false, null, SPONSORSHIP);
    expect(text).toContain('ran its full term');
    expect(text).not.toContain('budget');
  });

  it('leaves the metered wording exactly as it was', () => {
    // The default is METERED, so a legacy campaign settled today reads
    // precisely what it read before — this pass changed no metered sentence.
    expect(describeSettlement({ action: 'refund', amountCents: 7500, chargedCents: 4500 }, false, 're_test_123'))
      .toBe(describeSettlement({ action: 'refund', amountCents: 7500, chargedCents: 4500 }, false, 're_test_123', 'METERED'));
    expect(describeSettlement({ action: 'none', chargedCents: 12000 }, false, null, 'METERED'))
      .toContain('Your full budget of $120.00 was delivered');
  });
});

describe('settlementRecord', () => {
  it('writes the figures and the refund id the dashboard reads back', () => {
    expect(settlementRecord({ action: 'refund', amountCents: 7500, chargedCents: 4500 }, 're_1'))
      .toEqual({ settledChargedCents: 4500, refundedCents: 7500, stripeRefundId: 're_1' });
    expect(settlementRecord({ action: 'release' }, null))
      .toEqual({ settledChargedCents: 0, refundedCents: 0, stripeRefundId: null });
  });
});
