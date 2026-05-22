import { NextResponse } from 'next/server';
import type { Prisma, ProfileType } from '@prisma/client/wasm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { detectRequestLocation } from '@/lib/request-location';

export const dynamic = 'force-dynamic';

// Signal weights. Collaborative filtering is the strongest individual signal
// when the viewer has enough hype history; taste (genre overlap from hyped
// artists) covers users with <3 hypes; geo covers cold-start users with neither.
const WEIGHTS = { taste: 0.28, geo: 0.18, social: 0.12, momentum: 0.10, collab: 0.22, comparable: 0.10 };

const VALID_TYPES: ProfileType[] = ['ARTIST', 'DJ', 'VENUE'];

// Cap collaborative query depth to stay fast at scale.
const COLLAB_MAX_COHYPE_USERS = 300;
const COLLAB_MAX_CANDIDATES   = 80;
const CANDIDATE_POOL           = 400; // profiles fetched before scoring

const SEED_WEIGHTS = { hype: 1.0, save: 0.6, skip: -0.4 } as const;

function geoTier(
  viewerState: string | null,
  viewerCountry: string | null,
  viewerCity: string | null,
  profileState: string | null,
  profileCountry: string | null,
  profileCity: string | null
) {
  if (!viewerState && !viewerCountry) return null;
  if (!profileState && !profileCountry) return null;
  // City match is the strongest geo signal
  if (viewerCity && profileCity && viewerCity.toLowerCase() === profileCity.toLowerCase() &&
      viewerState && profileState && viewerState.toLowerCase() === profileState.toLowerCase()) return 1;
  if (viewerState && profileState && viewerState.toLowerCase() === profileState.toLowerCase()) return 0.8;
  if (viewerCountry && profileCountry && viewerCountry.toLowerCase() === profileCountry.toLowerCase()) return 0.45;
  return 0.15;
}

function tasteScore(viewerGenres: string[], profileGenres: string[]) {
  if (!viewerGenres.length) return null;
  if (!profileGenres.length) return 0;
  const viewerSet = new Set(viewerGenres.map((g) => g.toLowerCase()));
  const overlap = profileGenres.filter((g) => viewerSet.has(g.toLowerCase())).length;
  return Math.min(1, overlap / Math.max(1, Math.min(viewerGenres.length, profileGenres.length)));
}

