import { db } from '@/lib/db';
import {
  type AnalyticsAudience,
  type AnalyticsRange,
  type Metric,
  type ResolvedRange,
  metricsForAudience,
  resolveRange,
} from '@/lib/analytics-engine';

/**
 * The database half of the analytics engine.
 *
 * Split from `analytics-engine.ts` so that module stays free of `@/lib/db` and
 * can be imported by client components and unit tests — the same separation
 * `profile-stats-catalog.ts` keeps from `profile-stats.ts`.
 *
 * ## Every query is independently caught, and that is the whole design
 *
 * A resolver that throws returns `null`, not `0`. `admin-workbench.ts` learned
 * this the hard way: one failing query must not be able to make a board read
 * "nothing happened", because an operator cannot tell that apart from a quiet
 * week. `null` renders as an em dash and says "unknown"; zero says "none", and
 * only one of those is honest when the query failed.
 *
 * ## Scope
 *
 * Platform metrics count everything. Audience metrics are scoped to one
 * account or one page, and a scope that cannot be resolved yields nulls rather
 * than silently falling back to platform-wide figures — showing an artist the
 * whole site's listen count under the label "Listens" would be worse than
 * showing them nothing.
 */

export type AnalyticsScope =
  | { kind: 'platform' }
  /** A signed-in account: their own activity. */
  | { kind: 'user'; userId: string }
  /** One artist or venue page. */
  | { kind: 'profile'; profileId: string }
  /** One advertiser's campaigns. */
  | { kind: 'advertiser'; userId: string };

type Window = { gte: Date; lt: Date };

function windows(range: ResolvedRange): { current: Window; prior: Window } {
  return {
    current: { gte: range.start, lt: range.end },
    prior: { gte: range.priorStart, lt: range.priorEnd },
  };
}

/** Runs a count twice — current window and prior — and never throws. */
async function pair(
  run: (window: Window) => Promise<number>,
  range: ResolvedRange,
): Promise<{ value: number | null; previous: number | null }> {
  const { current, prior } = windows(range);
  const [value, previous] = await Promise.all([
    run(current).catch(() => null),
    run(prior).catch(() => null),
  ]);
  return { value, previous };
}

/** Resolvers keyed by metric id. A metric with no resolver reports unknown. */
type Resolver = (scope: AnalyticsScope, range: ResolvedRange) => Promise<{ value: number | null; previous: number | null }>;

const UNKNOWN = { value: null, previous: null };

