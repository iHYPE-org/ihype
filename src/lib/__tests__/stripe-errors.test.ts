import { describe, expect, it } from 'vitest';
import { isStripeUnavailable } from '@/lib/stripe-errors';

/**
 * The purchase route answers 503 PAYMENTS_UNAVAILABLE for exactly the errors
 * that mean Stripe cannot serve anyone right now, and a normal error for the
 * ones that mean Stripe answered THIS request. Duck-typed on stripe-node's
 * `type`, so the suite hands it plain objects.
 */
describe('isStripeUnavailable', () => {
  it('names the four unavailability shapes', () => {
    for (const type of ['StripeConnectionError', 'StripeAPIError', 'StripeRateLimitError', 'StripeAuthenticationError']) {
      expect(isStripeUnavailable(Object.assign(new Error(type), { type })), type).toBe(true);
    }
  });

  it('leaves a declined card, a bad parameter, and anything not from Stripe as ordinary errors', () => {
    expect(isStripeUnavailable(Object.assign(new Error('declined'), { type: 'StripeCardError' }))).toBe(false);
    expect(isStripeUnavailable(Object.assign(new Error('bad param'), { type: 'StripeInvalidRequestError' }))).toBe(false);
    expect(isStripeUnavailable(new Error('database down'))).toBe(false);
    expect(isStripeUnavailable(null)).toBe(false);
    expect(isStripeUnavailable('StripeConnectionError')).toBe(false);
  });
});
