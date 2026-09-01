import { db } from '@/lib/db';
import type { Prisma, ProfileType } from '@prisma/client';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';
import type { RequestLocation } from '@/lib/request-location';
import {
  WEIGHTS, geoTier, tasteScore, finalScore, buildReason, isRecommendationReady, KNOWN_GENRE_WEIGHT,
  type Signals, type RecommendationReason, type KnownArtist, type ViewerSignals,
} from '@/lib/recommendation-scoring';
import { loadCoRequesterIds, loadRequestSignals } from '@/lib/request-signals';

export { WEIGHTS, geoTier, tasteScore, finalScore, buildReason } from '@/lib/recommendation-scoring';
export type { Signals, RecommendationReason } from '@/lib/recommendation-scoring';

const VALID_TYPES: ProfileType[] = ['ARTIST', 'VENUE'];

const COLLAB_MAX_COHYPE_USERS = 300;
const COLLAB_MAX_CANDIDATES   = 80;
const CANDIDATE_POOL          = 400;

const SEED_WEIGHTS = { hype: 1.0, save: 0.6, skip: -0.4 } as const;

export type RecommendedProfile = {
  id: string;
  slug: string;
  hexId: string;
  type: ProfileType;
  name: string;
  headline: string | null;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  genres: string[];
  hypeCount: number;
  verified: boolean;
  avatarImage: string | null;
  reason: RecommendationReason;
  _scores: Record<string, number | null>;
  _rank: number;
};

export type RecommendationResult = {
  profiles: RecommendedProfile[];
  meta: {
    viewerHasLocation: boolean;
    viewerHasGenres: boolean;
    viewerHasHypeHistory: boolean;
    viewerGenres: string[];
    viewerCity: string | null;
    viewerState: string | null;
    collabCandidates: number;
    comparableCandidates: number;
    weights: typeof WEIGHTS;
    /** What the viewer has left for the engine to work from. */
    viewerSignals: ViewerSignals;
    /**
     * False until the viewer has left at least one taste signal. A caller
     * must show NOTHING when this is false — see `isRecommendationReady`.
     */
    ready: boolean;
  };
};

/**
 * Multi-signal artist/venue recommender. The caller supplies the resolved
 * viewer id and detected location (so this works from both an API route and a
 * server component). Each result carries an explainable `reason` derived from
 * its dominant weighted signal.
 *
 * Live as of 2026-09-01 behind `GET /api/recommend`, which the MUSIC module's
 * Recommended tab reads. It had no consumer before that. Three signals were
 * added the same day so it hears everything a fan does, not only hypes:
 *
 *  - **follows** — a followed artist is known (excluded from results) and its
 *    genres weigh into taste at 2× a hype.
 *  - **fan requests** (`fan-demand.ts`) — an act the viewer asked a venue to
 *    book is known and weighs 3×; an act OTHER fans want at a venue the viewer
 *    follows or asked gets a demand boost and the reason "Fans want them at
 *    <Venue>"; and fans who asked for the same acts join the collaborative
 *    neighbourhood, which the hype graph alone cannot see.
 *  - **readiness** — `meta.ready` is false until the viewer has left one taste
 *    signal, and the caller shows nothing. The engine speaks when it has
 *    something to say, not before.
 */
