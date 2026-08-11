import { db } from '@/lib/db';
import { bucketHypePositionIndex, computeShowDurationSecs, HYPE_TIMELINE_BUCKET_COUNT } from '@/lib/hype-position';

export type CityBreakdown = { city: string; count: number };

export type ProfileInsights = {
  hypeTotal: number;
  followerCount: number;
  bookingRequests: { pending: number; accepted: number; declined: number };
  /** Only present for ARTIST/DJ/VENUE — LISTENER profiles have no shows/media of their own. */
  listeners?: { distinctListeners: number; totalPlays: number };
  topTracks?: { title: string; plays: number }[];
  /** % of track listens that reached MediaListen.completedAt — ARTIST/DJ only. */
  trackCompletionRate?: number;
  /** Count of hypes per tenth of a show's runtime, oldest-first (bucket 0 = show start). */
  hypeTimeline?: { buckets: number[]; untracked: number };
  topCities?: CityBreakdown[];
  ticketRevenueCents?: number;
  ticketsSold?: number;
};

const TOP_CITIES_LIMIT = 5;
const TOP_TRACKS_LIMIT = 5;
// Same k-anonymity floor as /audit — a cohort this small (a city's ticket
// buyers, a track's listeners) could otherwise identify a specific fan.
const K_ANON_FLOOR = 5;

async function getBookingRequestCounts(profileId: string) {
  const rows = await db.bookingRequest.groupBy({
    by: ['status'],
    where: { toProfileId: profileId },
    _count: { _all: true },
  });
  const counts = { pending: 0, accepted: 0, declined: 0 };
  for (const row of rows) {
    if (row.status === 'pending' || row.status === 'accepted' || row.status === 'declined') {
      counts[row.status] = row._count._all;
    }
  }
  return counts;
}

async function getListenerStats(profileId: string) {
  const assets = await db.artistMediaAsset.findMany({
    where: { profileId },
    select: { hexId: true, title: true },
  });
  if (assets.length === 0) {
    return { listeners: { distinctListeners: 0, totalPlays: 0 }, topTracks: [], trackCompletionRate: undefined };
  }

  const hexIds = assets.map((a) => a.hexId);
  // MediaListen is unique per (userId, mediaId) — it records "has listened at
  // least once," not repeat plays — so grouping by mediaId gives per-track
  // listener counts, and a distinct userId count gives the overall reach.
  const [playCounts, distinctListeners, completedCount] = await Promise.all([
    db.mediaListen.groupBy({ by: ['mediaId'], where: { mediaId: { in: hexIds } }, _count: { _all: true } }),
    db.mediaListen.findMany({ where: { mediaId: { in: hexIds } }, select: { userId: true }, distinct: ['userId'] }),
    db.mediaListen.count({ where: { mediaId: { in: hexIds }, completedAt: { not: null } } }),
  ]);

  const titleByHexId = new Map(assets.map((a) => [a.hexId, a.title]));
  const topTracks = playCounts
    .map((r) => ({ title: titleByHexId.get(r.mediaId) ?? 'Untitled', plays: r._count._all }))
    .filter((t) => t.plays >= K_ANON_FLOOR)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, TOP_TRACKS_LIMIT);
  const totalPlays = playCounts.reduce((sum, r) => sum + r._count._all, 0);

  return {
    listeners: { distinctListeners: distinctListeners.length, totalPlays },
    topTracks,
    trackCompletionRate: totalPlays > 0 ? completedCount / totalPlays : undefined,
  };
}

type ShowWhere =
  | { OR: ({ headlinerProfileId: string } | { promoterProfileId: string })[] }
  | { venueProfileId: string };

