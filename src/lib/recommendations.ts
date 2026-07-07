import { db } from '@/lib/db';
import type { Prisma, ProfileType } from '@prisma/client';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';
import type { RequestLocation } from '@/lib/request-location';
import {
  WEIGHTS, geoTier, tasteScore, finalScore, buildReason,
  type Signals, type RecommendationReason,
} from '@/lib/recommendation-scoring';

export { WEIGHTS, geoTier, tasteScore, finalScore, buildReason } from '@/lib/recommendation-scoring';
export type { Signals, RecommendationReason } from '@/lib/recommendation-scoring';

const VALID_TYPES: ProfileType[] = ['ARTIST', 'DJ', 'VENUE'];

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
  };
};

/**
 * Multi-signal artist/venue recommender. The caller supplies the resolved
 * viewer id and detected location (so this works from both an API route and a
 * server component). Each result carries an explainable `reason` derived from
 * its dominant weighted signal.
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
  const collabScores = new Map<string, number>();
  const seedSignals = new Map<string, number>();
  // genre (lowercase) → an artist the viewer hyped in that genre, for reasons.
  const genreToArtist = new Map<string, { name: string; slug: string }>();

  if (requestLocation) {
    viewerState = requestLocation.stateRegion;
    viewerCountry = requestLocation.country;
    viewerCity = requestLocation.city;
  }

  if (viewerId) {
    const [hypedProfiles, seedRows] = await Promise.all([
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
    ]);

    alreadyHypedIds = new Set(hypedProfiles.map((h: { profileId: string }) => h.profileId));

    const hypedGenreCounts = new Map<string, number>();
    for (const { profile } of hypedProfiles as Array<{ profile: { name: string; slug: string; genres: string[]; stateRegion: string | null; country: string | null } | null }>) {
      if (!profile) continue;
      if (!requestLocation) {
        viewerState ??= profile.stateRegion;
        viewerCountry ??= profile.country;
      }
      for (const genre of profile.genres) {
        const key = genre.toLowerCase();
        hypedGenreCounts.set(key, (hypedGenreCounts.get(key) ?? 0) + 1);
        if (!genreToArtist.has(key)) genreToArtist.set(key, { name: profile.name, slug: profile.slug });
      }
    }
    viewerGenres = [...hypedGenreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([g]) => g);

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

    // Collaborative filtering.
    if (alreadyHypedIds.size > 0) {
      const coHypeUsers = await db.profileHypeEvent.findMany({
        where: { profileId: { in: [...alreadyHypedIds] }, userId: { not: viewerId } },
        select: { userId: true },
        distinct: ['userId'],
        take: COLLAB_MAX_COHYPE_USERS,
      });
      if (coHypeUsers.length > 0) {
        const coHypeUserIds = coHypeUsers.map((u: { userId: string }) => u.userId);
        const coHypeEvents = await db.profileHypeEvent.groupBy({
          by: ['profileId'],
          where: { userId: { in: coHypeUserIds }, profileId: { notIn: [...alreadyHypedIds] } },
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
        type: { in: ['ARTIST', 'DJ'] },
        genres: { hasSome: viewerGenres.slice(0, 4) },
        hypeCount: { gte: 5 },
        id: { notIn: viewerId ? [...alreadyHypedIds] : [] },
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
          where: { userId: { in: compFanIds }, profileId: { notIn: viewerId ? [...alreadyHypedIds] : [] } },
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
    .filter((p: PoolProfile) => !alreadyHypedIds.has(p.id))
    .map((profile: PoolProfile, index: number) => {
      const social   = Math.log1p(profile.hypeCount) / Math.log1p(maxHype);
      const momentum = momentumRaw[index] / maxMomentum;
      const geo      = geoTier(viewerState, viewerCountry, viewerCity, profile.stateRegion, profile.country, profile.city);
      const taste    = tasteScore(viewerGenres, profile.genres);
      const collab     = collabScores.get(profile.id) ?? null;
      const comparable = comparableScores.get(profile.id) ?? null;

      const seedBoost  = seedSignals.get(profile.id) ?? 0;
      const seedFactor = 1 + seedBoost * 0.4;

      const signals: Signals = { taste, geo, social, momentum, collab, comparable };
      const base = finalScore(signals);
      const reason = buildReason(signals, profile.genres, genreToArtist, profile.city);

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
        _scores: { ...signals, seed: seedBoost, final: Math.max(0, base * seedFactor) },
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
    },
  };
}
