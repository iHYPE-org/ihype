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

describe('settlementRecord', () => {
  it('writes the figures and the refund id the dashboard reads back', () => {
    expect(settlementRecord({ action: 'refund', amountCents: 7500, chargedCents: 4500 }, 're_1'))
      .toEqual({ settledChargedCents: 4500, refundedCents: 7500, stripeRefundId: 're_1' });
    expect(settlementRecord({ action: 'release' }, null))
      .toEqual({ settledChargedCents: 0, refundedCents: 0, stripeRefundId: null });
  });
});