const RESOLVERS: Record<string, Resolver> = {
  accounts: (scope, range) =>
    scope.kind === 'platform'
      ? pair((w) => db.user.count({ where: { createdAt: w } }), range)
      : Promise.resolve(UNKNOWN),

  pages: (scope, range) =>
    scope.kind === 'platform'
      ? pair((w) => db.profile.count({ where: { createdAt: w, type: { in: ['ARTIST', 'VENUE'] } } }), range)
      : Promise.resolve(UNKNOWN),

  hypes_given: (scope, range) => {
    // Two tables hold a hype: HypeEvent (a show) and ProfileHypeEvent (a
    // page). "Hypes sent" means both, or the figure silently under-reports
    // whichever kind the viewer happens to use.
    const sum = async (where: Record<string, unknown>, w: Window) => {
      const [shows, profiles] = await Promise.all([
        db.hypeEvent.count({ where: { ...where, createdAt: w } }),
        db.profileHypeEvent.count({ where: { ...where, createdAt: w } }),
      ]);
      return shows + profiles;
    };
    if (scope.kind === 'platform') return pair((w) => sum({}, w), range);
    if (scope.kind === 'user') return pair((w) => sum({ userId: scope.userId }, w), range);
    return Promise.resolve(UNKNOWN);
  },

  hypes_received: (scope, range) =>
    scope.kind === 'profile'
      ? pair((w) => db.profileHypeEvent.count({ where: { profileId: scope.profileId, createdAt: w } }), range)
      : Promise.resolve(UNKNOWN),

  listens: (scope, range) => {
    if (scope.kind === 'platform') return pair((w) => db.mediaListen.count({ where: { createdAt: w } }), range);
    if (scope.kind === 'user') return pair((w) => db.mediaListen.count({ where: { userId: scope.userId, createdAt: w } }), range);
    if (scope.kind === 'profile') {
      // MediaListen stores the artist by slug, not by id, so a profile-scoped
      // listen count has to resolve the slug first. Done inside the resolver so
      // a missing profile yields unknown rather than an unfiltered count.
      return (async () => {
        const profile = await db.profile.findUnique({ where: { id: scope.profileId }, select: { slug: true } }).catch(() => null);
        if (!profile) return UNKNOWN;
        return pair((w) => db.mediaListen.count({ where: { artistProfileSlug: profile.slug, createdAt: w } }), range);
      })();
    }
    return Promise.resolve(UNKNOWN);
  },

  // Counts by the show's START time, not the order's creation time: "attended"
  // is about when the gig happened, which is the same rule `shows` already
  // follows. CAPTURED only — a RESERVED order is a held seat that may never be
  // paid for, and counting it would tell a fan they went to a show they did
  // not buy. Same definition `tickets_sold` uses for the seller side.
  shows_attended: (scope, range) =>
    scope.kind === 'user'
      ? pair(
          (w) => db.ticketOrder.count({
            where: { buyerUserId: scope.userId, status: 'CAPTURED', show: { startsAt: w } },
          }),
          range,
        )
      : Promise.resolve(UNKNOWN),

  // Real money that actually moved: RELEASED entries only, so this cannot show
  // a fan earnings that are still pending and might yet be voided by a refund.
  //
  // NOTE this is a genuine improvement on what /me/analytics displayed, not
  // just a move. That page read `getPromoterDashboard().earnedCents`, which
  // takes no range parameter — so a LIFETIME total sat inside a card headed
  // "7 Days", changing nothing when the range changed. Windowed here, with a
  // prior-period delta like every other metric.
  promoter_earnings: (scope, range) =>
    scope.kind === 'user'
      ? (async () => {
          const profiles = await db.profile
            .findMany({ where: { ownerId: scope.userId }, select: { id: true } })
            .catch(() => null);
          if (!profiles?.length) return UNKNOWN;
          const ids = profiles.map((entry) => entry.id);
          return pair(
            (w) => db.accountsPayableEntry
              .aggregate({
                _sum: { amountCents: true },
                where: {
                  profileId: { in: ids },
                  category: 'PROMOTER_AFFILIATE',
                  status: 'RELEASED',
                  createdAt: w,
                },
              })
              .then((result) => result._sum?.amountCents ?? 0),
            range,
          );
        })()
      : Promise.resolve(UNKNOWN),

  followers: (scope, range) =>
    scope.kind === 'profile'
      ? pair((w) => db.follow.count({ where: { followeeProfileId: scope.profileId, createdAt: w } }), range)
      : Promise.resolve(UNKNOWN),

  uploads: (scope, range) => {
    if (scope.kind === 'platform') return pair((w) => db.artistMediaAsset.count({ where: { createdAt: w } }), range);
    if (scope.kind === 'profile') return pair((w) => db.artistMediaAsset.count({ where: { profileId: scope.profileId, createdAt: w } }), range);
    return Promise.resolve(UNKNOWN);
  },

  shows: (scope, range) => {
    // Counted on startsAt, not createdAt: "shows scheduled" is about when the
    // show happens, which is what both an artist and a venue mean by it.
    if (scope.kind === 'platform') return pair((w) => db.show.count({ where: { startsAt: w } }), range);
    if (scope.kind === 'profile') {
      return pair(
        (w) => db.show.count({
          where: { startsAt: w, OR: [{ venueProfileId: scope.profileId }, { headlinerProfileId: scope.profileId }] },
        }),
        range,
      );
    }
    return Promise.resolve(UNKNOWN);
  },

  tickets_sold: (scope, range) => {
    // Only CAPTURED orders. A RESERVED order is a held seat that may never be
    // paid for, and counting it as sold overstates revenue.
    const sold = async (where: Record<string, unknown>, w: Window) => {
      const orders = await db.ticketOrder.findMany({
        where: { ...where, status: 'CAPTURED', createdAt: w },
        select: { quantity: true },
      });
      return orders.reduce((total, order) => total + order.quantity, 0);
    };
    if (scope.kind === 'platform') return pair((w) => sold({}, w), range);
    if (scope.kind === 'profile') {
      return pair((w) => sold({ show: { OR: [{ venueProfileId: scope.profileId }, { headlinerProfileId: scope.profileId }] } }, w), range);
    }
    return Promise.resolve(UNKNOWN);
  },

  ad_impressions: (scope, range) => {
    if (scope.kind === 'platform') return pair((w) => db.adImpression.count({ where: { createdAt: w } }), range);
    if (scope.kind === 'advertiser') {
      return pair((w) => db.adImpression.count({ where: { createdAt: w, ad: { advertiserId: scope.userId } } }), range);
    }
    return Promise.resolve(UNKNOWN);
  },

  ad_spend: (scope, range) => {
    // Ad.spentCents is a running total with no history, so it cannot be
    // windowed. Spend is derived from impressions in the window instead,
    // priced at each campaign's own delivered rate — see the note below.
    const spend = async (where: Record<string, unknown>, w: Window) => {
      const rows = await db.adImpression.findMany({
        where: { ...where, createdAt: w },
        select: { ad: { select: { spentCents: true, impressions: true } } },
      });
      return rows.reduce((total, row) => {
        const { spentCents, impressions } = row.ad;
        // Per-impression price, from what the campaign has actually spent.
        // Zero impressions cannot have produced this row, but guard anyway
        // rather than divide by zero.
        if (!impressions) return total;
        return total + Math.round(spentCents / impressions);
      }, 0);
    };
    if (scope.kind === 'platform') return pair((w) => spend({}, w), range);
    if (scope.kind === 'advertiser') return pair((w) => spend({ ad: { advertiserId: scope.userId } }, w), range);
    return Promise.resolve(UNKNOWN);
  },
};

