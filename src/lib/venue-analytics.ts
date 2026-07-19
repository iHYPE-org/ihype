import { db } from '@/lib/db';

export type VenueAnalyticsRange = '7d' | '30d' | 'ytd';

export type VenueAnalyticsBucket = {
  label: string;
  attendance: number;
};

export type VenueAnalyticsTopEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  status: string;
  ticketsSoldCount: number;
  ticketCapacity: number | null;
  soldOut: boolean;
  grossCents: number;
};

export type VenueAnalyticsData = {
  range: VenueAnalyticsRange;
  totalAttendance: number;
  totalAttendanceDeltaPct: number | null;
  selloutRatePct: number | null;
  selloutRateDeltaPts: number | null;
  showsBookedCount: number;
  upcomingShowsCount: number;
  grossCents: number;
  buckets: VenueAnalyticsBucket[];
  topEvents: VenueAnalyticsTopEvent[];
};

function rangeStartFor(range: VenueAnalyticsRange, now: Date): Date {
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // ytd: calendar-year start
  return new Date(now.getFullYear(), 0, 1);
}

// Previous period of equal length, immediately before rangeStart. Only
// computed for 7d/30d — a prior-year YTD comparison is a legitimate
// question but adds a second full query pass for a number the design
// doesn't require; per the "omit rather than fabricate/over-invest" rule
// we just show the raw YTD figure with no delta.
function previousPeriodFor(range: VenueAnalyticsRange, rangeStart: Date): { start: Date; end: Date } | null {
  if (range === '7d') {
    const end = rangeStart;
    const start = new Date(rangeStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
  if (range === '30d') {
    const end = rangeStart;
    const start = new Date(rangeStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
  return null;
}

function bucketDefsFor(range: VenueAnalyticsRange, rangeStart: Date, now: Date): { start: Date; end: Date; label: string }[] {
  if (range === 'ytd') {
    const buckets: { start: Date; end: Date; label: string }[] = [];
    const monthCount = now.getMonth() + 1;
    for (let m = 0; m < monthCount; m += 1) {
      const start = new Date(now.getFullYear(), m, 1);
      const end = m === monthCount - 1 ? now : new Date(now.getFullYear(), m + 1, 1);
      buckets.push({ start, end, label: start.toLocaleDateString('en-US', { month: 'short' }) });
    }
    return buckets;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const spanDays = range === '7d' ? 7 : 30;
  const bucketSizeDays = range === '7d' ? 1 : 6; // 30d -> 5 buckets of 6 days
  const buckets: { start: Date; end: Date; label: string }[] = [];
  for (let offset = 0; offset < spanDays; offset += bucketSizeDays) {
    const start = new Date(rangeStart.getTime() + offset * dayMs);
    const end = new Date(Math.min(rangeStart.getTime() + (offset + bucketSizeDays) * dayMs, now.getTime()));
    const label = range === '7d'
      ? start.toLocaleDateString('en-US', { weekday: 'short' })
      : start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    buckets.push({ start, end, label });
  }
  return buckets;
}

/**
 * Owner-only, range-scoped analytics for a venue profile. Every figure is a
 * real Prisma aggregate over Show/TicketOrder rows for shows whose startsAt
 * falls in the selected window — no fabricated numbers or placeholder deltas.
 *
 * Gross uses TicketOrder.venuePayoutCents (the venue's own stored 20%-style
 * split for each captured order), the same real field src/lib/venue-dashboard.ts
 * uses — NOT getProfileInsights().ticketRevenueCents, which is gross
 * shared revenue across all three payout parties and would misrepresent the
 * venue's actual take.
 *
 * "Shows Booked" is scoped to the selected range (shows whose startsAt falls
 * in the window); its "+N upcoming" sub-stat is intentionally NOT range-scoped
 * — "upcoming" is inherently forward-looking and a trailing window (e.g. the
 * last 7/30 days) would make it read as permanently ~0. It reuses the same
 * all-time "shows with startsAt >= now or status LIVE" definition already
 * used by src/lib/venue-dashboard.ts.
 */
export async function getVenueAnalyticsData(profileId: string, range: VenueAnalyticsRange): Promise<VenueAnalyticsData> {
  const now = new Date();
  const rangeStart = rangeStartFor(range, now);
  const previousPeriod = previousPeriodFor(range, rangeStart);

  const [shows, upcomingShowsCount, previousShows] = await Promise.all([
    db.show.findMany({
      where: { venueProfileId: profileId, startsAt: { gte: rangeStart, lte: now } },
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        status: true,
        ticketsSoldCount: true,
        ticketCapacity: true,
        headlinerProfile: { select: { name: true } },
        ticketOrders: { where: { status: 'CAPTURED' }, select: { venuePayoutCents: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    db.show.count({
      where: { venueProfileId: profileId, OR: [{ status: 'LIVE' }, { startsAt: { gte: now } }] },
    }),
    previousPeriod
      ? db.show.findMany({
          where: { venueProfileId: profileId, startsAt: { gte: previousPeriod.start, lt: previousPeriod.end } },
          select: { ticketsSoldCount: true, ticketCapacity: true },
        })
      : Promise.resolve(null),
  ]);

  const totalAttendance = shows.reduce((sum, s) => sum + s.ticketsSoldCount, 0);
  const grossCents = shows.reduce(
    (sum, s) => sum + s.ticketOrders.reduce((orderSum, o) => orderSum + o.venuePayoutCents, 0),
    0
  );

  const capacitySum = shows.reduce((sum, s) => sum + (s.ticketCapacity ?? 0), 0);
  const soldForCapacity = shows.reduce((sum, s) => sum + (s.ticketCapacity ? Math.min(s.ticketsSoldCount, s.ticketCapacity) : 0), 0);
  const selloutRatePct = capacitySum > 0 ? Math.round((soldForCapacity / capacitySum) * 100) : null;

  let totalAttendanceDeltaPct: number | null = null;
  let selloutRateDeltaPts: number | null = null;
  if (previousShows) {
    const prevAttendance = previousShows.reduce((sum, s) => sum + s.ticketsSoldCount, 0);
    if (prevAttendance > 0) {
      totalAttendanceDeltaPct = Math.round(((totalAttendance - prevAttendance) / prevAttendance) * 100);
    }
    const prevCapacitySum = previousShows.reduce((sum, s) => sum + (s.ticketCapacity ?? 0), 0);
    const prevSoldForCapacity = previousShows.reduce(
      (sum, s) => sum + (s.ticketCapacity ? Math.min(s.ticketsSoldCount, s.ticketCapacity) : 0),
      0
    );
    if (prevCapacitySum > 0 && selloutRatePct !== null) {
      const prevRate = Math.round((prevSoldForCapacity / prevCapacitySum) * 100);
      selloutRateDeltaPts = selloutRatePct - prevRate;
    }
  }

  const bucketDefs = bucketDefsFor(range, rangeStart, now);
  const buckets: VenueAnalyticsBucket[] = bucketDefs.map((b) => ({
    label: b.label,
    attendance: shows
      .filter((s) => s.startsAt >= b.start && s.startsAt < b.end)
      .reduce((sum, s) => sum + s.ticketsSoldCount, 0),
  }));

  const topEvents: VenueAnalyticsTopEvent[] = shows
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.headlinerProfile?.name ?? s.title,
      startsAt: s.startsAt,
      status: s.status,
      ticketsSoldCount: s.ticketsSoldCount,
      ticketCapacity: s.ticketCapacity,
      soldOut: s.ticketCapacity != null && s.ticketsSoldCount >= s.ticketCapacity,
      grossCents: s.ticketOrders.reduce((sum, o) => sum + o.venuePayoutCents, 0),
    }))
    .sort((a, b) => b.grossCents - a.grossCents)
    .slice(0, 5);

  return {
    range,
    totalAttendance,
    totalAttendanceDeltaPct,
    selloutRatePct,
    selloutRateDeltaPts,
    showsBookedCount: shows.length,
    upcomingShowsCount,
    grossCents,
    buckets,
    topEvents,
  };
}