function finalScore(signals: { taste: number | null; geo: number | null; social: number; momentum: number; collab: number | null; comparable: number | null }) {
  let weightedSum = 0;
  let totalWeight = 0;
  const entries: [keyof typeof WEIGHTS, number | null][] = [
    ['taste', signals.taste],
    ['geo', signals.geo],
    ['social', signals.social],
    ['momentum', signals.momentum],
    ['collab', signals.collab],
    ['comparable', signals.comparable]
  ];
  for (const [key, value] of entries) {
    if (value !== null) {
      weightedSum += value * WEIGHTS[key];
      totalWeight += WEIGHTS[key];
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type')?.toUpperCase() as ProfileType | null;
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '40', 10);
  const limit = Math.min(Math.max(1, Number.isNaN(limitParam) ? 40 : limitParam), 100);

  // ── Viewer context ──────────────────────────────────────────────────────────
  let viewerId: string | null = null;
  let viewerState: string | null = null;
  let viewerCountry: string | null = null;
  let viewerCity: string | null = null;
  let viewerGenres: string[] = [];
  let alreadyHypedIds = new Set<string>();
  let collabScores = new Map<string, number>(); // profileId → normalised [0,1]
  let seedSignals = new Map<string, number>();   // profileId → weighted seed score

  // Detect real GPS/IP location — better than using the viewer's stored profile location
  const [session, requestLocation] = await Promise.all([
    auth().catch(() => null),
    detectRequestLocation().catch(() => null)
  ]);

  // Prefer the request's detected location; fall back to stored profile location
  if (requestLocation) {
    viewerState   = requestLocation.stateRegion;
    viewerCountry = requestLocation.country;
    viewerCity    = requestLocation.city;
  }

  if (session?.user?.id) {
    viewerId = session.user.id;

    // Fetch: viewer's hyped profiles, their genres, and seed actions in parallel
    const [hypedProfiles, seedRows] = await Promise.all([
      db.profileHypeEvent.findMany({
        where: { userId: viewerId },
        select: { profileId: true, profile: { select: { genres: true, stateRegion: true, country: true } } }
      }),
      db.seed.findMany({
        where: { userId: viewerId },
        select: { mediaId: true, action: true },
        orderBy: { createdAt: 'desc' },
        take: 500
      })
    ]);

    // Already-hyped → exclude from results
    alreadyHypedIds = new Set(hypedProfiles.map((h) => h.profileId));

    // Taste: derive genres from hyped artists, not viewer's own profile
    // (works for fans who have no profile; also more accurate signal)
    const hypedGenreCounts = new Map<string, number>();
    for (const { profile } of hypedProfiles) {
      if (!requestLocation) {
        // Also use hyped artists' locations to infer viewer's scene if no GPS
        viewerState   ??= profile.stateRegion;
        viewerCountry ??= profile.country;
      }
      for (const genre of profile.genres) {
        const key = genre.toLowerCase();
        hypedGenreCounts.set(key, (hypedGenreCounts.get(key) ?? 0) + 1);
      }
    }
    // Top genres by frequency, capped at 10 to keep tasteScore meaningful
    viewerGenres = [...hypedGenreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([g]) => g);

    // Seed signals: map mediaId → profileId via artistMediaAsset, then aggregate
    if (seedRows.length > 0) {
      const mediaIds = [...new Set(seedRows.map((s) => s.mediaId))];
      const assets = await db.artistMediaAsset.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, profileId: true }
      });
      const mediaToProfile = new Map(assets.map((a) => [a.id, a.profileId]));
      for (const { mediaId, action } of seedRows) {
        const profileId = mediaToProfile.get(mediaId);
        if (!profileId) continue;
        const weight = SEED_WEIGHTS[action as keyof typeof SEED_WEIGHTS] ?? 0;
        seedSignals.set(profileId, (seedSignals.get(profileId) ?? 0) + weight);
      }
      // Normalise seed signals to [-1, 1]
      const maxSeed = Math.max(...seedSignals.values(), 1);
      for (const [id, score] of seedSignals) {
        seedSignals.set(id, score / maxSeed);
      }
    }

    // Collaborative filtering: users who hyped the same artists → what else did they hype?
    if (alreadyHypedIds.size > 0) {
      const coHypeUsers = await db.profileHypeEvent.findMany({
        where: { profileId: { in: [...alreadyHypedIds] }, userId: { not: viewerId } },
        select: { userId: true },
        distinct: ['userId'],
        take: COLLAB_MAX_COHYPE_USERS
      });

      if (coHypeUsers.length > 0) {
        const coHypeUserIds = coHypeUsers.map((u) => u.userId);
        const coHypeEvents = await db.profileHypeEvent.groupBy({
          by: ['profileId'],
          where: {
            userId: { in: coHypeUserIds },
            profileId: { notIn: [...alreadyHypedIds] }
          },
          _count: { _all: true },
          orderBy: { _count: { profileId: 'desc' } },
          take: COLLAB_MAX_CANDIDATES
        });

        // Normalise co-hype counts to [0, 1]
        const maxCoHype = coHypeEvents[0]?._count._all ?? 1;
        for (const { profileId, _count } of coHypeEvents) {
          collabScores.set(profileId, _count._all / maxCoHype);
        }
      }
    }
  }

  // ── Comparable artist routing signal ────────────────────────────────────────
  // Find artists with similar genres who are already well-hyped. Profiles that
  // share fans with those comparable artists get a boost — they travel in similar
  // circles and are likely to appeal to the same audience.
  let comparableScores = new Map<string, number>(); // profileId → 0–1
  if (viewerGenres.length > 0) {
    const comparableArtists = await db.profile.findMany({
      where: {
        type: { in: ['ARTIST', 'DJ'] },
        genres: { hasSome: viewerGenres.slice(0, 4) },
        hypeCount: { gte: 5 },
        id: { notIn: viewerId ? [...alreadyHypedIds] : [] }
      },
      select: { id: true },
      take: 40
    });
    if (comparableArtists.length > 0) {
      const compIds = comparableArtists.map(a => a.id);
      // Who else do fans of comparable artists hype?
      const compFans = await db.profileHypeEvent.findMany({
        where: { profileId: { in: compIds } },
        select: { userId: true },
        distinct: ['userId'],
        take: 200
      });
      if (compFans.length > 0) {
        const compFanIds = compFans.map(f => f.userId);
        const compCandidates = await db.profileHypeEvent.groupBy({
          by: ['profileId'],
          where: {
            userId: { in: compFanIds },
            profileId: { notIn: viewerId ? [...alreadyHypedIds] : [] }
          },
          _count: { _all: true },
          orderBy: { _count: { profileId: 'desc' } },
          take: 80
        });
        const maxComp = compCandidates[0]?._count._all ?? 1;
        for (const { profileId, _count } of compCandidates) {
          comparableScores.set(profileId, _count._all / maxComp);
        }
      }
    }
  }

  // ── Candidate pool ───────────────────────────────────────────────────────────
  // Fetch a wide pool ordered by 7-day hype velocity (recent ProfileHypeEvents)
  // rather than all-time hypeCount, then re-score in memory.
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const typeFilter: Prisma.ProfileWhereInput =
    typeParam && VALID_TYPES.includes(typeParam) ? { type: typeParam } : { type: { in: VALID_TYPES } };

  // Pull main candidate pool + recent hype counts in parallel
  const [profiles, recentHypeCounts] = await Promise.all([
    db.profile.findMany({
      where: { ...typeFilter, ...getDemoOwnerExclusion() },
      orderBy: [{ hypeCount: 'desc' }, { verified: 'desc' }, { createdAt: 'desc' }],
      take: CANDIDATE_POOL,
      select: {
        id: true, slug: true, hexId: true, type: true, name: true,
        headline: true, bio: true, city: true, stateRegion: true,
        country: true, genres: true, hypeCount: true, verified: true,
        avatarImage: true, createdAt: true
      }
    }),
    // 7-day hype velocity counts per profile
    db.profileHypeEvent.groupBy({
      by: ['profileId'],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true }
    })
  ]);

  if (!profiles.length) {
    return NextResponse.json({
      profiles: [],
      meta: { viewerHasLocation: false, viewerHasGenres: false, weights: WEIGHTS }
    });
  }

  // Build recent hype lookup
  const recentHypeMap = new Map(recentHypeCounts.map((r) => [r.profileId, r._count._all]));

  // Momentum: use 7-day hype velocity, fallback to all-time if no recent data
  const momentumRaw = profiles.map((p) => {
    const recent7d = recentHypeMap.get(p.id) ?? 0;
    if (recent7d > 0) return recent7d; // prefer recency-weighted
    const ageDays = Math.max(1, (Date.now() - new Date(p.createdAt).getTime()) / 86_400_000);
    return (p.hypeCount + 1) / (ageDays + 1);
  });
  const maxMomentum = Math.max(...momentumRaw, 1);
  const maxHype = Math.max(...profiles.map((p) => p.hypeCount), 1);

  // ── Score and rank ───────────────────────────────────────────────────────────
  const scored = profiles
    .filter((p) => !alreadyHypedIds.has(p.id)) // exclude already-hyped
    .map((profile, index) => {
      const social   = Math.log1p(profile.hypeCount) / Math.log1p(maxHype);
      const momentum = momentumRaw[index] / maxMomentum;
      const geo      = geoTier(viewerState, viewerCountry, viewerCity, profile.stateRegion, profile.country, profile.city);
      const taste    = tasteScore(viewerGenres, profile.genres);
      const collab     = collabScores.get(profile.id) ?? null;
      const comparable = comparableScores.get(profile.id) ?? null;

      // Incorporate seed signals: boost saved/hyped, suppress skipped
      const seedBoost  = seedSignals.get(profile.id) ?? 0;
      const seedFactor = 1 + seedBoost * 0.4; // ±40% modifier on final score

      const signals = { taste, geo, social, momentum, collab, comparable };
      const base = finalScore(signals);

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
        _scores: { ...signals, seed: seedBoost, comparable, final: Math.max(0, base * seedFactor) },
        _rank: 0
      };
    });

  scored.sort((a, b) => b._scores.final - a._scores.final);
  scored.forEach((p, i) => { p._rank = i; });

  return NextResponse.json({
    profiles: scored.slice(0, limit),
    meta: {
      viewerHasLocation: Boolean(viewerState || viewerCountry),
      viewerHasGenres: viewerGenres.length > 0,
      viewerHasHypeHistory: alreadyHypedIds.size > 0,
      collabCandidates: collabScores.size,
      comparableCandidates: comparableScores.size,
      weights: WEIGHTS
    }
  });
}
