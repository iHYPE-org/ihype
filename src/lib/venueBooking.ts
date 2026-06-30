import { db } from '@/lib/db';
import { bookingTasteScore as tasteScore, bookingGeoScore as geoScore } from '@/lib/growth-util';

export type BookingCandidate = {
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
    return { hasVenue: false, venueName: null, venueCity: null, candidates: [] };
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
    where: { type: { in: ['ARTIST', 'DJ'] } },
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

  return {
    hasVenue: true,
    venueName: venue.name,
    venueCity: venue.city,
    candidates,
  };
}
