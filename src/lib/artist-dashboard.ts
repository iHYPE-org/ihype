import { db } from '@/lib/db';

export type ArtistDashboardStats = {
  /** Sum of RELEASED ARTIST_PAYOUT AccountsPayableEntry rows paid this calendar month — real money already transferred, not a projection. */
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

  const [monthReleased, monthOrders, weekOrders, weekHypes, nextPendingEntry] = await Promise.all([
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
      select: { show: { select: { startsAt: true, endsAt: true } } },
      orderBy: { show: { startsAt: 'asc' } },
    }),
  ]);

  return {
    monthEarningsCents: monthReleased._sum.amountCents ?? 0,
    ticketsSoldThisMonth: monthOrders._sum.quantity ?? 0,
    nextPayoutAt: nextPendingEntry?.show ? (nextPendingEntry.show.endsAt ?? nextPendingEntry.show.startsAt) : null,
    hypesThisWeek: weekHypes,
    ticketsSoldThisWeek: weekOrders._sum.quantity ?? 0,
  };
}
