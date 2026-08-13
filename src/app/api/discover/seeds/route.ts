import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { releasedMediaWhere } from '@/lib/media-release';

const LAMBDA = 0.05;

function decayWeight(createdAt: Date): number {
  const daysSince = (Date.now() - createdAt.getTime()) / 86_400_000;
  return Math.exp(-LAMBDA * daysSince);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ seeds: [] });

  const url = new URL(request.url);
  const genreParam = url.searchParams.get('genres') ?? '';
  const genres = genreParam
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
  const city = (url.searchParams.get('city') ?? '').trim();

  /**
   * The profile constraint every pool in this route must share.
   *
   * It exists because the filter used to be applied to ONE of the three pools.
   * `personalizedMedia` honoured `genres`; `randomPool` did not, and it
   * contributes five cards to every deck — so a deck filtered to Punk arrived
   * with five cards that were not punk, and the surface had no way to know.
   * A filter that is 70% applied is harder to trust than no filter, because it
   * looks like it worked.
   *
   * `city` is matched case-insensitively: it arrives from a search result the
   * member tapped, and "portland" and "Portland" are the same place.
   */
  const profileFilter = {
    discoverable: true,
    ...(genres.length > 0 ? { genres: { hasSome: genres } } : {}),
    ...(city ? { city: { equals: city, mode: 'insensitive' as const } } : {}),
  };
  const hasFilter = genres.length > 0 || city.length > 0;

  try {
    const actioned = await db.seed.findMany({
      where: { userId: session.user.id, action: { in: ['skip', 'save', 'hype'] } },
      select: { mediaId: true },
    });
    const actionedIds = new Set(actioned.map(s => s.mediaId));

    // --- Collaborative filtering (v2) with time-decay scoring --------
    type SeedMedia = { id: string; hexId: string; title: string; artworkUrl: string | null; profile: { name: string; slug: string; city: string | null; genres: string[]; avatarImage: string | null; nowPlaying: string | null; journalContent: string | null } | null };
    let cfMedia: SeedMedia[] = [];
    if (!hasFilter) {
      const [hypedByMe, playlistItems] = await Promise.all([
        db.profileHypeEvent.findMany({
          where: { userId: session.user.id },
          select: { profileId: true },
          take: 100,
        }),
        db.fanPlaylistItem.findMany({
          where: { playlist: { userId: session.user.id } },
          select: { artistProfileSlug: true },
          take: 200,
        }),
      ]);
      const playlistSlugs = [...new Set(
        playlistItems.map((item) => item.artistProfileSlug).filter((slug): slug is string => Boolean(slug)),
      )];
      const playlistProfiles = playlistSlugs.length > 0
        ? await db.profile.findMany({
            where: { slug: { in: playlistSlugs } },
            select: { id: true },
          })
        : [];
      const myProfileIds = [...new Set([
        ...hypedByMe.map((row) => row.profileId),
        ...playlistProfiles.map((profile) => profile.id),
      ])];
      if (myProfileIds.length > 0) {
        const fellowFans = await db.profileHypeEvent.findMany({
          where: { profileId: { in: myProfileIds }, userId: { not: session.user.id } },
          select: { userId: true },
          distinct: ['userId'],
          take: 500
        });
        const fanIds = fellowFans.map((r) => r.userId);
        if (fanIds.length > 0) {
          const mySet = new Set(myProfileIds);
          // Use findMany to get createdAt for decay weighting
          const overlap = await db.profileHypeEvent.findMany({
            where: { userId: { in: fanIds }, profileId: { notIn: myProfileIds } },
            select: { profileId: true, createdAt: true },
            take: 1000
          });
          const scores = new Map<string, number>();
          for (const row of overlap) {
            if (mySet.has(row.profileId)) continue;
            const w = decayWeight(row.createdAt);
            scores.set(row.profileId, (scores.get(row.profileId) ?? 0) + w);
          }
          const rankedProfileIds = [...scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([pid]) => pid);
          if (rankedProfileIds.length > 0) {
            cfMedia = await db.artistMediaAsset.findMany({
              where: {
                profileId: { in: rankedProfileIds },
                id: { notIn: [...actionedIds] },
                ...releasedMediaWhere(),
                profile: { discoverable: true }
              },
              take: 15,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                hexId: true,
                title: true,
                artworkUrl: true,
                profile: { select: { name: true, slug: true, city: true, genres: true, avatarImage: true, nowPlaying: true, journalContent: true } }
              }
            });
          }
        }
      }
    }

    const personalizedMedia = cfMedia.length
      ? cfMedia
      : await db.artistMediaAsset.findMany({
          where: {
            id: { notIn: [...actionedIds] },
            ...releasedMediaWhere(),
            profile: profileFilter,
          },
          take: 15,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            hexId: true,
            title: true,
            artworkUrl: true,
            profile: { select: { name: true, slug: true, city: true, genres: true, avatarImage: true, nowPlaying: true, journalContent: true } }
          },
        });
    const personalizedIds = new Set(personalizedMedia.map((item) => item.id));
    const randomPool = await db.artistMediaAsset.findMany({
      where: {
        id: { notIn: [...actionedIds, ...personalizedIds] },
        ...releasedMediaWhere(),
        profile: profileFilter,
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        hexId: true,
        title: true,
        artworkUrl: true,
        profile: { select: { name: true, slug: true, city: true, genres: true, avatarImage: true, nowPlaying: true, journalContent: true } },
      },
    });
    for (let index = randomPool.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(Math.random() * (index + 1));
      [randomPool[index], randomPool[swapWith]] = [randomPool[swapWith], randomPool[index]];
    }
    const randomMedia = randomPool.slice(0, 5);
    const randomIds = new Set(randomMedia.map((item) => item.id));
    const media = [...personalizedMedia, ...randomMedia];

    // Hype count per track — use findMany for per-record decay weights
    const mediaIds = media.map(m => m.id);
    const hypeSeeds = mediaIds.length > 0
      ? await db.seed.findMany({
          where: { mediaId: { in: mediaIds }, action: 'hype' },
          select: { mediaId: true, createdAt: true },
        }).catch(() => [] as { mediaId: string; createdAt: Date }[])
      : [];
    const hypeScoreMap = new Map<string, number>();
    for (const row of hypeSeeds) {
      const w = decayWeight(row.createdAt);
      hypeScoreMap.set(row.mediaId, (hypeScoreMap.get(row.mediaId) ?? 0) + w);
    }
    // Raw count for display
    const hypeCountMap = new Map<string, number>();
    for (const row of hypeSeeds) {
      hypeCountMap.set(row.mediaId, (hypeCountMap.get(row.mediaId) ?? 0) + 1);
    }

    return NextResponse.json({
      seeds: media.map(m => ({
        id: m.id,
        trackId: m.id,
        hexId: m.hexId,
        url: `/api/media/${m.hexId}`,
        title: m.title,
        artistName: m.profile?.name ?? 'Unknown Artist',
        artistSlug: m.profile?.slug ?? null,
        artworkUrl: m.artworkUrl ?? m.profile?.avatarImage ?? null,
        city: m.profile?.city ?? null,
        genres: m.profile?.genres ?? [],
        hypeCount: hypeCountMap.get(m.id) ?? 0,
        nowPlaying: m.profile?.nowPlaying ?? null,
        journalContent: m.profile?.journalContent ?? null,
        reason: genres.length
          ? `Matches ${genres.join(', ')}`
          : randomIds.has(m.id)
            ? 'A completely random discovery'
          : cfMedia.length
            ? 'Fans like you also hype this'
            : 'Fresh music for your Seed mix',
      })),
    });
  } catch (error) {
    log.error('[discover/seeds]', error instanceof Error ? error : null, 'Failed to load seeds');
    return NextResponse.json({ error: 'Could not load seeds.' }, { status: 500 });
  }
}
