import { NextResponse } from 'next/server';
import type { Prisma, ProfileType } from '@prisma/client/wasm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

const WEIGHTS = { taste: 0.4, geo: 0.25, social: 0.2, momentum: 0.15 };
const VALID_TYPES: ProfileType[] = ['ARTIST', 'DJ', 'VENUE'];

function geoTier(
  viewerState: string | null,
  viewerCountry: string | null,
  profileState: string | null,
  profileCountry: string | null
) {
  if (!viewerState && !viewerCountry) return null;
  if (!profileState && !profileCountry) return null;
  if (viewerState && profileState && viewerState.toLowerCase() === profileState.toLowerCase()) return 1;
  if (viewerCountry && profileCountry && viewerCountry.toLowerCase() === profileCountry.toLowerCase()) return 0.55;
  return 0.2;
}

function tasteScore(viewerGenres: string[], profileGenres: string[]) {
  if (!viewerGenres.length) return null;
  if (!profileGenres.length) return 0;

  const viewerSet = new Set(viewerGenres.map((genre) => genre.toLowerCase()));
  const overlap = profileGenres.filter((genre) => viewerSet.has(genre.toLowerCase())).length;
  return Math.min(1, overlap / Math.max(1, viewerGenres.length));
}

function finalScore(signals: { taste: number | null; geo: number | null; social: number; momentum: number }) {
  let weightedSum = 0;
  let totalWeight = 0;

  const entries: [keyof typeof WEIGHTS, number | null][] = [
    ['taste', signals.taste],
    ['geo', signals.geo],
    ['social', signals.social],
    ['momentum', signals.momentum]
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

  let viewerState: string | null = null;
  let viewerCountry: string | null = null;
  let viewerGenres: string[] = [];

  try {
    const session = await auth();
    if (session?.user?.id) {
      const viewerProfile = await db.profile.findFirst({
        where: { ownerId: session.user.id },
        select: { stateRegion: true, country: true, genres: true }
      });

      if (viewerProfile) {
        viewerState = viewerProfile.stateRegion;
        viewerCountry = viewerProfile.country;
        viewerGenres = viewerProfile.genres;
      }
    }
  } catch {
    // Recommendations remain available to signed-out visitors.
  }

  const typeFilter: Prisma.ProfileWhereInput =
    typeParam && VALID_TYPES.includes(typeParam) ? { type: typeParam } : { type: { in: VALID_TYPES } };

  const profiles = await db.profile.findMany({
    where: {
      ...typeFilter,
      ...getDemoOwnerExclusion()
    },
    orderBy: [{ hypeCount: 'desc' }, { verified: 'desc' }, { name: 'asc' }],
    take: limit,
    select: {
      id: true,
      slug: true,
      hexId: true,
      type: true,
      name: true,
      headline: true,
      bio: true,
      city: true,
      stateRegion: true,
      country: true,
      genres: true,
      hypeCount: true,
      verified: true,
      avatarImage: true,
      createdAt: true
    }
  });

  if (!profiles.length) {
    return NextResponse.json({
      profiles: [],
      meta: { viewerHasLocation: false, viewerHasGenres: false, weights: WEIGHTS }
    });
  }

  const maxHype = Math.max(...profiles.map((profile) => profile.hypeCount), 1);
  const now = Date.now();
  const momentumRaw = profiles.map((profile) => {
    const ageMs = Math.max(1, now - new Date(profile.createdAt).getTime());
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return (profile.hypeCount + 1) / (ageDays + 1);
  });
  const maxMomentum = Math.max(...momentumRaw, 1);

  const scored = profiles.map((profile, index) => {
    const social = maxHype > 0 ? Math.log1p(profile.hypeCount) / Math.log1p(maxHype) : 0;
    const momentum = momentumRaw[index] / maxMomentum;
    const geo = geoTier(viewerState, viewerCountry, profile.stateRegion, profile.country);
    const taste = tasteScore(viewerGenres, profile.genres);
    const signals = { social, momentum, geo, taste };

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
      _scores: { ...signals, final: finalScore(signals) },
      _rank: index
    };
  });

  scored.sort((left, right) => right._scores.final - left._scores.final);
  scored.forEach((profile, index) => {
    profile._rank = index;
  });

  return NextResponse.json({
    profiles: scored,
    meta: {
      viewerHasLocation: Boolean(viewerState || viewerCountry),
      viewerHasGenres: viewerGenres.length > 0,
      weights: WEIGHTS
    }
  });
}
