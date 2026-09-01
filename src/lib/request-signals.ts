import { db } from '@/lib/db';
import { summarizeRequestSignals, type RequestSignals } from '@/lib/fan-demand';

const EMPTY: RequestSignals = { requestedArtistIds: [], requestedVenueIds: [], wantedAt: [] };

/**
 * The fan-request signals for one viewer, read for the stations and the
 * discover deck. See the trailing section of `fan-demand.ts` for what the two
 * signals mean; this is only the reads.
 *
 * `followedProfileIds` is the viewer's whole follow list — a non-venue id in it
 * simply matches no request, so there is no need to filter it by type first.
 * PENDING only for what other fans want: a booked or dismissed ask has left
 * the venue's ranking and should leave the fan's recommendations with it.
 * Caught to the empty signal, never thrown: a recommendation that could not
 * read one input is still a recommendation, and this must never take a
 * station or the deck down with it.
 */
export async function loadRequestSignals(viewerId: string, followedProfileIds: readonly string[]): Promise<RequestSignals> {
  try {
    const own = await db.venueConnectionRequest.findMany({
      where: { requesterId: viewerId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { artistProfileId: true, venueProfileId: true },
    });
    const venueIds = [...new Set([...own.map((row) => row.venueProfileId), ...followedProfileIds])];
    if (venueIds.length === 0) return summarizeRequestSignals(own, [], viewerId);

    const atVenues = await db.venueConnectionRequest.findMany({
      where: { venueProfileId: { in: venueIds }, status: 'PENDING', artistProfileId: { not: null }, requesterId: { not: viewerId } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { artistProfileId: true, venueProfileId: true, requesterId: true, venueProfile: { select: { name: true } } },
    });
    return summarizeRequestSignals(
      own,
      atVenues.map((row) => ({ artistProfileId: row.artistProfileId, venueProfileId: row.venueProfileId, requesterId: row.requesterId, venueName: row.venueProfile.name })),
      viewerId,
    );
  } catch {
    return EMPTY;
  }
}

/**
 * Other fans who asked for the same acts this viewer asked for — a
 * collaborative-filtering neighbourhood the hype graph does not see, because a
 * fan can want an act booked without having hyped their page.
 */
export async function loadCoRequesterIds(viewerId: string, requestedArtistIds: readonly string[], take = 300): Promise<string[]> {
  if (requestedArtistIds.length === 0) return [];
  try {
    const rows = await db.venueConnectionRequest.findMany({
      where: { artistProfileId: { in: [...requestedArtistIds] }, requesterId: { not: viewerId } },
      select: { requesterId: true },
      distinct: ['requesterId'],
      take,
    });
    return rows.map((row) => row.requesterId);
  } catch {
    return [];
  }
}
