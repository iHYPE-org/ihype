/**
 * WHEN A PAYABLE IS ACTUALLY RELEASED, said in one place.
 *
 * `triggerShowPayouts()` (src/lib/show-payouts.ts) is the only thing that
 * ever moves a payable to RELEASED, and it pays an entry only when FIVE
 * conditions hold at once: the category is one a Stripe transfer can carry,
 * the entry names a profile, that profile has FINISHED Connect onboarding,
 * the show is ENDED, and the show started at least PAYOUT_HOLD_DAYS ago.
 *
 * That third one is `stripeConnectOnboarded`, NOT the presence of a
 * `stripeConnectAccountId`: the id is written when Stripe creates the
 * account, before the member has completed a single screen of the hosted
 * flow, so an id alone means "started" and never "payable".
 *
 * Every member-facing surface that says anything about timing used to state
 * one sentence unconditionally -- "Released automatically once the show ends"
 * on the payouts page, "Automatically. Same night." on the payout breakdown.
 * Both are false for a tax entry (never released by anything -- remittance is
 * manual), false for a profile with no payout account (skipped on every run,
 * silently, for ever), and wrong by ten days even when everything is in place.
 * "Same night" is the pre-2026-08-27 behaviour that PAYOUT_HOLD_DAYS's own
 * docstring records removing.
 *
 * So the conditions live here, as data, and the cron reads them from here too.
 * A surface that wants to tell a member when their money arrives asks
 * `describePayableRelease()` and renders the state it gets back. Adding a
 * condition to the cron without adding it here is how the sentence goes stale
 * again -- `payout-release.test.ts` asserts the cron's own query is built from
 * these constants.
 */

/**
 * How long after a show starts before its payables are released.
 *
 * ## Why any delay at all
 *
 * Until 2026-08-27 there was none: an entry became payable the moment the show
 * flipped to ENDED, so there was ZERO window between the last note and the
 * money being gone. A dispute arriving the next morning had nothing left to
 * reverse, and Stripe debits a disputed amount plus its $15 fee from the
 * PLATFORM account whether or not the charge was settled on the act's behalf.
 * The hold is the only thing that makes recovery possible rather than
 * theoretical.
 *
 * ## Why ten days and not longer
 *
 * A card dispute can arrive up to about 120 days out, and holding artists' door
 * money for four months is not a thing a platform for artists can do. Ten days
 * covers the shape of dispute that actually happens on event tickets -- "I did
 * not authorise this", "the event was cancelled" -- which arrives before or
 * within days of the date, while a late dispute is rare and is what the
 * protection reserve exists to absorb.
 *
 * It is a deliberate trade, not a safety maximum: raising it protects the fund
 * and costs artists patience, lowering it does the reverse. Ten is the number
 * to argue with.
 */
export const PAYOUT_HOLD_DAYS = 10;

/**
 * The only categories a Stripe Connect transfer ever carries. A TAX_* entry
 * has no profileId and no Connect account -- remittance is a manual
 * accounting matter, and those entries stay PENDING for a human, for ever.
 * That is by design and is exactly why a blanket "released automatically"
 * sentence is wrong about them.
 */
export const CONNECT_PAYOUT_CATEGORIES = [
  'VENUE_PAYOUT',
  'ARTIST_PAYOUT',
  'PROMOTER_AFFILIATE',
] as const;

export type ConnectPayoutCategory = (typeof CONNECT_PAYOUT_CATEGORIES)[number];

export function isConnectPayoutCategory(category: string): category is ConnectPayoutCategory {
  return (CONNECT_PAYOUT_CATEGORIES as readonly string[]).includes(category);
}

export type PayableReleaseState =
  /** A tax entry. Nothing automated will ever release it; a human remits. */
  | { kind: 'manual-remittance' }
  /** The payee has no FINISHED Connect account — never started, or started and
   *  not completed — so every run skips this entry. */
  | { kind: 'no-destination' }
  /** The show has not ended yet. */
  | { kind: 'awaiting-show' }
  /** Ended, inside the dispute hold. `releasesOn` is when the hold lifts. */
  | { kind: 'holding'; releasesOn: Date }
  /** Every condition is met; the next payout run pays it. */
  | { kind: 'due' }
  /** The show could not be read, so nothing here can be promised. */
  | { kind: 'unknown' };

export function payoutHoldEndsAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * What a PENDING payable is actually waiting for.
 *
 * THE ORDER IS THE POINT and it is not the cron's execution order: the cron
 * filters the show first because that is the cheap index, but a member reads
 * the most permanent blocker first. A profile with no Connect account is never
 * paid whatever the show does, so "you have no payout account" must beat "the
 * show has not happened yet" -- telling that member to wait for the show is
 * precisely the lie this module exists to stop.
 *
 * Call it only for a PENDING entry. A RELEASED one has a `paidAt` that says
 * more than any prediction, and a VOID one was refunded.
 */
export function describePayableRelease(
  entry: {
    category: string;
    /** Has the payee profile FINISHED Connect onboarding (`stripeConnectOnboarded`)?
     *  NOT "does an account id exist" — that is true from the first click. */
    hasPayoutDestination: boolean;
    show: { status: string; startsAt: Date } | null;
  },
  now: Date,
): PayableReleaseState {
  if (!isConnectPayoutCategory(entry.category)) return { kind: 'manual-remittance' };
  if (!entry.hasPayoutDestination) return { kind: 'no-destination' };
  if (!entry.show) return { kind: 'unknown' };
  if (entry.show.status !== 'ENDED') return { kind: 'awaiting-show' };

  const releasesOn = payoutHoldEndsAt(entry.show.startsAt);
  if (releasesOn.getTime() > now.getTime()) return { kind: 'holding', releasesOn };
  return { kind: 'due' };
}

/**
 * The Prisma `where` for a payable the payout run SHOULD already have cleared.
 *
 * Kept beside the conditions rather than in the workbench, because the queue
 * that shows an operator "stalled payouts" and the cron that clears them must
 * agree about what stalled MEANS. They did not: the queue counted every
 * PENDING entry on an ENDED show against a 24-hour promise while the cron
 * holds for `PAYOUT_HOLD_DAYS`, so the queue was overdue by construction and
 * sat permanently at the top of a board sorted worst-first.
 *
 * Deliberately NOT the cron's own filter: this is the complement of it. The
 * cron asks "may I pay this now"; this asks "should this already be gone". So
 * it omits the destination check — an entry skipped for want of a Connect
 * account is exactly what an operator needs to see, and filtering it out here
 * would hide the one case that never resolves by itself.
 */
export function stalledPayoutWhere(now: Date) {
  return {
    status: 'PENDING' as const,
    // A TAX_* entry is manual remittance by design and is never "stalled".
    category: { in: [...CONNECT_PAYOUT_CATEGORIES] },
    show: {
      status: 'ENDED' as const,
      startsAt: { lte: new Date(now.getTime() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000) },
    },
  };
}
