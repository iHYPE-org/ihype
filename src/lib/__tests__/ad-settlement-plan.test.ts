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

describe('a sponsorship settles on unused DAYS, not on unspent budget', () => {
  /* Nothing meters a sponsorship, so `spentCents` is 0 for all of these. Under
     the metered planner that would refund the whole thing on every campaign,
     including one that ran its full term — which is why the model is carried
     on the row rather than guessed. */
  const term = { pricingModel: 'SPONSORSHIP' as const, runDays: 90, spentCents: 0, budgetCents: 7500 };
  const now = new Date('2026-09-10T12:00:00.000Z');
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  it('keeps the whole charge when the term ran out', () => {
    const plan = planAdSettlement({ ...term, intentStatus: 'succeeded', amountReceivedCents: 7500, endsAt: daysFromNow(-1), now });
    expect(plan).toEqual({ action: 'none', chargedCents: 7500 });
  });

  it('refunds the unused third of a term cancelled with 30 of 90 days left', () => {
    const plan = planAdSettlement({ ...term, intentStatus: 'succeeded', amountReceivedCents: 7500, endsAt: daysFromNow(30), now });
    expect(plan).toEqual({ action: 'refund', amountCents: 2500, chargedCents: 5000 });
  });

  it('refunds everything when the term never started', () => {
    /* No `endsAt` means it was never authorised into a window, so the sponsor
       paid and got no airtime at all. */
    const plan = planAdSettlement({ ...term, intentStatus: 'succeeded', amountReceivedCents: 7500, endsAt: null, now });
    expect(plan).toEqual({ action: 'refund', amountCents: 7500, chargedCents: 0 });
  });

  it('keeps a remainder Stripe will not refund', () => {
    const plan = planAdSettlement({
      ...term, runDays: 30, intentStatus: 'succeeded', amountReceivedCents: 2500,
      endsAt: new Date(now.getTime() + 60 * 60 * 1000), now,
    });
    // One day of a 30-day term is 83c... under the floor it would be kept; 83c is not.
    expect(plan).toEqual({ action: 'refund', amountCents: 83, chargedCents: 2417 });
  });

  it('never refunds more than was paid', () => {
    const plan = planAdSettlement({ ...term, intentStatus: 'succeeded', amountReceivedCents: 7500, endsAt: daysFromNow(500), now });
    expect(plan.action).toBe('refund');
    if (plan.action === 'refund') expect(plan.amountCents).toBeLessThanOrEqual(7500);
  });

  it('does nothing for an intent that is not a completed charge', () => {
    expect(planAdSettlement({ ...term, intentStatus: 'canceled', amountReceivedCents: 0, endsAt: daysFromNow(10), now }))
      .toEqual({ action: 'none', chargedCents: 0 });
  });

  it('leaves a metered campaign on the old arithmetic', () => {
    /* The regression this column exists to prevent: a metered campaign that
       delivered nothing is owed everything back, where the sponsorship above
       that ran its term is owed none. */
    const plan = planAdSettlement({ intentStatus: 'succeeded', amountReceivedCents: 7500, spentCents: 0, budgetCents: 7500 });
    expect(plan).toEqual({ action: 'refund', amountCents: 7500, chargedCents: 0 });
  });
});