async function getShowBasedStats(showWhere: ShowWhere) {
  // Hype-timeline bucketing needs each show's own computed duration (from
  // productionPlan/radioTracks — not a stored column) to place a hype's raw
  // positionSeconds into a bucket, so that part stays row-level. Ticket and
  // show-listen totals don't depend on per-show duration, so those are
  // pushed down to DB aggregates instead of materializing every order/listen.
  const showsForTimeline = await db.show.findMany({
    where: showWhere,
    select: {
      id: true,
      productionPlan: true,
      radioTracks: { select: { durationSecs: true } },
      hypes: { select: { positionSeconds: true } },
    },
  });
  const showIds = showsForTimeline.map((s) => s.id);

  const hypeTimelineBuckets = new Array(HYPE_TIMELINE_BUCKET_COUNT).fill(0);
  let hypeTimelineUntracked = 0;
  for (const show of showsForTimeline) {
    const durationSecs = computeShowDurationSecs(show);
    for (const hype of show.hypes) {
      if (hype.positionSeconds == null) { hypeTimelineUntracked += 1; continue; }
      const bucket = bucketHypePositionIndex(hype.positionSeconds, durationSecs);
      if (bucket != null) hypeTimelineBuckets[bucket] += 1;
      else hypeTimelineUntracked += 1;
    }
  }

  if (showIds.length === 0) {
    return {
      hypeTimeline: { buckets: hypeTimelineBuckets, untracked: hypeTimelineUntracked },
      topCities: [] as CityBreakdown[],
      ticketRevenueCents: 0,
      ticketsSold: 0,
    };
  }

  const [ticketTotals, cityGroups] = await Promise.all([
    db.ticketOrder.aggregate({
      where: { showId: { in: showIds }, status: 'CAPTURED' },
      _sum: { totalChargeCents: true, quantity: true },
    }),
    db.ticketOrder.groupBy({
      by: ['locationCity'],
      where: { showId: { in: showIds }, status: 'CAPTURED', locationCity: { not: null } },
      _sum: { quantity: true },
    }),
  ]);

  const topCities = cityGroups
    .map((g) => ({ city: g.locationCity as string, count: g._sum.quantity ?? 0 }))
    .filter((c) => c.count >= K_ANON_FLOOR)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_CITIES_LIMIT);

  return {
    hypeTimeline: { buckets: hypeTimelineBuckets, untracked: hypeTimelineUntracked },
    topCities,
    ticketRevenueCents: ticketTotals._sum.totalChargeCents ?? 0,
    ticketsSold: ticketTotals._sum.quantity ?? 0,
  };
}

/** Owner-only aggregate stats for an Artist/DJ/Venue page — never fabricated, only real DB aggregates. */
export async function getProfileInsights(profileId: string, profileType: string): Promise<ProfileInsights> {
  const [profile, bookingRequests] = await Promise.all([
    db.profile.findUnique({
      where: { id: profileId },
      select: { hypeCount: true, _count: { select: { followers: true } } },
    }),
    getBookingRequestCounts(profileId),
  ]);

  const base: ProfileInsights = {
    hypeTotal: profile?.hypeCount ?? 0,
    followerCount: profile?._count.followers ?? 0,
    bookingRequests,
  };

  if (profileType === 'ARTIST') {
    // Both attachments, not just the headliner one: an artist can be booked as
    // the act OR be the profile promoting the show, and a show counted only on
    // `headlinerProfileId` silently drops the second case.
    const [{ listeners, topTracks, trackCompletionRate }, showStats] = await Promise.all([
      getListenerStats(profileId),
      getShowBasedStats({ OR: [{ headlinerProfileId: profileId }, { promoterProfileId: profileId }] }),
    ]);
    return {
      ...base,
      listeners,
      topTracks,
      trackCompletionRate,
      hypeTimeline: showStats.hypeTimeline,
      topCities: showStats.topCities,
    };
  }

  if (profileType === 'VENUE') {
    const showStats = await getShowBasedStats({ venueProfileId: profileId });
    return {
      ...base,
      hypeTimeline: showStats.hypeTimeline,
      topCities: showStats.topCities,
      ticketRevenueCents: showStats.ticketRevenueCents,
      ticketsSold: showStats.ticketsSold,
    };
  }

  return base;
}
