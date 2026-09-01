import { db } from '@/lib/db';
import { bookingTasteScore as tasteScore, bookingGeoScore as geoScore } from '@/lib/growth-util';
import { runAIJson } from '@/lib/ai';
import { describeDemand, scoreFanDemand, type DemandEntry, type DemandRequest } from '@/lib/fan-demand';

export type BookingCandidate = {
  /** Null for an act fans named that has no iHYPE profile — still demand. */
  profileId: string | null;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  genres: string[];
  city: string | null;
  hypeCount: number;
  reason: string;       // why this artist surfaced
  local: boolean;
  /** Present when fans asked this venue for the act — the analysed request signal. */
  demand: { fans: number; requests: number; nearby: number; latestAt: string } | null;
};

export type VenueBookingFeed = {
  hasVenue: boolean;
  venueName: string | null;
  venueCity: string | null;
  candidates: BookingCandidate[];
  aiEnhanced: boolean;
  /** Pending fan requests the analysis ran over. */
  requestCount: number;
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

type DemandRow = DemandRequest & {
  artistProfile: ArtistRow | null;
  requester: { profiles: { city: string | null; stateRegion: string | null; latitude: number | null; longitude: number | null }[] };
};

/**
 * Venue-side recommender: "book these artists." Given a venue owner, surfaces
 * artists ranked first by FAN DEMAND — the requests fans sent this venue,
 * analysed by time, frequency and the fan's location (`fan-demand.ts`) — then
 * by genre-fit, geo proximity and hype momentum, excluding acts the venue has
 * already booked. This is the supply-side counterpart to the fan recommender.
 *
 * Demand ranks first because it is the only signal here that is a fan saying
 * "I would come": the other three infer it. An act fans asked for that is not
 * in the discoverable pool is still surfaced, and an act fans named that has
 * no profile at all is surfaced too (`profileId: null`), because "six fans
 * want a band you have never heard of" is the point of a demand radar.
 */
export async function getVenueBookingRecommendations(userId: string, now: Date = new Date()): Promise<VenueBookingFeed> {
  const venue = await db.profile.findFirst({
    where: { ownerId: userId, type: 'VENUE' },
    select: { id: true, name: true, genres: true, city: true, stateRegion: true, latitude: true, longitude: true },
  }).catch(() => null);

  if (!venue) {
    return { hasVenue: false, venueName: null, venueCity: null, candidates: [], aiEnhanced: false, requestCount: 0 };
  }

  /* PENDING only. BOOKED is done and DISMISSED is the venue saying no; either
     back in the ranking would make the radar nag. Legacy rows predate the
     stored requester location, so the requester's own profile location is
     read as the fallback — the same source the route captures from today. */
  const requestRows: DemandRow[] = await db.venueConnectionRequest.findMany({
    where: { venueProfileId: venue.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      artistProfileId: true, artistName: true, requesterId: true, createdAt: true,
      requesterCity: true, requesterStateRegion: true, requesterLatitude: true, requesterLongitude: true,
      artistProfile: {
        select: { id: true, slug: true, name: true, avatarImage: true, genres: true, city: true, stateRegion: true, hypeCount: true },
      },
      requester: { select: { profiles: { select: { city: true, stateRegion: true, latitude: true, longitude: true }, take: 1 } } },
    },
  }).catch(() => [] as DemandRow[]);

  const demand = scoreFanDemand(
    requestRows.map((row) => {
      const fallback = row.requester.profiles[0];
      const hasStored = row.requesterCity || row.requesterStateRegion || row.requesterLatitude !== null;
      return hasStored || !fallback
        ? row
        : { ...row, requesterCity: fallback.city, requesterStateRegion: fallback.stateRegion, requesterLatitude: fallback.latitude, requesterLongitude: fallback.longitude };
    }),
    venue,
    now,
  );
  const demandByProfile = new Map<string, DemandEntry>();
  for (const entry of demand) if (entry.artistProfileId) demandByProfile.set(entry.artistProfileId, entry);
  const profileById = new Map<string, ArtistRow>();
  for (const row of requestRows) if (row.artistProfile) profileById.set(row.artistProfile.id, row.artistProfile);

  // Artists already booked at this venue — exclude from suggestions.
  const booked = await db.show.findMany({
    where: { venueProfileId: venue.id, headlinerProfileId: { not: null } },
    select: { headlinerProfileId: true },
  }).catch(() => [] as { headlinerProfileId: string | null }[]);
  const bookedIds = new Set(
    booked.map((b: { headlinerProfileId: string | null }) => b.headlinerProfileId).filter((id: string | null): id is string => !!id)
  );

  const rows: ArtistRow[] = await db.profile.findMany({
    where: { type: 'ARTIST', discoverable: true },
    orderBy: { hypeCount: 'desc' },
    take: CANDIDATE_POOL,
    select: {
      id: true, slug: true, name: true, avatarImage: true,
      genres: true, city: true, stateRegion: true, hypeCount: true,
    },
  }).catch(() => [] as ArtistRow[]);

  /* An act fans asked for joins the pool even when it is outside the top
     CANDIDATE_POOL by hype or not discoverable — the request IS the reason. */
  for (const [id, profile] of profileById) {
    if (!rows.some((r) => r.id === id)) rows.push(profile);
  }

  const maxHype = Math.max(...rows.map((r: ArtistRow) => r.hypeCount), 1);
  const maxDemand = Math.max(...demand.map((d) => d.weight), 0);

  const toCandidate = (r: ArtistRow, taste: number, local: boolean, entry: DemandEntry | undefined): BookingCandidate => ({
    profileId: r.id,
    slug: r.slug,
    name: r.name,
    avatarUrl: r.avatarImage ?? null,
    genres: r.genres.slice(0, 3),
    city: r.city,
    hypeCount: r.hypeCount,
    local,
    demand: entry ? { fans: entry.fans, requests: entry.requests, nearby: entry.nearby, latestAt: entry.latestAt.toISOString() } : null,
    reason: entry
      ? describeDemand(entry, now)
      : local && taste > 0 ? 'Local act in your genre'
      : local ? 'Rising act near you'
      : taste > 0 ? 'Matches your genre mix'
      : 'Trending now',
  });

  const scored = rows
    .filter((r: ArtistRow) => !!r.slug && !bookedIds.has(r.id))
    .map((r: ArtistRow) => {
      const taste = tasteScore(venue.genres, r.genres);
      const geo = geoScore(venue.city, venue.stateRegion, r.city, r.stateRegion);
      const momentum = r.hypeCount / maxHype;
      const entry = demandByProfile.get(r.id);
      /* Demand is added ON TOP of a score already normalised to [0,1], so any
         act a fan asked for outranks every act nobody did, and demanded acts
         still order among themselves by how much demand. */
      const demandScore = entry && maxDemand > 0 ? 1 + entry.weight / maxDemand : 0;
      const score = taste * WEIGHTS.taste + geo * WEIGHTS.geo + momentum * WEIGHTS.momentum + demandScore;
      const local = !!venue.city && !!r.city && venue.city.toLowerCase() === r.city.toLowerCase();
      return { r, score, taste, local, entry };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_SIZE);

  const candidates: BookingCandidate[] = scored.map(({ r, taste, local, entry }) => toCandidate(r, taste, local, entry));

  /* Acts fans named that have no profile. Appended after the profile-backed
     demand, in demand order, and never more than the result size allows. */
  for (const entry of demand) {
    if (entry.artistProfileId || candidates.length >= RESULT_SIZE + 8) continue;
    candidates.push({
      profileId: null,
      slug: null,
      name: entry.artistName,
      avatarUrl: null,
      genres: [],
      city: null,
      hypeCount: 0,
      local: false,
      demand: { fans: entry.fans, requests: entry.requests, nearby: entry.nearby, latestAt: entry.latestAt.toISOString() },
      reason: describeDemand(entry, now),
    });
  }

  /* The AI pitch only rewrites HEURISTIC reasons. A demand chip is a fact
     ("3 fans asked · 2 nearby") and a pitch would replace it with prose. */
  const aiEnhanced = await enhanceBookingPitches(venue, candidates.filter((c) => c.demand === null));

  return {
    hasVenue: true,
    venueName: venue.name,
    venueCity: venue.city,
    candidates,
    aiEnhanced,
    requestCount: requestRows.length,
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
  const head = candidates.filter((c) => c.slug !== null).slice(0, AI_PITCH_CANDIDATES);
  if (head.length === 0) return false;

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
