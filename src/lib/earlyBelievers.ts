import { db } from '@/lib/db';
import { firstName, initialsOf } from '@/lib/growth-util';

export type Believer = {
  rank: number;
  name: string;        // first name / display label
  initials: string;
  avatarUrl: string | null;
  fanSlug: string | null;  // public fan page, when they have one
  isViewer: boolean;
};

export type EarlyBelievers = {
  artistName: string;
  artistSlug: string;
  artistAvatar: string | null;
  totalBelievers: number;
  earlyCount: number;        // size of the "early believer" tier
  believers: Believer[];     // the first N, ranked by hype time
  viewerRank: number | null; // viewer's believer rank, if they've hyped
  viewerIsEarly: boolean;
};

// The first N hypers of a profile are its "early believers".
const EARLY_TIER = 25;
const LIST_SIZE = 30;

type HypeRow = {
  userId: string;
  user: {
    name: string | null;
    username: string;
    image: string | null;
    profiles: { slug: string; type: string }[];
  } | null;
};

/**
 * Builds the public "early believers" board for an artist: the first people to
 * hype them, ranked by when they hyped, plus the viewer's own believer rank —
 * the braggable "I called it first" status element.
 */
export async function getEarlyBelievers(
  artistSlug: string,
  viewerUserId: string | null,
): Promise<EarlyBelievers | null> {
  const artist = await db.profile.findUnique({
    where: { slug: artistSlug },
    select: { id: true, name: true, slug: true, avatarImage: true, type: true },
  }).catch(() => null);

  if (!artist || (artist.type !== 'ARTIST' && artist.type !== 'DJ')) return null;

  const [rows, total, viewerEvent] = await Promise.all([
    db.profileHypeEvent.findMany({
      where: { profileId: artist.id },
      orderBy: { createdAt: 'asc' },
      take: LIST_SIZE,
      select: {
        userId: true,
        user: {
          select: {
            name: true, username: true, image: true,
            profiles: { where: { type: 'LISTENER' }, select: { slug: true, type: true }, take: 1 },
          },
        },
      },
    }).catch(() => [] as HypeRow[]),
    db.profileHypeEvent.count({ where: { profileId: artist.id } }).catch(() => 0),
    viewerUserId
      ? db.profileHypeEvent.findFirst({
          where: { profileId: artist.id, userId: viewerUserId },
          select: { createdAt: true },
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  let viewerRank: number | null = null;
  if (viewerEvent) {
    const before = await db.profileHypeEvent.count({
      where: { profileId: artist.id, createdAt: { lt: viewerEvent.createdAt } },
    }).catch(() => 0);
    viewerRank = before + 1;
  }

  const believers: Believer[] = rows.map((row: HypeRow, i: number) => {
    const u = row.user;
    return {
      rank: i + 1,
      name: firstName(u?.name ?? null, u?.username ?? 'fan'),
      initials: initialsOf(u?.name ?? null, u?.username ?? 'fan'),
      avatarUrl: u?.image ?? null,
      fanSlug: u?.profiles?.[0]?.slug ?? null,
      isViewer: !!viewerUserId && row.userId === viewerUserId,
    };
  });

  return {
    artistName: artist.name,
    artistSlug: artist.slug,
    artistAvatar: artist.avatarImage ?? null,
    totalBelievers: total,
    earlyCount: EARLY_TIER,
    believers,
    viewerRank,
    viewerIsEarly: viewerRank !== null && viewerRank <= EARLY_TIER,
  };
}
