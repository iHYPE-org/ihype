import { db } from '@/lib/db';
import { pastShowWhere, upcomingShowWhere } from '@/lib/profile-detail';

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
 * Two labels need their source stated, because the word alone does not say:
 *
 *  - **Recommendations** counts `VenueConnectionRequest` rows naming this
 *    artist — a venue that reached out after the demand radar (`/me/booking`)
 *    recommended them. It is the only recommendation the schema RECORDS; the
 *    For You engine ranks live and stores nothing, so "how often were you
 *    recommended to fans" is not a number anyone holds.
 *  - **Requests** counts `BookingRequest` rows sent to the profile, every
 *    status. Pending/accepted/declined is the owner's inbox, not a stat.
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

  const [listens, completed, follows, hypes, pastEvents, tickets, recommendations, requests] = await Promise.all([
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
    count(() => db.venueConnectionRequest.count({ where: { artistProfileId: profileId } })),
    count(() => db.bookingRequest.count({ where: { toProfileId: profileId } })),
  ]);

  return [
    { key: 'listens', label: 'Listens', hint: 'Fans who have played one of your tracks.', value: listens },
    { key: 'completedListens', label: 'Completed listens', hint: 'Plays that reached the end of the track.', value: completed },
    { key: 'follows', label: 'Follows', hint: 'Fans following this profile.', value: follows },
    { key: 'hypes', label: 'Hypes', hint: 'Hypes this profile has received.', value: hypes },
    { key: 'pastEvents', label: 'Past events', hint: 'Shows you played or promoted that have happened.', value: pastEvents },
    { key: 'ticketsSold', label: 'Total tickets sold', hint: 'Paid tickets across those shows.', value: tickets },
    { key: 'recommendations', label: 'Recommendations', hint: 'Venues who reached out after iHYPE recommended you.', value: recommendations },
    { key: 'requests', label: 'Requests', hint: 'Booking requests sent to this profile.', value: requests },
  ];
}

async function venueBoard(profileId: string, now: Date): Promise<StatBoardEntry[]> {
  const [follows, hypes, pastEvents, upcomingEvents, tickets, requests, connections] = await Promise.all([
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
    count(() => db.bookingRequest.count({ where: { toProfileId: profileId } })),
    count(() => db.venueConnectionRequest.count({ where: { venueProfileId: profileId } })),
  ]);

  return [
    { key: 'follows', label: 'Follows', hint: 'Fans following this venue.', value: follows },
    { key: 'hypes', label: 'Hypes', hint: 'Hypes this venue has received.', value: hypes },
    { key: 'pastEvents', label: 'Past events', hint: 'Shows hosted here that have happened.', value: pastEvents },
    { key: 'upcomingEvents', label: 'Upcoming events', hint: 'Shows on the calendar, including one on stage now.', value: upcomingEvents },
    { key: 'ticketsSold', label: 'Total tickets sold', hint: 'Paid tickets across shows hosted here.', value: tickets },
    { key: 'requests', label: 'Booking requests', hint: 'Requests to play here, every status.', value: requests },
    { key: 'connections', label: 'Connection requests', hint: 'Fans and artists asking to connect with this venue.', value: connections },
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
