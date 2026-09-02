/**
 * The checks a Stripe event has to pass before it may move money-state,
 * beyond its signature (security sweep, 2026-09-02).
 *
 * A valid signature proves the event came from Stripe. It does NOT prove the
 * event is about the object our metadata names: connected accounts hold their
 * own API keys (`dashboard: 'full'`), and a VENUE_DIRECT sale means this
 * endpoint receives events from connected accounts. So a venue could create a
 * $0.50 Checkout Session on ITS OWN account carrying another order's
 * `confirmationCode` in metadata, pay it, and Stripe would deliver a genuine,
 * signed `checkout.session.completed` — which the handler used to accept as
 * proof the $400 order was paid. The same shape with `metadata.adId` flipped
 * a campaign to APPROVED for fifty cents.
 *
 * Three rules, all pure so they are tested:
 *   1. the event's `account` must be the account the ORDER settles on —
 *      the venue's for VENUE_DIRECT, none at all for DESTINATION/PLATFORM;
 *   2. the amount Stripe reports must be at least what the order charges;
 *   3. an ad-campaign event must come from the platform account, never a
 *      connected one, and hold at least the campaign's budget.
 */

export type SettlementSource = {
  settlementMode: string;
  settlementAccountId: string | null;
};

/** Which connected account, if any, an event about this order may come from. */
export function expectedEventAccount(order: SettlementSource): string | null {
  return order.settlementMode === 'VENUE_DIRECT' ? order.settlementAccountId : null;
}

export function ticketOrderMatchesEvent(
  order: SettlementSource,
  eventAccount: string | null | undefined,
): boolean {
  return (eventAccount ?? null) === expectedEventAccount(order);
}

/**
 * `amount` is what Stripe says was paid (`amount_total` on a session,
 * `amount` or `amount_received` on an intent). A null amount is a session
 * Stripe reports without totals; refuse rather than assume.
 */
export function amountCoversOrder(amount: number | null | undefined, totalChargeCents: number): boolean {
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= totalChargeCents;
}

/**
 * Ad campaigns are always charged on the platform account: `createAdCampaign
 * CheckoutSession` never sets `stripeAccount`. An ad event that arrives with an
 * `account` was created by a connected account and is not ours to act on.
 */
export function adEventIsPlatform(eventAccount: string | null | undefined): boolean {
  return !eventAccount;
}

export function holdCoversBudget(amountCapturable: number | null | undefined, budgetCents: number): boolean {
  return typeof amountCapturable === 'number' && Number.isFinite(amountCapturable) && amountCapturable >= budgetCents;
}

/**
 * A live-mode key must only ever act on live-mode events and vice versa. A
 * test endpoint's secret configured against a live key would otherwise let
 * `stripe trigger` drive production state.
 */
export function livemodeMatchesKey(eventLivemode: boolean, secretKey: string | null | undefined): boolean {
  if (!secretKey) return false;
  // `rk_live_` is a restricted live key; a rotation to one must not 400 every event.
  return eventLivemode === /^(sk|rk)_live_/.test(secretKey);
}
