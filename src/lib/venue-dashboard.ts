import { db } from '@/lib/db';
import { getProfileInsights } from '@/lib/profile-insights';

export type VenueDashboardActivity = {
  id: string;
  text: string;
  at: Date;
  color: string;
};

export type VenueDashboardShow = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  ticketsSoldCount: number;
  ticketCapacity: number | null;
  status: string;
};

export type VenueDashboardData = {
  showsBookedCount: number;
  upcomingShowsCount: number;
  pendingBookingRequestCount: number;
  ticketsSoldAllTime: number;
  thisMonthEarningsCents: number;
  nextPayout: { label: string; amountCents?: number; estimated: boolean } | null;
  upcomingShows: VenueDashboardShow[];
  activity: VenueDashboardActivity[];
  nextScannableShowSlug: string | null;
};

const ACTIVITY_LIMIT = 6;
const UPCOMING_LIMIT = 5;
const PROMOTER_WINDOW_DAYS = 7;
// Matches the "0 13 * * *" show-payouts cron entry in wrangler.cron.toml —
// the real, only schedule that ever releases a PENDING AccountsPayableEntry.
const PAYOUT_CRON_HOUR_UTC = 13;

function nextCronRun(from: Date): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), PAYOUT_CRON_HOUR_UTC, 0, 0));
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/**
 * Owner-only aggregate data for the Venue Dashboard hub. Every number here is
 * a real Prisma query result — no projections, no placeholders. "This
 * month's earnings" is summed directly from TicketOrder.venuePayoutCents
 * (the venue's actual stored 20%-style split for each captured order), not
 * derived from getProfileInsights' ticketRevenueCents — that field is gross
 * ticket-order revenue across all three payout parties, so treating it as
 * "the venue's share" would misrepresent the number. getProfileInsights is
 * still reused here for pendingBookingRequestCount and all-time ticketsSold.
 */
export async function getVenueDashboardData(profileId: string): Promise<VenueDashboardData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const promoterWindowStart = new Date(now.getTime() - PROMOTER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [insights, shows, pendingPayoutEntries, recentBookingRequests, promoterOrders] = await Promise.all([
    getProfileInsights(profileId, 'VENUE'),
    db.show.findMany({
      where: { venueProfileId: profileId },
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        status: true,
        isTicketed: true,
        ticketsSoldCount: true,
        ticketCapacity: true,
        headlinerProfile: { select: { name: true } },
        ticketOrders: { where: { status: 'CAPTURED' }, select: { venuePayoutCents: true, createdAt: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    db.accountsPayableEntry.findMany({
      where: { profileId, category: 'VENUE_PAYOUT', status: 'PENDING' },
      select: { amountCents: true, show: { select: { status: true, startsAt: true, endsAt: true } } },
    }),
    db.bookingRequest.findMany({
      where: { toProfileId: profileId },
      orderBy: { updatedAt: 'desc' },
      take: ACTIVITY_LIMIT * 2,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        fromUser: { select: { name: true, username: true } },
      },
    }),
    db.ticketOrder.findMany({
      where: {
        show: { venueProfileId: profileId },
        affiliatePromoterProfileId: { not: null },
        status: 'CAPTURED',
        createdAt: { gte: promoterWindowStart },
      },
      select: { quantity: true },
    }),
  ]);

  const upcomingShows = shows.filter((s) => s.status === 'LIVE' || s.startsAt >= now);

  let thisMonthEarningsCents = 0;
  for (const s of shows) {
    for (const order of s.ticketOrders) {
      if (order.createdAt >= monthStart) thisMonthEarningsCents += order.venuePayoutCents;
    }
  }

  // A PENDING entry for a show that has already ENDED will be released on
  // the next daily payout cron run; one still tied to a future show only
  // pays out once that show ends (no fixed date exists for it yet).
  const endedPending = pendingPayoutEntries.filter((e) => e.show.status === 'ENDED');
  const futurePending = pendingPayoutEntries.filter((e) => e.show.status !== 'ENDED');

  let nextPayout: VenueDashboardData['nextPayout'] = null;
  if (endedPending.length > 0) {
    const amountCents = endedPending.reduce((sum, e) => sum + e.amountCents, 0);
    nextPayout = {
      label: nextCronRun(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amountCents,
      estimated: false,
    };
  } else if (futurePending.length > 0) {
    const soonest = futurePending.reduce<Date | null>((min, e) => {
      const d = e.show.endsAt ?? e.show.startsAt;
      return !min || d < min ? d : min;
    }, null);
    if (soonest) {
      nextPayout = {
        label: `After ${soonest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} show ends`,
        estimated: true,
      };
    }
  }

  const activity: VenueDashboardActivity[] = [];
  for (const r of recentBookingRequests) {
    const name = r.fromUser.name ?? r.fromUser.username ?? 'A fan';
    if (r.status === 'accepted') {
      activity.push({ id: r.id, text: `${name}'s booking request was accepted`, at: r.updatedAt, color: 'var(--role-venue, #22e5d4)' });
    } else if (r.status === 'declined') {
      activity.push({ id: r.id, text: `Booking request from ${name} was declined`, at: r.updatedAt, color: 'var(--ink-a50)' });
    } else {
      activity.push({ id: r.id, text: `New booking request from ${name}`, at: r.createdAt, color: 'var(--accent)' });
    }
  }

  const promoterTicketsSold = promoterOrders.reduce((sum, o) => sum + o.quantity, 0);
  if (promoterTicketsSold > 0) {
    activity.push({
      id: 'promoter-sales',
      text: `${promoterTicketsSold} ticket${promoterTicketsSold === 1 ? '' : 's'} sold via promoter HYPE Links this week`,
      at: now,
      color: '#b983ff',
    });
  }

  activity.sort((a, b) => b.at.getTime() - a.at.getTime());

  const nextScannable = upcomingShows.find((s) => s.isTicketed);

  return {
    showsBookedCount: shows.length,
    upcomingShowsCount: upcomingShows.length,
    pendingBookingRequestCount: insights.bookingRequests.pending,
    ticketsSoldAllTime: insights.ticketsSold ?? 0,
    thisMonthEarningsCents,
    nextPayout,
    upcomingShows: upcomingShows.slice(0, UPCOMING_LIMIT).map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.headlinerProfile?.name ?? s.title,
      startsAt: s.startsAt,
      ticketsSoldCount: s.ticketsSoldCount,
      ticketCapacity: s.ticketCapacity,
      status: s.status,
    })),
    activity: activity.slice(0, ACTIVITY_LIMIT),
    nextScannableShowSlug: nextScannable?.slug ?? null,
  };
}
