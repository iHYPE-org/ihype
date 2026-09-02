import { describe, expect, it } from 'vitest';
import { PAUSED_CAMPAIGN_SETTLE_AFTER_DAYS, pausedLongEnoughToSettle, planAdSettlement, settlementFigures } from '../ad-settlement-plan';

describe('planAdSettlement — charged up front (succeeded)', () => {
  it('refunds the unspent remainder and keeps what was delivered', () => {
    expect(planAdSettlement({ intentStatus: 'succeeded', amountReceivedCents: 12000, spentCents: 4500, budgetCents: 12000 }))
      .toEqual({ action: 'refund', amountCents: 7500, chargedCents: 4500 });
  });

  it('refunds everything when delivery was under the minimum charge', () => {
    expect(planAdSettlement({ intentStatus: 'succeeded', amountReceivedCents: 12000, spentCents: 9, budgetCents: 12000 }))
      .toEqual({ action: 'refund', amountCents: 12000, chargedCents: 0 });
  });

  it('clamps spend that drifted past the budget, so nothing is refunded and nothing extra charged', () => {
    expect(planAdSettlement({ intentStatus: 'succeeded', amountReceivedCents: 12000, spentCents: 12018, budgetCents: 12000 }))
      .toEqual({ action: 'none', chargedCents: 12000 });
  });

  it('keeps a remainder too small for Stripe to refund rather than failing forever', () => {
    expect(planAdSettlement({ intentStatus: 'succeeded', amountReceivedCents: 12000, spentCents: 11970, budgetCents: 12000 }))
      .toEqual({ action: 'none', chargedCents: 12000 });
  });
});

describe('planAdSettlement — legacy holds (requires_capture)', () => {
  it('captures the delivered spend', () => {
    expect(planAdSettlement({ intentStatus: 'requires_capture', amountReceivedCents: 0, spentCents: 4500, budgetCents: 12000 }))
      .toEqual({ action: 'capture', amountCents: 4500 });
  });

  it('releases the hold under the minimum charge', () => {
    expect(planAdSettlement({ intentStatus: 'requires_capture', amountReceivedCents: 0, spentCents: 9, budgetCents: 12000 }))
      .toEqual({ action: 'release' });
  });
});

describe('planAdSettlement — nothing to do', () => {
  it('does nothing for an intent that was already refunded or cancelled', () => {
    expect(planAdSettlement({ intentStatus: 'canceled', amountReceivedCents: 0, spentCents: 100, budgetCents: 12000 }))
      .toEqual({ action: 'none', chargedCents: 0 });
  });
});

describe('pausedLongEnoughToSettle', () => {
  it('settles a campaign paused for the cap, not one paused yesterday, never an unpaused one', () => {
    const now = new Date('2026-09-02T00:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    expect(pausedLongEnoughToSettle(new Date(now.getTime() - PAUSED_CAMPAIGN_SETTLE_AFTER_DAYS * day), now)).toBe(true);
    expect(pausedLongEnoughToSettle(new Date(now.getTime() - day), now)).toBe(false);
    expect(pausedLongEnoughToSettle(null, now)).toBe(false);
  });
});

describe('settlementFigures — what the advertiser is shown', () => {
  it('reports the refund and the kept charge for a refund plan', () => {
    expect(settlementFigures({ action: 'refund', amountCents: 7500, chargedCents: 4500 }))
      .toEqual({ chargedCents: 4500, refundedCents: 7500 });
  });

  it('reports a full-budget delivery as charged with nothing refunded', () => {
    expect(settlementFigures({ action: 'none', chargedCents: 12000 })).toEqual({ chargedCents: 12000, refundedCents: 0 });
  });

  it('never calls a lapsed legacy hold a refund', () => {
    expect(settlementFigures({ action: 'capture', amountCents: 4500 })).toEqual({ chargedCents: 4500, refundedCents: 0 });
    expect(settlementFigures({ action: 'release' })).toEqual({ chargedCents: 0, refundedCents: 0 });
  });
});
