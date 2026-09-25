/**
 * THE MONEY TERMS AN ARTIST OR VENUE AGREES TO BEFORE TAKING A SALE
 * (owner, 2026-09-25: "I want TOTAL transparency, no one should be blindsided
 * by throwing an event and selling tickets without understanding how much gets
 * taken off each ticket and who has the responsibility to manage money. We
 * simply don't have the staff to do this").
 *
 * iHYPE has no finance or support staff, so the split is built to need none:
 * the venue is the seller on every sale and Stripe moves the money. That only
 * works if every artist and venue knows, before a ticket is sold, exactly what
 * comes off each ticket and whose job each money task is. This module is the
 * version of those terms the UI shows and the Connect route records, so the
 * two cannot drift: change the terms and bump the version, and every account
 * is asked again the next time it connects payouts.
 *
 * Pure: no database, no Stripe — imported by client components and routes.
 */
import { splitFaceValueCents } from '@/lib/show-detail';
import { ARTIST_SHARE_PERCENT, VENUE_SHARE_PERCENT } from '@/lib/ticketing';
import { PAYOUT_HOLD_DAYS } from '@/lib/payout-release';
import { STRIPE_FIXED_CENTS, STRIPE_PERCENT } from '@/lib/stripe-fees';

/** Bump when any sentence the disclosure states changes meaning. */
export const MONEY_TERMS_VERSION = '2026-09-25';

export type MoneyTermsRole = 'ARTIST' | 'VENUE';

/** The face value the worked example uses. */
export const MONEY_TERMS_EXAMPLE_CENTS = 2000;

export function moneyTermsExample(faceValueCents = MONEY_TERMS_EXAMPLE_CENTS) {
  const shares = splitFaceValueCents(faceValueCents, {
    artist: ARTIST_SHARE_PERCENT,
    venue: VENUE_SHARE_PERCENT,
  });
  if (!shares) throw new Error('The money-terms example needs a sellable face value.');
  return { faceValueCents, ...shares };
}

export const MONEY_TERMS_FACTS = {
  artistPercent: ARTIST_SHARE_PERCENT,
  venuePercent: VENUE_SHARE_PERCENT,
  stripePercent: Math.round(STRIPE_PERCENT * 1000) / 10,
  stripeFixedCents: STRIPE_FIXED_CENTS,
  payoutHoldDays: PAYOUT_HOLD_DAYS,
} as const;

export function isMoneyTermsRole(type: string | null | undefined): type is MoneyTermsRole {
  return type === 'ARTIST' || type === 'VENUE';
}
