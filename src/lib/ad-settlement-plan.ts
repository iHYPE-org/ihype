/**
 * What to do with a campaign's money when the campaign is over — pure, so the
 * arithmetic is tested without Stripe.
 *
 * Campaigns are CHARGED UP FRONT as of 2026-09-02 (owner decision after the
 * security sweep): checkout captures the whole budget the moment the
 * advertiser pays, and settlement REFUNDS whatever was not spent. Before this
 * the budget was only authorised (`capture_method: 'manual'`) and captured at
 * the end — but a card authorisation lives about seven days and campaigns
 * run seven to ninety, and a pause was unbounded, so any campaign longer than
 * a week delivered its impressions and then could not be billed at all.
 *
 * Two shapes of PaymentIntent reach settlement, and the plan handles both:
 *   - `succeeded`        — charged up front (every campaign paid after this
 *                          change). Refund `budget - spent`; refund it all when
 *                          delivery was under Stripe's minimum charge, since
 *                          we delivered too little to bill for.
 *   - `requires_capture` — a hold from before the change, still open. Capture
 *                          the spend, or release the hold under the minimum.
 * Anything else (already refunded, cancelled, still processing) is nothing to
 * do — the caller stamps `settledAt` and stops retrying.
 */

/** Stripe will not charge, capture or refund below this (USD). */
export const STRIPE_MINIMUM_CHARGE_CENTS = 50;

export type AdSettlementPlan =
  | { action: 'refund'; amountCents: number; chargedCents: number }
  | { action: 'capture'; amountCents: number }
  | { action: 'release' }
  | { action: 'none'; chargedCents: number };

/**
 * `spentCents` can drift a few cents over `budgetCents` (the impression
 * route's conditional increment steps in fixed amounts), so the charge is
 * always clamped to what the advertiser actually paid for.
 */
export function planAdSettlement(input: {
  intentStatus: string;
  amountReceivedCents: number;
  spentCents: number;
  budgetCents: number;
}): AdSettlementPlan {
  const delivered = Math.max(0, Math.min(input.spentCents, input.budgetCents));

  if (input.intentStatus === 'requires_capture') {
    if (delivered < STRIPE_MINIMUM_CHARGE_CENTS) return { action: 'release' };
    return { action: 'capture', amountCents: delivered };
  }

  if (input.intentStatus === 'succeeded') {
    const paid = Math.max(0, input.amountReceivedCents);
    // Under the minimum we bill nothing, so everything paid comes back.
    const keep = delivered < STRIPE_MINIMUM_CHARGE_CENTS ? 0 : delivered;
    const refund = Math.max(0, paid - keep);
    // Stripe refuses a refund under its floor too; a remainder that small is
    // kept rather than failing the settlement forever.
    if (refund < STRIPE_MINIMUM_CHARGE_CENTS) return { action: 'none', chargedCents: paid };
    return { action: 'refund', amountCents: refund, chargedCents: paid - refund };
  }

  return { action: 'none', chargedCents: 0 };
}

/**
 * The two figures the advertiser is shown after settlement, derived from the
 * plan so the dashboard and the email cannot disagree with what Stripe was
 * asked to do. A legacy capture "refunds" nothing — the hold simply lapses on
 * the uncaptured part — so `refundedCents` is the released amount only when
 * a real refund was issued.
 */
export function settlementFigures(plan: AdSettlementPlan): { chargedCents: number; refundedCents: number } {
  switch (plan.action) {
    case 'refund':
      return { chargedCents: plan.chargedCents, refundedCents: plan.amountCents };
    case 'none':
      return { chargedCents: plan.chargedCents, refundedCents: 0 };
    case 'capture':
      return { chargedCents: plan.amountCents, refundedCents: 0 };
    case 'release':
      return { chargedCents: 0, refundedCents: 0 };
  }
}

/**
 * Stripe's own published window for a card refund to show on a statement.
 * Quoted everywhere the refund is promised so checkout, the confirm dialog,
 * the dashboard and the email name the same number.
 */
export const REFUND_WINDOW_BUSINESS_DAYS = '5–10';

/**
 * A paused campaign holds the advertiser's money with no end date. After this
 * long it is settled as if cancelled — the unspent budget goes back — rather
 * than sitting on iHYPE's balance indefinitely.
 */
export const PAUSED_CAMPAIGN_SETTLE_AFTER_DAYS = 60;

export function pausedLongEnoughToSettle(pausedAt: Date | null, now: Date = new Date()): boolean {
  if (!pausedAt) return false;
  return now.getTime() - pausedAt.getTime() >= PAUSED_CAMPAIGN_SETTLE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
