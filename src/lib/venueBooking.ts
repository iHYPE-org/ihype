import { db } from '@/lib/db';
import { bookingTasteScore as tasteScore, bookingGeoScore as geoScore } from '@/lib/growth-util';
import { runAIJson } from '@/lib/ai';

export type BookingCandidate = {
  profileId: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  genres: string[];
  city: string | null;
  hypeCount: number;
  reason: string;       // why this artist surfaced
  local: boolean;
};

export type VenueBookingFeed = {
  hasVenue: boolean;
  venueName: string | null;
  venueCity: string | null;
  candidates: BookingCandidate[];
  aiEnhanced: boolean;
};

const CANDIDATE_POOL = 200;
const RESULT_SIZE = 24;
// Mirrors the weights used by /api/recommend, scoped to the booking signals.
const WEIGHTS = { taste: 0.45, geo: 0.30, momentum: 0.25 };

type ArtistRow = {
  id: string; slug: string; name: string; avatarImage: string | null;
  genres: string[]; city: string | null; stateRegion: string | null;
  hypeCount: number;
};

/**
 * Venue-side recommender: "book these artists." Given a venue owner, surfaces
 * rising artists/DJs ranked by genre-fit to the venue, geo proximity (local and
 * in-region acts), and hype momentum — excluding acts the venue has already
 * booked. This is the supply-side counterpart to the fan recommender.
 */
export async function getVenueBookingRecommendations(userId: string): Promise<VenueBookingFeed> {
  const venue = await db.profile.findFirst({
    where: { ownerId: userId, type: 'VENUE' },
    select: { id: true, name: true, genres: true, city: true, stateRegion: true },
  }).catch(() => null);

  if (!venue) {
    return { hasVenue: false, venueName: null, venueCity: null, candidates: [], aiEnhanced: false };
  }

  // Artists already booked at this venue — exclude from suggestions.
  const booked = await db.show.findMany({
    where: { venueProfileId: venue.id, headlinerProfileId: { not: null } },
    select: { headlinerProfileId: true },
  }).catch(() => [] as { headlinerProfileId: string | null }[]);
  const bookedIds = new Set(
    booked.map((b: { headlinerProfileId: string | null }) => b.headlinerProfileId).filter((id: string | null): id is string => !!id)
  );

  const rows: ArtistRow[] = await db.profile.findMany({
    where: { type: { in: ['ARTIST', 'DJ'] }, discoverable: true },
    orderBy: { hypeCount: 'desc' },
    take: CANDIDATE_POOL,
    select: {
      id: true, slug: true, name: true, avatarImage: true,
      genres: true, city: true, stateRegion: true, hypeCount: true,
    },
  }).catch(() => [] as ArtistRow[]);

  const maxHype = Math.max(...rows.map((r: ArtistRow) => r.hypeCount), 1);

  const scored = rows
    .filter((r: ArtistRow) => !!r.slug && !bookedIds.has(r.id))
    .map((r: ArtistRow) => {
      const taste = tasteScore(venue.genres, r.genres);
      const geo = geoScore(venue.city, venue.stateRegion, r.city, r.stateRegion);
      const momentum = r.hypeCount / maxHype;
      const score = taste * WEIGHTS.taste + geo * WEIGHTS.geo + momentum * WEIGHTS.momentum;
      const local = !!venue.city && !!r.city && venue.city.toLowerCase() === r.city.toLowerCase();
      return { r, score, taste, geo, local };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_SIZE);

  const candidates: BookingCandidate[] = scored.map(({ r, taste, local }) => ({
    profileId: r.id,
    slug: r.slug,
    name: r.name,
    avatarUrl: r.avatarImage ?? null,
    genres: r.genres.slice(0, 3),
    city: r.city,
    hypeCount: r.hypeCount,
    local,
    reason:
      local && taste > 0 ? 'Local act in your genre'
      : local ? 'Rising act near you'
      : taste > 0 ? 'Matches your genre mix'
      : 'Trending now',
  }));

  const aiEnhanced = await enhanceBookingPitches(venue, candidates);

  return {
    hasVenue: true,
    venueName: venue.name,
    venueCity: venue.city,
    candidates,
    aiEnhanced,
  };
}

const AI_PITCH_CANDIDATES = 12;

type AiPitchResponse = { pitches?: Array<{ slug?: string; pitch?: string }> };

/**
 * AI layer over the deterministic booking recommender: writes a specific
 * one-line booking pitch per top candidate (why THIS act fits THIS venue),
 * replacing the generic heuristic reason chips. Mutates `candidates` in
 * place; returns whether the AI pass succeeded. Deterministic reasons stay
 * when the AI binding is unavailable.
 */
async function enhanceBookingPitches(
  venue: { name: string; genres: string[]; city: string | null; stateRegion: string | null },
  candidates: BookingCandidate[],
): Promise<boolean> {
  if (candidates.length === 0) return false;
  const head = candidates.slice(0, AI_PITCH_CANDIDATES);

  const result = await runAIJson<AiPitchResponse>({
    system: `You are the booking assistant for iHYPE.org, writing for a venue owner deciding who to book.
For each candidate act, write one short booking pitch (max 90 chars) grounded ONLY in the provided data: genre fit with the venue, locality, and hype momentum. Never invent facts, draw history, or ticket numbers.

JSON shape: {"pitches": [{"slug": string, "pitch": string}, ...]} — one entry per candidate, same slugs.`,
    input: {
      venue: {
        name: venue.name,
        genres: venue.genres.slice(0, 6),
        city: venue.city,
        region: venue.stateRegion,
      },
      candidates: head.map((c) => ({
        slug: c.slug,
        name: c.name,
        genres: c.genres,
        city: c.city,
        hypeCount: c.hypeCount,
        local: c.local,
      })),
    },
    maxTokens: 1024,
  });

  const pitches = result?.pitches;
  if (!Array.isArray(pitches) || pitches.length === 0) return false;

  const bySlug = new Map(head.map((c) => [c.slug, c]));
  let applied = 0;
  for (const p of pitches) {
    const candidate = typeof p?.slug === 'string' ? bySlug.get(p.slug) : undefined;
    const pitch = typeof p?.pitch === 'string' ? p.pitch.trim().slice(0, 120) : '';
    if (candidate && pitch) {
      candidate.reason = pitch;
      applied++;
    }
  }
  return applied > 0;
}
