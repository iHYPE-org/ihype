import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { releasedMediaWhere } from '@/lib/media-release';
import { loadCoRequesterIds, loadRequestSignals } from '@/lib/request-signals';

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
    type SeedMedia = { id: string; hexId: string; title: string; artworkUrl: string | null; album: { artworkUrl: string | null } | null; profile: { name: string; slug: string; city: string | null; genres: string[]; avatarImage: string | null; nowPlaying: string | null; journalContent: string | null } | null };
    const seedSelect = {
      id: true,
      hexId: true,
      title: true,
      artworkUrl: true,
      album: { select: { artworkUrl: true } },
      profileId: true,
      profile: { select: { name: true, slug: true, city: true, genres: true, avatarImage: true, nowPlaying: true, journalContent: true } },
    } as const;
    const rowProfileId = (row: { profileId: string }) => row.profileId;
    let cfMedia: SeedMedia[] = [];
    /* Fan requests as a deck signal (2026-09-01, `fan-demand.ts`). A fan who
       asked a venue to book an act wants to hear that act; an act other fans
       want at a venue this fan follows or asked is a recommendation with a
       reason they already care about. Up to REQUEST_CARDS cards lead the deck,
       each carrying its own reason, ahead of the co-hype pool. */
    const REQUEST_CARDS = 5;
    let requestMedia: SeedMedia[] = [];
    const requestReason = new Map<string, string>();
    if (!hasFilter) {
      const [hypedByMe, playlistItems, follows] = await Promise.all([
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
        db.follow.findMany({ where: { followerId: session.user.id }, select: { followeeProfileId: true }, take: 200 }).catch(() => []),
      ]);
      const requests = await loadRequestSignals(session.user.id, follows.map((row) => row.followeeProfileId));
      const requestProfileIds = [...requests.requestedArtistIds, ...requests.wantedAt.map((entry) => entry.artistProfileId)];
      if (requestProfileIds.length > 0) {
        const rows = await db.artistMediaAsset.findMany({
          where: {
            profileId: { in: requestProfileIds },
            id: { notIn: [...actionedIds] },
            ...releasedMediaWhere(),
            profile: { discoverable: true },
          },
          take: 40,
          orderBy: { createdAt: 'desc' },
          select: seedSelect,
        }).catch(() => [] as (SeedMedia & { profileId: string })[]);
        // One card per act, requested acts first, so five asks do not become
        // five tracks by one band.
        const seen = new Set<string>();
        const wantedBy = new Map(requests.wantedAt.map((entry) => [entry.artistProfileId, entry.venueName]));
        const ordered = [
          ...rows.filter((row) => row.profile && requests.requestedArtistIds.includes(rowProfileId(row))),
          ...rows.filter((row) => row.profile && !requests.requestedArtistIds.includes(rowProfileId(row))),
        ];
        for (const row of ordered) {
          const profileId = rowProfileId(row);
          if (!profileId || seen.has(profileId) || requestMedia.length >= REQUEST_CARDS) continue;
          seen.add(profileId);
          requestMedia.push(row);
          const venueName = wantedBy.get(profileId);
          requestReason.set(
            row.id,
            requests.requestedArtistIds.includes(profileId)
              ? 'You asked a venue to book them'
              : venueName ? `Fans want them at ${venueName}` : 'Fans want them at a venue you follow',
          );
        }
      }
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
        const [fellowFans, coRequesters] = await Promise.all([
          db.profileHypeEvent.findMany({
            where: { profileId: { in: myProfileIds }, userId: { not: session.user.id } },
            select: { userId: true },
            distinct: ['userId'],
            take: 500
          }),
          // Fans who asked a venue for the same acts this fan did — a
          // neighbourhood the hype graph cannot see.
          loadCoRequesterIds(session.user.id, requests.requestedArtistIds),
        ]);
        const fanIds = [...new Set([...fellowFans.map((r) => r.userId), ...coRequesters])];
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
                album: { select: { artworkUrl: true } },
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
            album: { select: { artworkUrl: true } },
            profile: { select: { name: true, slug: true, city: true, genres: true, avatarImage: true, nowPlaying: true, journalContent: true } }
          },
        });
    const requestIds = new Set(requestMedia.map((item) => item.id));
    const personalizedIds = new Set(personalizedMedia.map((item) => item.id));
    const randomPool = await db.artistMediaAsset.findMany({
      where: {
        id: { notIn: [...actionedIds, ...personalizedIds, ...requestIds] },
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
        album: { select: { artworkUrl: true } },
        profile: { select: { name: true, slug: true, city: true, genres: true, avatarImage: true, nowPlaying: true, journalContent: true } },
      },
    });
    for (let index = randomPool.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(Math.random() * (index + 1));
      [randomPool[index], randomPool[swapWith]] = [randomPool[swapWith], randomPool[index]];
    }
    const randomMedia = randomPool.slice(0, 5);
    const randomIds = new Set(randomMedia.map((item) => item.id));
    const media = [...requestMedia, ...personalizedMedia.filter((item) => !requestIds.has(item.id)), ...randomMedia];

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
        artworkUrl: m.artworkUrl ?? m.album?.artworkUrl ?? m.profile?.avatarImage ?? null,
        city: m.profile?.city ?? null,
        genres: m.profile?.genres ?? [],
        hypeCount: hypeCountMap.get(m.id) ?? 0,
        nowPlaying: m.profile?.nowPlaying ?? null,
        journalContent: m.profile?.journalContent ?? null,
        reason: requestReason.get(m.id)
          ?? (genres.length
          ? `Matches ${genres.join(', ')}`
          : randomIds.has(m.id)
            ? 'A completely random discovery'
          : cfMedia.length
            ? 'Fans like you also hype this'
            : 'Fresh music for your Seed mix'),
      })),
    });
  } catch (error) {
    log.error('[discover/seeds]', error instanceof Error ? error : null, 'Failed to load seeds');
    return NextResponse.json({ error: 'Could not load seeds.' }, { status: 500 });
  }
}