/**
 * Computes every metric an audience should see, for one scope and range.
 *
 * Resolvers run in parallel and each is already failure-tolerant, so a single
 * unreachable table costs one em dash rather than the whole board.
 */
export async function getAnalytics(
  audience: AnalyticsAudience,
  scope: AnalyticsScope,
  range: AnalyticsRange,
  now: Date = new Date(),
): Promise<{ range: ResolvedRange; metrics: Metric[] }> {
  const resolved = resolveRange(range, now);
  const definitions = metricsForAudience(audience);

  const metrics = await Promise.all(
    definitions.map(async (definition) => {
      const resolver = RESOLVERS[definition.id];
      const result = resolver ? await resolver(scope, resolved).catch(() => UNKNOWN) : UNKNOWN;
      return { ...definition, value: result.value, previous: result.previous };
    }),
  );

  return { range: resolved, metrics };
}

export type AudienceBreakdownRow = {
  audience: AnalyticsAudience;
  label: string;
  /** Accounts of this type. `null` when the count could not be read. */
  accounts: number | null;
  /** Of those, how many did anything at all in the window. */
  active: number | null;
};

/**
 * Accounts by user type, with how many were active in the window.
 *
 * "Active" is deliberately the same definition for every type — did this
 * account do ANYTHING that left a row in the period. A per-type definition
 * would make the column incomparable down its own axis, which is the only
 * thing this table is for.
 */
export async function getAudienceBreakdown(range: AnalyticsRange, now: Date = new Date()): Promise<AudienceBreakdownRow[]> {
  const { start, end } = resolveRange(range, now);
  const activeWhere = {
    OR: [
      { hypeEvents: { some: { createdAt: { gte: start, lt: end } } } },
      { profileHypeEvents: { some: { createdAt: { gte: start, lt: end } } } },
      { mediaListens: { some: { createdAt: { gte: start, lt: end } } } },
    ],
  };

  const rows: Array<{ audience: AnalyticsAudience; label: string; role?: 'FAN' | 'ARTIST' | 'VENUE' | 'ADVERTISER' }> = [
    { audience: 'fan', label: 'Fans', role: 'FAN' },
    { audience: 'artist', label: 'Artists', role: 'ARTIST' },
    { audience: 'venue', label: 'Venues', role: 'VENUE' },
    { audience: 'advertiser', label: 'Advertisers', role: 'ADVERTISER' },
  ];

  return Promise.all(
    rows.map(async (row) => {
      const where = { role: row.role };
      const [accounts, active] = await Promise.all([
        db.user.count({ where }).catch(() => null),
        db.user.count({ where: { ...where, ...activeWhere } }).catch(() => null),
      ]);
      return { audience: row.audience, label: row.label, accounts, active };
    }),
  );
}
