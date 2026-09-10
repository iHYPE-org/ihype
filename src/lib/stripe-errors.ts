/**
 * Is this error Stripe telling us it cannot be reached or cannot serve us —
 * as opposed to Stripe refusing THIS request on its merits?
 *
 * Duck-typed on the `type` string stripe-node puts on every error it throws,
 * so the classifier needs no Stripe instance and the unit suite can hand it a
 * plain object. The four that mean "unavailable": the SDK could not connect,
 * Stripe answered 5xx, Stripe is rate-limiting us, or our key is wrong. A card
 * declined or an invalid parameter is not unavailability and stays a normal
 * error — the buyer, or the code, did something Stripe answered.
 *
 * Used by the purchase route to answer 503 with `PAYMENTS_UNAVAILABLE` rather
 * than a generic 500: the buyer reads "card payments are unavailable right
 * now, nothing was charged" instead of "could not complete", and the admin
 * board can tell an outage from a bug.
 */
const UNAVAILABLE_TYPES = new Set([
  'StripeConnectionError',
  'StripeAPIError',
  'StripeRateLimitError',
  'StripeAuthenticationError',
]);

export function isStripeUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const type = (error as { type?: unknown }).type;
  return typeof type === 'string' && UNAVAILABLE_TYPES.has(type);
}

export const PAYMENTS_UNAVAILABLE_MESSAGE =
  'Card payments are unavailable right now. Nothing was charged and your seats were released — please try again in a few minutes.';
