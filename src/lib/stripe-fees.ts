/**
 * Stripe's processing fee, paid by the buyer.
 *
 * iHYPE is a nonprofit and absorbs no fee of any kind: the charter's 70/20/10
 * is a split of the FACE VALUE, and the platform takes $0. Stripe still charges
 * for moving the money, so that cost is added to the buyer's total and
 * disclosed as its own line before payment. It is not part of the split, and
 * artists, venues and promoters are paid as if it did not exist.
 *
 * ## Why this grosses up instead of adding a percentage
 *
 * Stripe's fee applies to the TOTAL it processes, including the part that is
 * the fee itself. Adding `2.9% + 30¢` of the subtotal therefore under-collects,
 * and the shortfall lands on the platform — which is the one outcome this
 * module exists to prevent.
 *
 *   $18.00 ticket, naive:      2.9% × 1800 + 30 = 82¢ → charge 1882
 *                              Stripe then takes 2.9% × 1882 + 30 = 85¢
 *                              iHYPE absorbs 3¢.
 *
 *   $18.00 ticket, grossed up: (1800 + 30) ÷ (1 − 0.029) = 1884.65 → 1885
 *                              fee 85¢, Stripe takes 2.9% × 1885 + 30 = 85¢
 *                              iHYPE absorbs 0.
 *
 * The three-cent gap is why the design mock's "$0.82" is not what this returns
 * for an $18 ticket; it returns 85¢, and the difference is the whole point.
 *
 * ## The Amex problem, stated rather than hidden
 *
 * American Express costs 3.5% + 30¢ where the standard rate is 2.9% + 30¢, and
 * the card brand is not known until the buyer has already been charged. Quoting
 * the Amex rate to everyone would overcharge the majority; quoting the standard
 * rate and taking Amex means absorbing the difference on those orders. This
 * uses the STANDARD rate, so an Amex order currently under-collects by 0.6% of
 * the total (~11¢ on an $18 ticket). Closing that needs a card-brand-aware
 * quote at payment time, which needs a payment sheet that reports the brand
 * before confirmation — noted here so the gap is a known number rather than a
 * surprise in a reconciliation.
 */

/** Standard US card rate. Non-US rates differ and are not modelled yet. */
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;

export type ProcessingFee = {
  /** What the buyer pays on top of the ticket and its taxes. */
  feeCents: number;
  /** What Stripe is asked to charge, in total. */
  totalCents: number;
};

/**
 * Grosses `amountCents` up so that Stripe's cut leaves exactly `amountCents`
 * behind. `amountCents` is the ticket subtotal PLUS any taxes, because Stripe
 * charges on everything it processes.
 *
 * Rounds the total UP: a half-cent left on the platform is the platform
 * absorbing a fee, and the rule here is that it never does. The buyer pays at
 * most one cent more than the exact figure.
 */
export function calculateProcessingFee(amountCents: number): ProcessingFee {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    // A free ticket is genuinely free — Stripe is never called, so there is no
    // fee to pass on. Returning 30¢ here would invent a charge on a $0 order.
    return { feeCents: 0, totalCents: 0 };
  }
  const totalCents = Math.ceil((amountCents + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT));
  return { feeCents: totalCents - amountCents, totalCents };
}

/**
 * What Stripe will actually deduct from a charge of `totalCents`. Used to check
 * that a quoted fee covers the real one — the assertion the gross-up exists to
 * satisfy, and the thing a test can hold onto.
 */
export function stripeCutOf(totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.round(totalCents * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
}
