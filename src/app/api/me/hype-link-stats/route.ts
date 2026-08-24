import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * The HYPE link's own scoreboard (owner, 2026-08-24), for the top of
 * Settings. Eight figures, every one from a real table.
 *
 * The analytics rule from `analytics-engine.ts` governs the shape: each
 * figure resolves independently and a failure returns NULL, which the UI
 * renders as an em dash — a dashboard showing 0 for "could not read" is
 * worse than one showing nothing, because 0 is a claim.
 *
 * Definitions, each traceable to its table:
 *  - hypesEarned   — HYPE credited to the account: positive HypeLedgerEntry
 *                    amounts summed (referral awards, badges, every source).
 *  - hypesGiven    — hypes this account pressed: ProfileHypeEvent rows plus
 *                    show-level HypeEvent rows, both unique per target.
 *  - ticketReferrals — captured ticket orders that carried this account's
 *                    profile as the affiliate promoter.
 *  - dollarsEarnedCents — the promoter's 10%: PROMOTER_AFFILIATE payable
 *                    entries on this account's profiles, PENDING + RELEASED
 *                    (accrued and paid; VOID means the order was refunded).
 *  - newUsers      — signups attributed to the link: FAN_REFERRED ledger
 *                    awards, one per referred user by idempotency key.
 *  - artistsHyped / venuesHyped — distinct profiles hyped, by type (the
 *                    per-profile unique constraint makes count = distinct).
 *  - advertisersHyped — NULL, honestly: advertisers are private accounts
 *                    with no Profile row and no hype surface. The moment a
 *                    mechanism exists this becomes a query; until then an
 *                    em dash is the truth and 0 would be a fabrication.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });
  const userId = session.user.id;

  const quiet = <T,>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

  const myProfileIds = await db.profile
    .findMany({ where: { ownerId: userId }, select: { id: true } })
    .then((rows) => rows.map((row) => row.id))
    .catch(() => null);

  const [
    hypesEarned,
    profileHypesGiven,
    showHypesGiven,
    ticketReferrals,
    dollarsEarned,
    newUsers,
    artistsHyped,
    venuesHyped,
  ] = await Promise.all([
    quiet(db.hypeLedgerEntry.aggregate({ where: { userId, amount: { gt: 0 } }, _sum: { amount: true } })),
    quiet(db.profileHypeEvent.count({ where: { userId } })),
    quiet(db.hypeEvent.count({ where: { userId } })),
    myProfileIds
      ? quiet(db.ticketOrder.count({
          where: { affiliatePromoterProfileId: { in: myProfileIds }, status: 'CAPTURED' },
        }))
      : Promise.resolve(null),
    myProfileIds
      ? quiet(db.accountsPayableEntry.aggregate({
          where: {
            profileId: { in: myProfileIds },
            category: 'PROMOTER_AFFILIATE',
            status: { in: ['PENDING', 'RELEASED'] },
          },
          _sum: { amountCents: true },
        }))
      : Promise.resolve(null),
    quiet(db.hypeLedgerEntry.count({ where: { userId, source: 'FAN_REFERRED' } })),
    quiet(db.profileHypeEvent.count({ where: { userId, profile: { type: 'ARTIST' } } })),
    quiet(db.profileHypeEvent.count({ where: { userId, profile: { type: 'VENUE' } } })),
  ]);

  return NextResponse.json({
    hypesEarned: hypesEarned?._sum.amount ?? (hypesEarned ? 0 : null),
    hypesGiven: profileHypesGiven === null || showHypesGiven === null
      ? null
      : profileHypesGiven + showHypesGiven,
    ticketReferrals,
    dollarsEarnedCents: dollarsEarned ? (dollarsEarned._sum.amountCents ?? 0) : null,
    newUsers,
    artistsHyped,
    venuesHyped,
    advertisersHyped: null,
  });
}
