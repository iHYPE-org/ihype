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
import { STRIPE_FIXED_CENTS, STRIPE_PERCENT, stripeCutOf } from '@/lib/stripe-fees';
import {
  NON_PAYMENT_PAUSE_DAYS,
  PAYMENT_AUTO_CONFIRM_DAYS,
  SETTLEMENT_DAYS_AFTER_SHOW,
  SPLIT_AGREEMENT_VERSION,
} from '@/lib/split-agreement';

/** Bump when any sentence the disclosure states changes meaning.
 *  2026-09-27.1: the venue keeps every sale and pays each act under a signed
 *  Show Revenue Split Agreement (DESIGN_SYNC row 528); nothing passes through
 *  iHYPE. */
export const MONEY_TERMS_VERSION = '2026-09-27.1';

export type MoneyTermsRole = 'ARTIST' | 'VENUE';

/** The face value the worked example uses. */
export const MONEY_TERMS_EXAMPLE_CENTS = 2000;
/** The artist percentage the worked example assumes. It is only an example:
 *  every act's percentage is whatever its signed offer says. */
export const MONEY_TERMS_EXAMPLE_ARTIST_PERCENT = 70;

/**
 * One $20 ticket under an offer of 70%: the buyer pays $20 plus tax, the
 * whole charge lands on the venue's Stripe account, Stripe takes its fee from
 * the venue, and the venue owes the act 70% of the $20 (card fees are the
 * venue's cost, Agreement 4.4).
 */
export function moneyTermsExample(faceValueCents = MONEY_TERMS_EXAMPLE_CENTS, artistPercent = MONEY_TERMS_EXAMPLE_ARTIST_PERCENT) {
  if (!Number.isInteger(faceValueCents) || faceValueCents <= 0) {
    throw new Error('The money-terms example needs a sellable face value.');
  }
  const fee = stripeCutOf(faceValueCents);
  const artist = Math.round((faceValueCents * artistPercent) / 100);
  return { faceValueCents, fee, artist, venue: faceValueCents - fee - artist, artistPercent };
}

export const MONEY_TERMS_FACTS = {
  stripePercent: Math.round(STRIPE_PERCENT * 1000) / 10,
  stripeFixedCents: STRIPE_FIXED_CENTS,
  settlementDays: SETTLEMENT_DAYS_AFTER_SHOW,
  autoConfirmDays: PAYMENT_AUTO_CONFIRM_DAYS,
  pauseDays: NON_PAYMENT_PAUSE_DAYS,
  agreementVersion: SPLIT_AGREEMENT_VERSION,
} as const;

export function isMoneyTermsRole(type: string | null | undefined): type is MoneyTermsRole {
  return type === 'ARTIST' || type === 'VENUE';
}
