import { db } from '@/lib/db';
import { CONNECT_PAYOUT_CATEGORIES } from '@/lib/payout-release';

/**
 * WHAT IS OWED AND CANNOT BE PAID, for the operator surfaces that report money
 * coming IN and say nothing about whether any of it can go OUT.
 *
 * The daily ops mail reported "Revenue (24h)" and stopped there, and the alpha
 * readiness gate had no payout condition at all — not a blocking one, not a
 * reported one, nothing. On a product whose charter promise is the artist's
 * share, the one figure an operator most needs beside revenue is whether it can
 * actually reach the act, and until this module nothing anywhere computed it.
 *
 * TWO NUMBERS, BECAUSE THEY ARE DIFFERENT PROBLEMS WITH DIFFERENT OWNERS.
 *
 *  - `unpayableCents` is money owed to a payee the payout run will skip on
 *    every pass, for ever: a transferable payable whose profile has not
 *    FINISHED Connect onboarding (`stripeConnectOnboarded`; the account id
 *    alone is written on the first click and means "started"). Somebody has to
 *    ask that member to finish, and nothing else will.
 *  - `manualRemittanceCents` is the TAX_* entries, which no automation ever
 *    releases by design. It is not a fault; it is a standing human task that
 *    has never been visible anywhere.
 *
 * REPORTED, NEVER A GATE. `ALPHA_CONTENT_TARGETS` already made this call for
 * uploads — the doors do not wait — and the same reasoning is stronger here:
 * at an invite-only alpha where no venue has completed onboarding, a blocking
 * condition would be red from the first day for a reason nobody can clear
 * today, and a check that is red every morning is one people stop reading.
 * That failure is recorded twice in this repository already.
 *
 * Each read is independently caught and returns `null`, never `0`: a figure
 * that could not be read must render as a dash, because `0` here is the claim
 * "everyone can be paid", which is the single most reassuring thing this
 * module could say and the one it must never say by accident.
 */
export type UnpayableBalance = {
  /** Owed to payees with no finished Connect account, in cents. `null` = unread. */
  unpayableCents: number | null;
  /** Distinct payees in that state. `null` = unread. */
  unpayablePayees: number | null;
  /** Owed as TAX_* entries, which nothing automated ever releases. `null` = unread. */
  manualRemittanceCents: number | null;
};

export async function getUnpayableBalance(): Promise<UnpayableBalance> {
  const [unpayable, payees, tax] = await Promise.all([
    db.accountsPayableEntry
      .aggregate({
        where: {
          status: 'PENDING',
          category: { in: [...CONNECT_PAYOUT_CATEGORIES] },
          profile: { stripeConnectOnboarded: false },
        },
        _sum: { amountCents: true },
      })
      .then((r) => r._sum.amountCents ?? 0)
      .catch(() => null),
    db.accountsPayableEntry
      .findMany({
        where: {
          status: 'PENDING',
          category: { in: [...CONNECT_PAYOUT_CATEGORIES] },
          profile: { stripeConnectOnboarded: false },
        },
        select: { profileId: true },
        distinct: ['profileId'],
      })
      .then((rows) => rows.length)
      .catch(() => null),
    db.accountsPayableEntry
      .aggregate({
        where: { status: 'PENDING', category: { notIn: [...CONNECT_PAYOUT_CATEGORIES] } },
        _sum: { amountCents: true },
      })
      .then((r) => r._sum.amountCents ?? 0)
      .catch(() => null),
  ]);

  return { unpayableCents: unpayable, unpayablePayees: payees, manualRemittanceCents: tax };
}

/** A dash for an unread figure; never a zero. */
export function centsOrDash(cents: number | null): string {
  return cents === null ? '—' : `$${(cents / 100).toFixed(2)}`;
}
