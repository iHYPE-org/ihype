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

/**
 * SPONSORSHIPS ARE NOT METERED, so their settlement is a different sum
 * (2026-09-10). A sponsor buys a TERM, and what they are owed back is the
 * part of that term they did not get: `paid x unusedDays / runDays`. There
 * is no "unspent budget", because nothing spends it — impressions are the
 * delivery report, not the meter (`ad-pricing.ts`).
 *
 * Campaigns sold under the OLD per-impression model are still settled the old
 * way, and that is why `Ad.pricingModel` exists rather than the planner
 * guessing from `spentCents`. A metered campaign that happened to deliver
 * nothing looks identical to a sponsorship on every other field, and it is
 * owed a FULL refund where the sponsorship is owed none.
 */

/** Stripe will not charge, capture or refund below this (USD). */
export const STRIPE_MINIMUM_CHARGE_CENTS = 50;

export type AdPricingModel = 'SPONSORSHIP' | 'METERED';

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
/**
 * Whole days of a sponsorship term that were never served. A term already
 * finished owes nothing; one that never started (no `endsAt`, so it was never
 * authorised into a window) owes all of it.
 */
export function unusedSponsorshipDays(input: {
  runDays: number | null | undefined;
  endsAt: Date | null | undefined;
  now: Date;
}): number {
  const term = Math.max(0, Math.round(input.runDays ?? 0));
  if (term === 0) return 0;
  if (!input.endsAt) return term;
  const msLeft = input.endsAt.getTime() - input.now.getTime();
  if (msLeft <= 0) return 0;
  return Math.min(term, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

/**
 * What a sponsorship owes back if it stopped now: the paid amount across the
 * days of the term that were never served.
 *
 * Exported because the advertiser's dashboard quotes this number BEFORE they
 * press cancel, and the settlement pays it AFTER. Two copies of that sum
 * would eventually disagree, and the one the sponsor read is the one they
 * will hold you to.
 */
export function sponsorshipRefundableCents(input: {
  paidCents: number;
  runDays: number | null | undefined;
  endsAt: Date | null | undefined;
  now: Date;
}): number {
  const paid = Math.max(0, input.paidCents);
  const term = Math.max(0, Math.round(input.runDays ?? 0));
  if (term === 0 || paid === 0) return 0;
  const unused = unusedSponsorshipDays({ runDays: term, endsAt: input.endsAt, now: input.now });
  if (unused <= 0) return 0;
  return Math.min(paid, Math.round((paid * unused) / term));
}

export function planAdSettlement(input: {
  intentStatus: string;
  amountReceivedCents: number;
  spentCents: number;
  budgetCents: number;
  /** Absent means the legacy per-impression model, which is what every campaign sold before 2026-09-10 was. */
  pricingModel?: AdPricingModel;
  runDays?: number | null;
  endsAt?: Date | null;
  now?: Date;
}): AdSettlementPlan {
  if (input.pricingModel === 'SPONSORSHIP') return planSponsorshipSettlement(input);
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

function planSponsorshipSettlement(input: {
  intentStatus: string;
  amountReceivedCents: number;
  runDays?: number | null;
  endsAt?: Date | null;
  now?: Date;
}): AdSettlementPlan {
  /* A sponsorship is charged in full at checkout, so only `succeeded` is a
     real shape here. A hold cannot occur under this model; anything else
     (already refunded, still processing) is nothing to do. */
  if (input.intentStatus !== 'succeeded') return { action: 'none', chargedCents: 0 };

  const paid = Math.max(0, input.amountReceivedCents);
  const refund = sponsorshipRefundableCents({
    paidCents: paid,
    runDays: input.runDays,
    endsAt: input.endsAt,
    now: input.now ?? new Date(),
  });

  // Ran its term: the sponsor got what they bought.
  if (refund <= 0) return { action: 'none', chargedCents: paid };
  // Stripe refuses a refund under its floor; a remainder that small is kept
  // rather than failing the settlement forever.
  if (refund < STRIPE_MINIMUM_CHARGE_CENTS) return { action: 'none', chargedCents: paid };
  return { action: 'refund', amountCents: refund, chargedCents: paid - refund };
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
