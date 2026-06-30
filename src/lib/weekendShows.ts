import { db } from '@/lib/db';
import type { RequestLocation } from '@/lib/request-location';
import { weekendWindow } from '@/lib/growth-util';

export type WeekendShow = {
  slug: string;
  title: string;
  startsAt: string;
  venueName: string | null;
  venueCity: string | null;
  headlinerName: string | null;
  isTicketed: boolean;
  hypeCount: number;
  goingCount: number;
  youHyped: boolean;        // hype→ticket cross-sell signal
  local: boolean;           // matches viewer city
};

export type WeekendFeed = {
  cityLabel: string | null;
  rangeLabel: string;
  shows: WeekendShow[];
};

type ShowRow = {
  slug: string; title: string; startsAt: Date; isTicketed: boolean; hypeCount: number;
  headlinerProfileId: string | null;
  headlinerProfile: { name: string } | null;
  venueProfile: { name: string; city: string | null } | null;
  _count: { rsvps: number };
};

/**
 * "This weekend in [city]" — the local-density front door. Public (works
 * logged-out via geo); when a userId is supplied, shows whose headliner the
 * viewer has hyped are flagged and floated to the top (hype→ticket cross-sell).
 */
export async function getWeekendShows(
  userId: string | null,
  location: RequestLocation | null,
): Promise<WeekendFeed> {
  const now = new Date();
  const { start, end, label } = weekendWindow(now);
  const viewerCity = location?.city?.toLowerCase() ?? null;

  const rows: ShowRow[] = await db.show.findMany({
    where: {
      status: { in: ['SCHEDULED', 'LIVE'] },
      startsAt: { gte: start, lte: end },
    },
    orderBy: [{ hypeCount: 'desc' }, { startsAt: 'asc' }],
    take: 60,
    select: {
      slug: true, title: true, startsAt: true, isTicketed: true, hypeCount: true,
      headlinerProfileId: true,
      headlinerProfile: { select: { name: true } },
      venueProfile: { select: { name: true, city: true } },
      _count: { select: { rsvps: true } },
    },
  }).catch(() => [] as ShowRow[]);

  // Which of these headliners has the viewer hyped? (single query, cross-sell)
  let hypedProfileIds = new Set<string>();
  if (userId) {
    const headlinerIds = rows
      .map((r: ShowRow) => r.headlinerProfileId)
      .filter((id: string | null): id is string => !!id);
    if (headlinerIds.length > 0) {
      const hyped = await db.profileHypeEvent.findMany({
        where: { userId, profileId: { in: headlinerIds } },
        select: { profileId: true },
      }).catch(() => [] as { profileId: string }[]);
      hypedProfileIds = new Set(hyped.map((h: { profileId: string }) => h.profileId));
    }
  }

  const shows: WeekendShow[] = rows
    .filter((r: ShowRow) => !!r.slug)
    .map((r: ShowRow) => {
      const city = r.venueProfile?.city ?? null;
      const local = !!viewerCity && !!city && city.toLowerCase() === viewerCity;
      const youHyped = !!r.headlinerProfileId && hypedProfileIds.has(r.headlinerProfileId);
      return {
        slug: r.slug,
        title: r.title,
        startsAt: r.startsAt.toISOString(),
        venueName: r.venueProfile?.name ?? null,
        venueCity: city,
        headlinerName: r.headlinerProfile?.name ?? null,
        isTicketed: r.isTicketed,
        hypeCount: r.hypeCount,
        goingCount: r._count.rsvps,
        youHyped,
        local,
      };
    });

  // Rank: shows whose artist you've hyped first, then local, then hype count.
  shows.sort((a, b) => {
    if (a.youHyped !== b.youHyped) return a.youHyped ? -1 : 1;
    if (a.local !== b.local) return a.local ? -1 : 1;
    return b.hypeCount - a.hypeCount;
  });

  return {
    cityLabel: location?.city ?? null,
    rangeLabel: label,
    shows,
  };
}