export async function getRecommendations(
  viewerId: string | null,
  requestLocation: RequestLocation | null,
  opts: { type?: ProfileType | null; limit: number },
): Promise<RecommendationResult> {
  const limit = Math.min(Math.max(1, opts.limit), 100);
  const typeParam = opts.type ?? null;

  let viewerState: string | null = null;
  let viewerCountry: string | null = null;
  let viewerCity: string | null = null;
  let viewerGenres: string[] = [];
  let alreadyHypedIds = new Set<string>();
  /* Everything the viewer already knows — hyped, followed, or asked a venue
     for. Recommending any of these back is noise, so they are excluded from
     results and from the collaborative/comparable candidate pools alike. */
  const knownIds = new Set<string>();
  const collabScores = new Map<string, number>();
  const seedSignals = new Map<string, number>();
  // genre (lowercase) → an artist the viewer knows in that genre, for reasons.
  const genreToArtist = new Map<string, KnownArtist>();
  // acts other fans want at the viewer's venues → the venue to name and how many fans.
  const demandByProfile = new Map<string, { venueName: string; fans: number }>();
  let maxWantedFans = 0;
  const viewerSignals: ViewerSignals = { hypes: 0, seeds: 0, follows: 0, requests: 0 };

  if (requestLocation) {
    viewerState = requestLocation.stateRegion;
    viewerCountry = requestLocation.country;
    viewerCity = requestLocation.city;
  }

  if (viewerId) {
    const [hypedProfiles, seedRows, follows] = await Promise.all([
      db.profileHypeEvent.findMany({
        where: { userId: viewerId },
        select: { profileId: true, profile: { select: { name: true, slug: true, genres: true, stateRegion: true, country: true } } },
      }),
      db.seed.findMany({
        where: { userId: viewerId },
        select: { mediaId: true, action: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      db.follow.findMany({
        where: { followerId: viewerId },
        select: { followeeProfileId: true, followeeProfile: { select: { name: true, slug: true, genres: true, type: true } } },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }).catch(() => []),
    ]);
    const followedIds = follows.map((row) => row.followeeProfileId);
    const requests = await loadRequestSignals(viewerId, followedIds);
    const requestedProfiles = requests.requestedArtistIds.length
      ? await db.profile.findMany({
          where: { id: { in: requests.requestedArtistIds } },
          select: { id: true, name: true, slug: true, genres: true },
        }).catch(() => [])
      : [];

    alreadyHypedIds = new Set(hypedProfiles.map((h: { profileId: string }) => h.profileId));
    for (const id of alreadyHypedIds) knownIds.add(id);
    for (const id of followedIds) knownIds.add(id);
    for (const profile of requestedProfiles) knownIds.add(profile.id);
    viewerSignals.hypes = hypedProfiles.length;
    viewerSignals.seeds = seedRows.length;
    viewerSignals.follows = follows.length;
    viewerSignals.requests = requests.requestedArtistIds.length + requests.requestedVenueIds.length;

    /* The viewer's genre profile, weighted by how they came to know each act:
       a request outweighs a follow outweighs a hype. The reason map keeps the
       STRONGEST way for each genre, so a request-backed reason wins the
       sentence over a hype-backed one for the same genre. */
    const genreWeights = new Map<string, number>();
    const knownRank: Record<string, number> = { hype: 1, follow: 2, request: 3 };
    const learn = (profile: { name: string; slug: string; genres: string[] }, via: 'hype' | 'follow' | 'request') => {
      for (const genre of profile.genres) {
        const key = genre.toLowerCase();
        genreWeights.set(key, (genreWeights.get(key) ?? 0) + KNOWN_GENRE_WEIGHT[via]);
        const current = genreToArtist.get(key);
        if (!current || knownRank[current.via ?? 'hype'] < knownRank[via]) {
          genreToArtist.set(key, { name: profile.name, slug: profile.slug, via });
        }
      }
    };
    for (const { profile } of hypedProfiles as Array<{ profile: { name: string; slug: string; genres: string[]; stateRegion: string | null; country: string | null } | null }>) {
      if (!profile) continue;
      if (!requestLocation) {
        viewerState ??= profile.stateRegion;
        viewerCountry ??= profile.country;
      }
      learn(profile, 'hype');
    }
    for (const row of follows) if (row.followeeProfile) learn(row.followeeProfile, 'follow');
    for (const profile of requestedProfiles) learn(profile, 'request');
    viewerGenres = [...genreWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([g]) => g);

    for (const entry of requests.wantedAt) {
      demandByProfile.set(entry.artistProfileId, { venueName: entry.venueName, fans: entry.fans });
      if (entry.fans > maxWantedFans) maxWantedFans = entry.fans;
    }

    if (seedRows.length > 0) {
      const mediaIds = [...new Set(seedRows.map((s: { mediaId: string }) => s.mediaId))];
      const assets = await db.artistMediaAsset.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, profileId: true },
      });
      const mediaToProfile = new Map<string, string>(assets.map((a: { id: string; profileId: string }): [string, string] => [a.id, a.profileId]));
      for (const { mediaId, action } of seedRows as Array<{ mediaId: string; action: string }>) {
        const profileId = mediaToProfile.get(mediaId);
        if (!profileId) continue;
        const weight = SEED_WEIGHTS[action as keyof typeof SEED_WEIGHTS] ?? 0;
        seedSignals.set(profileId, (seedSignals.get(profileId) ?? 0) + weight);
      }
      const maxSeed = Math.max(...seedSignals.values(), 1);
      for (const [id, score] of seedSignals) seedSignals.set(id, score / maxSeed);
    }

    // Collaborative filtering — over the acts the viewer knows by any route,
    // and over the fans who asked venues for the same acts, not only co-hypers.
    if (knownIds.size > 0) {
      const [coHypeUsers, coRequesters] = await Promise.all([
        db.profileHypeEvent.findMany({
          where: { profileId: { in: [...knownIds] }, userId: { not: viewerId } },
          select: { userId: true },
          distinct: ['userId'],
          take: COLLAB_MAX_COHYPE_USERS,
        }),
        loadCoRequesterIds(viewerId, requests.requestedArtistIds),
      ]);
      const coHypeUserIds = [...new Set([...coHypeUsers.map((u: { userId: string }) => u.userId), ...coRequesters])];
      if (coHypeUserIds.length > 0) {
        const coHypeEvents = await db.profileHypeEvent.groupBy({
          by: ['profileId'],
          where: { userId: { in: coHypeUserIds }, profileId: { notIn: [...knownIds] } },
          _count: { _all: true },
          orderBy: { _count: { profileId: 'desc' } },
          take: COLLAB_MAX_CANDIDATES,
        });
        const maxCoHype = coHypeEvents[0]?._count._all ?? 1;
        for (const { profileId, _count } of coHypeEvents) {
          collabScores.set(profileId, _count._all / maxCoHype);
        }
      }
    }
  }

  // Comparable-artist routing signal.
  const comparableScores = new Map<string, number>();
  if (viewerGenres.length > 0) {
    const comparableArtists = await db.profile.findMany({
      where: {
        type: 'ARTIST',
        genres: { hasSome: viewerGenres.slice(0, 4) },
        hypeCount: { gte: 5 },
        id: { notIn: viewerId ? [...knownIds] : [] },
      },
      select: { id: true },
      take: 40,
    });
    if (comparableArtists.length > 0) {
      const compIds = comparableArtists.map((a: { id: string }) => a.id);
      const compFans = await db.profileHypeEvent.findMany({
        where: { profileId: { in: compIds } },
        select: { userId: true },
        distinct: ['userId'],
        take: 200,
      });
      if (compFans.length > 0) {
        const compFanIds = compFans.map((f: { userId: string }) => f.userId);
        const compCandidates = await db.profileHypeEvent.groupBy({
          by: ['profileId'],
          where: { userId: { in: compFanIds }, profileId: { notIn: viewerId ? [...knownIds] : [] } },
          _count: { _all: true },
          orderBy: { _count: { profileId: 'desc' } },
          take: 80,
        });
        const maxComp = compCandidates[0]?._count._all ?? 1;
        for (const { profileId, _count } of compCandidates) {
          comparableScores.set(profileId, _count._all / maxComp);
        }
      }
    }
  }

  // Candidate pool.
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const typeFilter: Prisma.ProfileWhereInput =
    typeParam && VALID_TYPES.includes(typeParam) ? { type: typeParam } : { type: { in: VALID_TYPES } };

  const [profiles, recentHypeCounts] = await Promise.all([
    db.profile.findMany({
      where: { ...typeFilter, ...getDemoOwnerExclusion() },
      orderBy: [{ hypeCount: 'desc' }, { verified: 'desc' }, { createdAt: 'desc' }],
      take: CANDIDATE_POOL,
      select: {
        id: true, slug: true, hexId: true, type: true, name: true,
        headline: true, bio: true, city: true, stateRegion: true,
        country: true, genres: true, hypeCount: true, verified: true,
        avatarImage: true, createdAt: true,
      },
    }),
    db.profileHypeEvent.groupBy({
      by: ['profileId'],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
  ]);

  if (!profiles.length) {
    return {
      profiles: [],
      meta: {
        viewerHasLocation: Boolean(viewerState || viewerCountry),
        viewerHasGenres: viewerGenres.length > 0,
        viewerHasHypeHistory: alreadyHypedIds.size > 0,
        viewerGenres,
        viewerCity,
        viewerState,
        collabCandidates: collabScores.size,
        comparableCandidates: comparableScores.size,
        weights: WEIGHTS,
        viewerSignals,
        ready: isRecommendationReady(viewerSignals),
      },
    };
  }

  const recentHypeMap = new Map<string, number>(recentHypeCounts.map((r: { profileId: string; _count: { _all: number } }): [string, number] => [r.profileId, r._count._all]));

  type PoolProfile = {
    id: string; slug: string; hexId: string; type: ProfileType; name: string;
    headline: string | null; bio: string | null; city: string | null;
    stateRegion: string | null; country: string | null; genres: string[];
    hypeCount: number; verified: boolean; avatarImage: string | null; createdAt: Date;
  };

  const momentumRaw = (profiles as PoolProfile[]).map((p: PoolProfile) => {
    const recent7d = recentHypeMap.get(p.id) ?? 0;
    if (recent7d > 0) return recent7d;
    const ageDays = Math.max(1, (Date.now() - new Date(p.createdAt).getTime()) / 86_400_000);
    return (p.hypeCount + 1) / (ageDays + 1);
  });
  const maxMomentum = Math.max(...momentumRaw, 1);
  const maxHype = Math.max(...(profiles as PoolProfile[]).map((p: PoolProfile) => p.hypeCount), 1);

  const scored: RecommendedProfile[] = (profiles as PoolProfile[])
    .filter((p: PoolProfile) => !knownIds.has(p.id))
    .map((profile: PoolProfile, index: number) => {
      const social   = Math.log1p(profile.hypeCount) / Math.log1p(maxHype);
      const momentum = momentumRaw[index] / maxMomentum;
      const geo      = geoTier(viewerState, viewerCountry, viewerCity, profile.stateRegion, profile.country, profile.city);
      const taste    = tasteScore(viewerGenres, profile.genres);
      const collab     = collabScores.get(profile.id) ?? null;
      const comparable = comparableScores.get(profile.id) ?? null;

      const seedBoost  = seedSignals.get(profile.id) ?? 0;
      const seedFactor = 1 + seedBoost * 0.4;
      /* Fans wanting this act at a venue the viewer follows or asked. A fact
         about a room the viewer cares about, so it both lifts the score and
         becomes the sentence — "Fans like you hype them" is an inference,
         "Fans want them at Port City" is a report. */
      const wanted = demandByProfile.get(profile.id);
      const demandBoost = wanted && maxWantedFans > 0 ? wanted.fans / maxWantedFans : 0;
      const demandFactor = 1 + demandBoost * 0.6;

      const signals: Signals = { taste, geo, social, momentum, collab, comparable };
      const base = finalScore(signals);
      const reason: RecommendationReason = wanted
        ? { kind: 'request', text: `Fans want them at ${wanted.venueName}` }
        : buildReason(signals, profile.genres, genreToArtist, profile.city);

      return {
        id: profile.id,
        slug: profile.slug,
        hexId: profile.hexId,
        type: profile.type,
        name: profile.name,
        headline: profile.headline,
        city: profile.city,
        stateRegion: profile.stateRegion,
        country: profile.country,
        genres: profile.genres,
        hypeCount: profile.hypeCount,
        verified: profile.verified,
        avatarImage: profile.avatarImage,
        reason,
        _scores: { ...signals, seed: seedBoost, demand: demandBoost, final: Math.max(0, base * seedFactor * demandFactor) },
        _rank: 0,
      };
    });

  scored.sort((a, b) => (b._scores.final ?? 0) - (a._scores.final ?? 0));
  scored.forEach((p, i) => { p._rank = i; });

  return {
    profiles: scored.slice(0, limit),
    meta: {
      viewerHasLocation: Boolean(viewerState || viewerCountry),
      viewerHasGenres: viewerGenres.length > 0,
      viewerHasHypeHistory: alreadyHypedIds.size > 0,
      viewerGenres,
      viewerCity,
      viewerState,
      collabCandidates: collabScores.size,
      comparableCandidates: comparableScores.size,
      weights: WEIGHTS,
      viewerSignals,
      ready: isRecommendationReady(viewerSignals),
    },
  };
}
