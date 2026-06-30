import { db } from '@/lib/db';
import { getShowsAttended } from '@/lib/streaks';
import { tallyTop } from '@/lib/growth-util';

export type SceneWrapped = {
  monthLabel: string;        // e.g. "June"
  year: number;
  city: string | null;
  showsAttended: number;     // ENDED shows RSVPed this month
  hypesGiven: number;        // show + profile hypes this month
  discoveries: number;       // distinct artists hyped this month
  topArtist: string | null;  // most-listened artist this month
  topVenue: string | null;   // most-RSVPed venue this month
  topGenre: string | null;   // most common genre among hyped artists
  streak: number;            // consecutive days with a hype action
  isEmpty: boolean;          // true when there's nothing worth sharing yet
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Aggregates a user's current-month activity into a single shareable
 * "scene wrapped" snapshot — the data behind the /me/wrapped card.
 *
 * Everything is scoped to the current calendar month (UTC). All queries
 * tolerate failure individually so one empty table never blanks the card.
 */
export async function getSceneWrapped(userId: string): Promise<SceneWrapped> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthLabel = MONTHS[now.getUTCMonth()];
  const year = now.getUTCFullYear();

  const [
    primaryProfile,
    attended,
    hypeShows,
    hypeProfiles,
    discoveryRows,
    listenRows,
    venueRows,
    genreRows,
    hypeDays,
  ] = await Promise.all([
    db.profile.findFirst({
      where: { ownerId: userId },
      select: { city: true },
    }).catch(() => null),
    getShowsAttended(userId).catch(() => ({ thisMonth: 0, allTime: 0 })),
    db.hypeEvent.count({
      where: { userId, createdAt: { gte: monthStart } },
    }).catch(() => 0),
    db.profileHypeEvent.count({
      where: { userId, createdAt: { gte: monthStart } },
    }).catch(() => 0),
    // distinct artists hyped this month (each profileHypeEvent is one artist)
    db.profileHypeEvent.findMany({
      where: { userId, createdAt: { gte: monthStart } },
      select: { profileId: true },
    }).catch(() => [] as { profileId: string }[]),
    // most-listened artist this month
    db.mediaListen.groupBy({
      by: ['artistName'],
      where: { userId, createdAt: { gte: monthStart } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    }).catch(() => [] as { artistName: string; _count: { id: number } }[]),
    // venues attended this month (for top venue)
    db.showRsvp.findMany({
      where: { userId, createdAt: { gte: monthStart } },
      select: { show: { select: { venueProfile: { select: { name: true } } } } },
    }).catch(() => [] as { show: { venueProfile: { name: string } | null } }[]),
    // genres of artists hyped this month (for top genre)
    db.profileHypeEvent.findMany({
      where: { userId, createdAt: { gte: monthStart } },
      select: { profile: { select: { genres: true } } },
    }).catch(() => [] as { profile: { genres: string[] } | null }[]),
    // hype activity days for the streak
    db.auditLog.findMany({
      where: {
        actorUserId: userId,
        action: { startsWith: 'hype_' },
        createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
    }).catch(() => [] as { createdAt: Date }[]),
  ]);

  const topArtist = listenRows[0]?.artistName ?? null;

  const topVenue = tallyTop(
    venueRows
      .map((r: { show: { venueProfile: { name: string } | null } | null }) => r.show?.venueProfile?.name)
      .filter((n: string | undefined): n is string => !!n)
  );

  const topGenre = tallyTop(
    genreRows.flatMap((r: { profile: { genres: string[] } | null }) => r.profile?.genres ?? [])
  );

  // Consecutive-day hype streak (today allowed to be empty).
  const days = new Set(hypeDays.map((l: { createdAt: Date }) => l.createdAt.toISOString().slice(0, 10)));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) streak++;
    else if (i > 0) break;
  }

  const hypesGiven = hypeShows + hypeProfiles;
  const discoveries = discoveryRows.length;
  const showsAttended = attended.thisMonth;

  return {
    monthLabel,
    year,
    city: primaryProfile?.city ?? null,
    showsAttended,
    hypesGiven,
    discoveries,
    topArtist,
    topVenue,
    topGenre,
    streak,
    isEmpty: showsAttended === 0 && hypesGiven === 0 && discoveries === 0 && !topArtist,
  };
}
