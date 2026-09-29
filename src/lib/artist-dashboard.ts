import { db } from '@/lib/db';
import { payoutHoldEndsAt } from '@/lib/payout-release';
import { settlementDateFor } from '@/lib/split-agreement';

export type ArtistDashboardStats = {
  /**
   * Sum of RELEASED ARTIST_PAYOUT AccountsPayableEntry rows paid this calendar
   * month — real money already transferred, not a projection.
   *
   * This is NOT the venue dashboard's `thisMonthEarningsCents`, which sums the
   * venue's split of every CAPTURED order this month, i.e. money earned rather
   * than money received. Both cards are labelled "This Month" and the two
   * quantities diverge for the ten days of the payout hold — and for the whole
   * life of a `VENUE_DIRECT` show, where the venue's share never becomes a
   * payable at all. Each card's sub-line names its own quantity; read
   * `venue-dashboard.ts`'s comment at the sum before changing either.
   */
  monthEarningsCents: number;
  /** Tickets sold (quantity, CAPTURED orders) on this artist's shows this calendar month. */
  ticketsSoldThisMonth: number;
  /**
   * The soonest date a pending payout is expected to move: the earliest
   * startsAt/endsAt among shows that still have a PENDING ARTIST_PAYOUT
   * entry for this profile. Payouts release automatically once a show ends
   * (src/lib/show-payouts.ts's triggerShowPayouts, run via cron) — there is
   * no fixed payout schedule in this codebase, so this is the best honest
   * answer to "next payout date," not a guarantee.
   */
  nextPayoutAt: Date | null;
  /** The show has not ENDED yet, so the date above is the earliest possible. */
  nextPayoutAwaitingShow: boolean;
  /**
   * Where the date comes from. `agreement`: the settlement date of a signed
   * split (SETTLEMENT_DAYS_AFTER_SHOW past the show — the venue pays the act
   * itself, and nothing here moves money). `payable`: a PENDING payable from
   * a sale under an older mode, released by the payout cron. Until the audit
   * of 2026-09-29 only the second was read, so an act under the split
   * agreement read "No pending payout" while the venue owed it.
   */
  nextPayoutSource: 'agreement' | 'payable' | null;
  /** Fans who hyped this profile in the last 7 days — ProfileHypeEvent is profile-level, not per-track. */
  hypesThisWeek: number;
  /** Tickets sold (quantity, CAPTURED orders) on this artist's shows in the last 7 days. */
  ticketsSoldThisWeek: number;
};

/**
 * Owner-only real aggregates for the Artist Dashboard hub. Deliberately
 * separate from getProfileInsights (src/lib/profile-insights.ts), which
 * covers lifetime totals — this covers the month/week-scoped numbers the
 * dashboard's earnings + activity cards need, reusing the same
 * AccountsPayableEntry rows the real payout pipeline writes.
 */
export async function getArtistDashboardStats(profileId: string): Promise<ArtistDashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [monthReleased, monthOrders, weekOrders, weekHypes, nextPendingEntry, agreements] = await Promise.all([
    db.accountsPayableEntry.aggregate({
      where: {
        profileId,
        category: 'ARTIST_PAYOUT',
        status: 'RELEASED',
        paidAt: { gte: startOfMonth },
      },
      _sum: { amountCents: true },
    }),
    db.ticketOrder.aggregate({
      where: {
        status: 'CAPTURED',
        createdAt: { gte: startOfMonth },
        show: { headlinerProfileId: profileId },
      },
      _sum: { quantity: true },
    }),
    db.ticketOrder.aggregate({
      where: {
        status: 'CAPTURED',
        createdAt: { gte: sevenDaysAgo },
        show: { headlinerProfileId: profileId },
      },
      _sum: { quantity: true },
    }),
    db.profileHypeEvent.count({
      where: { profileId, createdAt: { gte: sevenDaysAgo } },
    }),
    db.accountsPayableEntry.findFirst({
      where: { profileId, category: 'ARTIST_PAYOUT', status: 'PENDING' },
      select: { show: { select: { startsAt: true, endsAt: true, status: true } } },
      orderBy: { show: { startsAt: 'asc' } },
    }),
    /* The signed agreements: what the venue owes this act and when. */
    db.showSplitAgreement.findMany({
      where: { artistProfileId: profileId, supersededAt: null, show: { status: { not: 'CANCELED' } } },
      select: {
        show: { select: { startsAt: true, status: true, ticketOrders: { where: { status: 'CAPTURED' }, take: 1, select: { id: true } } } },
        payment: { select: { artistConfirmedAt: true, paidMarkedAt: true, paidAmountCents: true } },
      },
    }),
  ]);

  /* Money the venue marked paid under a signed split this month: the act's
     analogue of a released payable. The act's own confirmation is the proof
     both parties keep; a mark alone is what the venue says. */
  const monthPaidBySplitCents = agreements.reduce((sum, a) => {
    const p = a.payment;
    return p?.paidMarkedAt && p.paidMarkedAt >= startOfMonth ? sum + (p.paidAmountCents ?? 0) : sum;
  }, 0);
  const unpaidAgreementShows = agreements
    .filter((a) => !a.payment?.artistConfirmedAt && a.show.ticketOrders.length > 0)
    .map((a) => a.show)
    .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
  const nextAgreementShow = unpaidAgreementShows[0] ?? null;
  const payableAt = nextPendingEntry?.show ? payoutHoldEndsAt(nextPendingEntry.show.startsAt) : null;
  const agreementAt = nextAgreementShow ? settlementDateFor(nextAgreementShow.startsAt) : null;
  const useAgreement = agreementAt !== null && (payableAt === null || agreementAt <= payableAt);

  return {
    monthEarningsCents: (monthReleased._sum.amountCents ?? 0) + monthPaidBySplitCents,
    ticketsSoldThisMonth: monthOrders._sum.quantity ?? 0,
    /* THE SHOW'S OWN DATE IS NOT THE PAYOUT DATE. This read the show's
       `endsAt ?? startsAt`, so the dashboard printed "Next Payout" with a
       date in the PAST for any show that had already happened — the cron
       holds a payable PAYOUT_HOLD_DAYS past the start, and only releases it
       once the show is ENDED and the payee has a Connect account. */
    nextPayoutAt: useAgreement ? agreementAt : payableAt,
    nextPayoutAwaitingShow: useAgreement
      ? nextAgreementShow!.status !== 'ENDED'
      : nextPendingEntry?.show ? nextPendingEntry.show.status !== 'ENDED' : false,
    nextPayoutSource: useAgreement ? 'agreement' : payableAt ? 'payable' : null,
    hypesThisWeek: weekHypes,
    ticketsSoldThisWeek: weekOrders._sum.quantity ?? 0,
  };
}
