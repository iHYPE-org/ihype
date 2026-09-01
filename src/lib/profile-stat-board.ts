import { db } from '@/lib/db';
import { pastShowWhere, upcomingShowWhere } from '@/lib/profile-detail';
import { demandKey } from '@/lib/fan-demand';

/**
 * The owner's Stats section — a fixed board of real counts, one per line the
 * owner asked for (2026-09-01: "Stats > Listens, Completed Listens, Follows,
 * Hypes, Past Events, Total Tickets Sold, Recommendations, Requests").
 *
 * This replaces the "pin up to 4" picker for artists and venues. The picker
 * was built for public tiles, and the artist page never rendered them — the
 * shell profile draws HYPE · SHOWS · KEEPS from its own query and `/artists/
 * [slug]` is a redirect to it — so an artist choosing four stats was choosing
 * for nobody. Fans keep the picker: `/app/fans/[slug]` is the one page that
 * renders `pinnedStats`, and a fan's page is where the choice is visible.
 *
 * Every figure is a count of something the schema already stores, and each
 * query is independently caught so one failure blanks one tile rather than
 * the board. **`null` is not zero**: it renders as a dash, because `0` on a
 * stats board is a claim and "could not read" is not one. Same rule as
 * `analytics-engine.ts` and `admin-workbench.ts`.
 *
 * Two labels are the owner's product model and need their source stated
 * (2026-09-01: "Fans can request that venues bring artists they recommend to
 * perform at their venues. Those requests show up as recommendations to the
 * venues through analysis"):
 *
 *  - **Requests** — fan requests. A `VenueConnectionRequest` is a fan asking
 *    a venue to book an act. On an artist's board it counts requests NAMING
 *    the artist, every status; on a venue's, requests the venue received.
 *  - **Recommendations** — the other end of the same rows after the demand
 *    radar's analysis (`fan-demand.ts`). On an artist's board: distinct venues
 *    whose radar currently ranks them (PENDING requests, by venue). On a
 *    venue's: distinct acts fans have asked for that are still pending.
 *    Booked and dismissed requests have left the ranking, so they leave this
 *    figure too — a recommendation is a live thing.
 *
 * `BookingRequest` (a venue asking an artist to play) is the venue's own
 * outreach and stays on the venue board as "Booking requests"; on the artist
 * board it is an inbox, not a stat, and the owner's list did not ask for it.
 *
 * Financial figures (revenue, payouts) stay out on purpose — `ProfileInsights`
 * carries them, owner-only, and this board must stay safe to show on a screen
 * an artist shares with a bandmate.
 */
export type StatBoardEntry = {
  key: string;
  label: string;
  /** One sentence on what is counted. Shown under the figure. */
  hint: string;
  value: number | null;
};

async function count<T>(query: () => Promise<T>): Promise<T | null> {
  try {
    return await query();
  } catch {
    return null;
  }
}

async function artistBoard(profileId: string, now: Date): Promise<StatBoardEntry[]> {
  /* Both attachments — the act and the profile promoting the show — for the
     same reason `getProfileInsights` counts both. */
  const showAttachment = { OR: [{ headlinerProfileId: profileId }, { promoterProfileId: profileId }] };

  const hexIds = await count(async () => {
    const assets = await db.artistMediaAsset.findMany({ where: { profileId }, select: { hexId: true } });
    return assets.map((asset) => asset.hexId);
  });

  const [listens, completed, follows, hypes, pastEvents, tickets, recommendedTo, fanRequests] = await Promise.all([
    hexIds === null
      ? Promise.resolve(null)
      : count(() => db.mediaListen.count({ where: { mediaId: { in: hexIds } } })),
    hexIds === null
      ? Promise.resolve(null)
      : count(() => db.mediaListen.count({ where: { mediaId: { in: hexIds }, completedAt: { not: null } } })),
    count(() => db.follow.count({ where: { followeeProfileId: profileId } })),
    count(async () => {
      const profile = await db.profile.findUnique({ where: { id: profileId }, select: { hypeCount: true } });
      return profile?.hypeCount ?? null;
    }),
    count(() => db.show.count({ where: { AND: [showAttachment, pastShowWhere(now)] } })),
    count(async () => {
      const totals = await db.ticketOrder.aggregate({
        where: { status: 'CAPTURED', show: showAttachment },
        _sum: { quantity: true },
      });
      return totals._sum.quantity ?? 0;
    }),
    count(async () => {
      const venues = await db.venueConnectionRequest.findMany({
        where: { artistProfileId: profileId, status: 'PENDING' },
        distinct: ['venueProfileId'],
        select: { venueProfileId: true },
      });
      return venues.length;
    }),
    count(() => db.venueConnectionRequest.count({ where: { artistProfileId: profileId } })),
  ]);

  return [
    { key: 'listens', label: 'Listens', hint: 'Fans who have played one of your tracks.', value: listens },
    { key: 'completedListens', label: 'Completed listens', hint: 'Plays that reached the end of the track.', value: completed },
    { key: 'follows', label: 'Follows', hint: 'Fans following this profile.', value: follows },
    { key: 'hypes', label: 'Hypes', hint: 'Hypes this profile has received.', value: hypes },
    { key: 'pastEvents', label: 'Past events', hint: 'Shows you played or promoted that have happened.', value: pastEvents },
    { key: 'ticketsSold', label: 'Total tickets sold', hint: 'Paid tickets across those shows.', value: tickets },
    { key: 'recommendations', label: 'Recommendations', hint: 'Venues whose demand radar is recommending you right now.', value: recommendedTo },
    { key: 'requests', label: 'Requests', hint: 'Fans who asked a venue to book you.', value: fanRequests },
  ];
}

