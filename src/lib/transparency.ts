import { db, withDbRetry } from '@/lib/db';
import { FEED_HEURISTICS_VERSION, feedHeuristicsLedger } from '@/lib/integrity';
import { unstable_cache } from 'next/cache';
import { log } from '@/lib/logger';

const getTransparencySnapshotCached = unstable_cache(
  async () => {
    try {
      const [
        totalShows,
        liveShows,
        upcomingShows,
        archivedShows,
        totalEventsHeld,
        totalProfiles,
        artists,
        promoters,
        venues,
        listeners,
        listenersLiveNow,
        showHypes,
        profileHypes,
        totalRequests,
        pendingRequests,
        bookedRequests,
        ticketSalesSummary,
        songUploadSummary
      ] = await withDbRetry(() =>
        db.$transaction([
          db.show.count(),
          db.show.count({ where: { status: 'LIVE' } }),
          db.show.count({ where: { status: 'SCHEDULED' } }),
          db.show.count({ where: { status: 'ENDED' } }),
          db.show.count({ where: { status: { in: ['LIVE', 'ENDED'] } } }),
          db.profile.count(),
          db.profile.count({ where: { type: 'ARTIST' } }),
          db.profile.count({ where: { type: 'DJ' } }),
          db.profile.count({ where: { type: 'VENUE' } }),
          db.profile.count({ where: { type: 'LISTENER' } }),
          db.user.count({
            where: {
              profiles: { some: { type: 'LISTENER' } },
              hypeEvents: {
                some: {
                  show: { status: 'LIVE' }
                }
              }
            }
          }),
          db.hypeEvent.count(),
          db.profileHypeEvent.count(),
          db.venueConnectionRequest.count(),
          db.venueConnectionRequest.count({ where: { status: 'PENDING' } }),
          db.venueConnectionRequest.count({ where: { status: 'BOOKED' } }),
          db.show.aggregate({
            _sum: {
              ticketsSoldCount: true
            },
            where: { status: { not: 'CANCELED' } }
          }),
          db.profile.aggregate({
            _sum: {
              songUploadCount: true
            },
            where: {
              type: { in: ['ARTIST', 'DJ'] }
            }
          })
        ])
      );

      const totalTicketsSold = ticketSalesSummary._sum.ticketsSoldCount ?? 0;
      const totalSongsUploaded = songUploadSummary._sum.songUploadCount ?? 0;

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
          promoters,
          totalPromoters: promoters,
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
          promoters: 0,
          totalPromoters: 0,
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
