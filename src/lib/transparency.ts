import { db, withDbRetry } from '@/lib/db';
import { FEED_HEURISTICS_VERSION, feedHeuristicsLedger } from '@/lib/integrity';
import { unstable_cache } from 'next/cache';
import { log } from '@/lib/logger';

/**
 * Shape of the single row the snapshot query returns. Every column is cast to
 * `::int` in SQL on purpose: Postgres `count()`/`sum()` return bigint, which
 * Prisma maps to a JS BigInt — and a BigInt throws on JSON.stringify, so it
 * would break the moment one of these counters crossed an RSC/route-handler
 * boundary. None of these values comes close to 2^31.
 */
type SnapshotRow = {
  totalShows: number;
  liveShows: number;
  upcomingShows: number;
  archivedShows: number;
  totalEventsHeld: number;
  totalProfiles: number;
  artists: number;
  venues: number;
  listeners: number;
  listenersLiveNow: number;
  showHypes: number;
  profileHypes: number;
  totalRequests: number;
  pendingRequests: number;
  bookedRequests: number;
  totalTicketsSold: number;
  totalSongsUploaded: number;
};

/**
 * This was 18 separate `count`/`aggregate` calls inside a `db.$transaction([])`.
 * That is 18 sequential round-trips over Hyperdrive to render four numbers, and
 * it sat on the critical path of the homepage — the single most-hit public page
 * — because `unstable_cache` below does NOT actually cache in this deployment:
 * `open-next.config.ts` leaves OpenNext's `incrementalCache` at its "dummy"
 * default, whose get/set both throw, so every request paid the full cost.
 *
 * It is now one round-trip: one scan per table, counters split out with
 * `FILTER`. The cache wrapper is deliberately left in place — it is free, and
 * it starts working the day the incremental cache is configured.
 *
 * Written as raw SQL rather than Prisma calls because `FILTER` has no Prisma
 * query-builder equivalent; the alternative is the 18 round-trips. There is no
 * interpolation anywhere in the statement, so there is no injection surface.
 */
const getTransparencySnapshotCached = unstable_cache(
  async () => {
    try {
      const [row] = await withDbRetry(() => db.$queryRaw<SnapshotRow[]>`
        WITH show_stats AS (
          SELECT
            count(*)::int                                                       AS "totalShows",
            count(*) FILTER (WHERE status = 'LIVE')::int                        AS "liveShows",
            count(*) FILTER (WHERE status = 'SCHEDULED')::int                   AS "upcomingShows",
            count(*) FILTER (WHERE status = 'ENDED')::int                       AS "archivedShows",
            count(*) FILTER (WHERE status IN ('LIVE', 'ENDED'))::int            AS "totalEventsHeld",
            COALESCE(sum("ticketsSoldCount")
                     FILTER (WHERE status <> 'CANCELED'), 0)::int               AS "totalTicketsSold"
          FROM "Show"
        ),
        profile_stats AS (
          SELECT
            count(*)::int                                                       AS "totalProfiles",
            count(*) FILTER (WHERE type = 'ARTIST')::int                        AS "artists",
            count(*) FILTER (WHERE type = 'VENUE')::int                         AS "venues",
            count(*) FILTER (WHERE type = 'LISTENER')::int                      AS "listeners",
            COALESCE(sum("songUploadCount")
                     FILTER (WHERE type = 'ARTIST'), 0)::int                    AS "totalSongsUploaded"
          FROM "Profile"
        ),
        request_stats AS (
          SELECT
            count(*)::int                                                       AS "totalRequests",
            count(*) FILTER (WHERE status = 'PENDING')::int                     AS "pendingRequests",
            count(*) FILTER (WHERE status = 'BOOKED')::int                      AS "bookedRequests"
          FROM "VenueConnectionRequest"
        ),
        -- Mirrors the former Prisma query: distinct users who hold a LISTENER
        -- profile AND have hyped a show that is currently LIVE.
        live_listener_stats AS (
          SELECT count(DISTINCT he."userId")::int                               AS "listenersLiveNow"
          FROM "HypeEvent" he
          JOIN "Show" s ON s.id = he."showId" AND s.status = 'LIVE'
          WHERE EXISTS (
            SELECT 1 FROM "Profile" p
            WHERE p."ownerId" = he."userId" AND p.type = 'LISTENER'
          )
        ),
        hype_stats AS (
          SELECT
            (SELECT count(*) FROM "HypeEvent")::int                             AS "showHypes",
            (SELECT count(*) FROM "ProfileHypeEvent")::int                      AS "profileHypes"
        )
        SELECT *
        FROM show_stats, profile_stats, request_stats, live_listener_stats, hype_stats
      `);

      if (!row) throw new Error('transparency snapshot query returned no rows');

      const {
        totalShows,
        liveShows,
        upcomingShows,
        archivedShows,
        totalEventsHeld,
        totalProfiles,
        artists,
        venues,
        listeners,
        listenersLiveNow,
        showHypes,
        profileHypes,
        totalRequests,
        pendingRequests,
        bookedRequests,
        totalTicketsSold,
        totalSongsUploaded
      } = row;

      return {
        generatedAt: new Date().toISOString(),
        heuristicsVersion: FEED_HEURISTICS_VERSION,
        heuristicsLedger: feedHeuristicsLedger,
        counters: {
          totalShows,
          liveShows,
          upcomingShows,
          archivedShows,
          totalEventsHeld,
          totalProfiles,
          artists,
          totalArtists: artists,
          venues,
          totalVenues: venues,
          listeners,
          totalListeners: listeners,
          listenersLiveNow,
          showHypes,
          profileHypes,
          totalRequests,
          pendingRequests,
          bookedRequests,
          totalTicketsSold,
          totalSongsUploaded
        },
        commitments: [
          'Explainability is treated as a product feature, not a buried policy note.',
          'Heuristic changes should be versioned and disclosed rather than silently shipped.',
          'Aggregate transparency matters more than hidden growth loops.',
          'Behavioral-profile targeting is out of scope for this product direction.'
        ]
      };
    } catch (error) {
      log.error('[transparency]', error instanceof Error ? error : { error: String(error) }, 'falling back to empty snapshot');

      return {
        generatedAt: new Date().toISOString(),
        heuristicsVersion: FEED_HEURISTICS_VERSION,
        heuristicsLedger: feedHeuristicsLedger,
        counters: {
          totalShows: 0,
          liveShows: 0,
          upcomingShows: 0,
          archivedShows: 0,
          totalEventsHeld: 0,
          totalProfiles: 0,
          artists: 0,
          totalArtists: 0,
          venues: 0,
          totalVenues: 0,
          listeners: 0,
          totalListeners: 0,
          listenersLiveNow: 0,
          showHypes: 0,
          profileHypes: 0,
          totalRequests: 0,
          pendingRequests: 0,
          bookedRequests: 0,
          totalTicketsSold: 0,
          totalSongsUploaded: 0
        },
        commitments: [
          'Explainability is treated as a product feature, not a buried policy note.',
          'Heuristic changes should be versioned and disclosed rather than silently shipped.',
          'Aggregate transparency matters more than hidden growth loops.',
          'Behavioral-profile targeting is out of scope for this product direction.'
        ]
      };
    }
  },
  ['transparency-snapshot-v1'],
  { revalidate: 60 }
);

export async function getTransparencySnapshot() {
  return getTransparencySnapshotCached();
}