async function venueBoard(profileId: string, now: Date): Promise<StatBoardEntry[]> {
  const [follows, hypes, pastEvents, upcomingEvents, tickets, fanRequests, recommendedActs, bookingRequests] = await Promise.all([
    count(() => db.follow.count({ where: { followeeProfileId: profileId } })),
    count(async () => {
      const profile = await db.profile.findUnique({ where: { id: profileId }, select: { hypeCount: true } });
      return profile?.hypeCount ?? null;
    }),
    count(() => db.show.count({ where: { venueProfileId: profileId, ...pastShowWhere(now) } })),
    count(() => db.show.count({ where: { venueProfileId: profileId, ...upcomingShowWhere(now) } })),
    count(async () => {
      const totals = await db.ticketOrder.aggregate({
        where: { status: 'CAPTURED', show: { venueProfileId: profileId } },
        _sum: { quantity: true },
      });
      return totals._sum.quantity ?? 0;
    }),
    count(() => db.venueConnectionRequest.count({ where: { venueProfileId: profileId } })),
    count(async () => {
      const pending = await db.venueConnectionRequest.findMany({
        where: { venueProfileId: profileId, status: 'PENDING' },
        select: { artistProfileId: true, artistName: true },
      });
      // Same grouping as the radar: by profile when named, else by name.
      return new Set(pending.map(demandKey)).size;
    }),
    count(() => db.bookingRequest.count({ where: { toProfileId: profileId } })),
  ]);

  return [
    { key: 'follows', label: 'Follows', hint: 'Fans following this venue.', value: follows },
    { key: 'hypes', label: 'Hypes', hint: 'Hypes this venue has received.', value: hypes },
    { key: 'pastEvents', label: 'Past events', hint: 'Shows hosted here that have happened.', value: pastEvents },
    { key: 'upcomingEvents', label: 'Upcoming events', hint: 'Shows on the calendar, including one on stage now.', value: upcomingEvents },
    { key: 'ticketsSold', label: 'Total tickets sold', hint: 'Paid tickets across shows hosted here.', value: tickets },
    { key: 'requests', label: 'Requests', hint: 'Fans who asked you to book someone.', value: fanRequests },
    { key: 'recommendations', label: 'Recommendations', hint: 'Acts your demand radar is recommending right now.', value: recommendedActs },
    { key: 'bookingRequests', label: 'Booking requests', hint: 'Your outreach to artists, every status.', value: bookingRequests },
  ];
}

/**
 * `null` for a profile type with no board — a fan's Stats section is the
 * pinned-stat picker, not this.
 */
export async function getProfileStatBoard(
  profileId: string,
  profileType: string,
  now: Date = new Date(),
): Promise<StatBoardEntry[] | null> {
  if (profileType === 'ARTIST') return artistBoard(profileId, now);
  if (profileType === 'VENUE') return venueBoard(profileId, now);
  return null;
}
