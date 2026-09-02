// Pure scoring helpers for the recommender. Kept free of any DB import so the
// logic can be unit-tested in isolation (src/lib/db pulls in the Prisma client).

// Signal weights. Collaborative filtering is the strongest individual signal
// when the viewer has enough hype history; taste (genre overlap from hyped
// artists) covers users with <3 hypes; geo covers cold-start users with neither.
export const WEIGHTS = { taste: 0.28, geo: 0.18, social: 0.12, momentum: 0.10, collab: 0.22, comparable: 0.10 };

export type RecommendationReason = {
  kind: 'taste' | 'collab' | 'comparable' | 'geo' | 'momentum' | 'social' | 'request';
  text: string;
  artistName?: string;
  artistSlug?: string;
};

/**
 * How the viewer came to know the artist a taste reason names. A hype, a
 * follow and a fan request are three different sentences, and the request
 * is the strongest of them (2026-09-01: fan requests feed recommendations).
 */
export type KnownVia = 'hype' | 'follow' | 'request';
export type KnownArtist = { name: string; slug: string; via?: KnownVia };

/** What each way of knowing an artist adds to the viewer's genre profile. */
export const KNOWN_GENRE_WEIGHT: Record<KnownVia, number> = { hype: 1, follow: 2, request: 3 };

export type ViewerSignals = { hypes: number; seeds: number; follows: number; requests: number };

/**
 * Whether the engine has anything to say to this viewer.
 *
 * Owner, 2026-09-01: "build it up so when activity comes in it will make those
 * recommendations. Will say nothing yet until something makes sense." So the
 * gate is a taste signal the viewer LEFT — a hype, a discover-deck action, a
 * follow, or a request to a venue. Location alone is not enough: "popular
 * near you" is a chart, not a recommendation, and the charts tab already
 * says it. One signal is the floor rather than several because the first
 * recommendation is what teaches a fan the engine is listening; it just has
 * to be a recommendation and not a guess.
 */
export function isRecommendationReady(signals: ViewerSignals): boolean {
  return signals.hypes + signals.seeds + signals.follows + signals.requests >= 1;
}

export type Signals = { taste: number | null; geo: number | null; social: number; momentum: number; collab: number | null; comparable: number | null };

export function geoTier(
  viewerState: string | null, viewerCountry: string | null, viewerCity: string | null,
  profileState: string | null, profileCountry: string | null, profileCity: string | null,
): number | null {
  if (!viewerState && !viewerCountry) return null;
  if (!profileState && !profileCountry) return null;
  if (viewerCity && profileCity && viewerCity.toLowerCase() === profileCity.toLowerCase() &&
      viewerState && profileState && viewerState.toLowerCase() === profileState.toLowerCase()) return 1;
  if (viewerState && profileState && viewerState.toLowerCase() === profileState.toLowerCase()) return 0.8;
  if (viewerCountry && profileCountry && viewerCountry.toLowerCase() === profileCountry.toLowerCase()) return 0.45;
  return 0.15;
}

export function tasteScore(viewerGenres: string[], profileGenres: string[]): number | null {
  if (!viewerGenres.length) return null;
  if (!profileGenres.length) return 0;
  const viewerSet = new Set(viewerGenres.map((g) => g.toLowerCase()));
  const overlap = profileGenres.filter((g) => viewerSet.has(g.toLowerCase())).length;
  return Math.min(1, overlap / Math.max(1, Math.min(viewerGenres.length, profileGenres.length)));
}

export function finalScore(signals: Signals): number {
  let weightedSum = 0;
  let totalWeight = 0;
  const entries: [keyof typeof WEIGHTS, number | null][] = [
    ['taste', signals.taste], ['geo', signals.geo], ['social', signals.social],
    ['momentum', signals.momentum], ['collab', signals.collab], ['comparable', signals.comparable],
  ];
  for (const [key, value] of entries) {
    if (value !== null) {
      weightedSum += value * WEIGHTS[key];
      totalWeight += WEIGHTS[key];
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Multiplicative boost for a candidate show whose headliner or venue the
 * viewer has already bought a ticket to before — a repeat-affinity signal
 * distinct from (and stacked on top of) the collaborative-filtering score,
 * since "you've seen this artist / been to this room before" is a strong,
 * cheaply-available personalization signal from ticket purchase history.
 */
export function historyBoost(seenArtistBefore: boolean, seenVenueBefore: boolean): number {
  let boost = 1;
  if (seenArtistBefore) boost += 0.35;
  if (seenVenueBefore) boost += 0.15;
  return boost;
}

// Picks the dominant weighted signal and turns it into a human "why" — the
// "Because you hyped X" explainability. Naming a hyped artist is reserved for
// the taste signal, where we can honestly tie it to a shared-genre artist the
// viewer actually hyped.
export function buildReason(
  signals: Signals,
  profileGenres: string[],
  genreToArtist: Map<string, KnownArtist>,
  profileCity: string | null,
): RecommendationReason {
  const contributions: [keyof typeof WEIGHTS, number][] = [];
  for (const key of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    const v = signals[key];
    if (v !== null && v > 0) contributions.push([key, v * WEIGHTS[key]]);
  }
  contributions.sort((a, b) => b[1] - a[1]);
  const top = contributions[0]?.[0] ?? 'social';

  switch (top) {
    case 'taste': {
      for (const g of profileGenres) {
        const artist = genreToArtist.get(g.toLowerCase());
        if (artist) {
          const text = artist.via === 'request'
            ? `Because you asked a venue to book ${artist.name}`
            : artist.via === 'follow'
              ? `Because you follow ${artist.name}`
              : `Because you hyped ${artist.name}`;
          return { kind: 'taste', text, artistName: artist.name, artistSlug: artist.slug };
        }
      }
      const genre = profileGenres[0];
      return { kind: 'taste', text: genre ? `Matches your taste in ${genre}` : 'Matches your taste' };
    }
    case 'collab':
      return { kind: 'collab', text: 'Fans like you hype them' };
    case 'comparable':
      return { kind: 'comparable', text: 'In the orbit of artists you follow' };
    case 'geo':
      return { kind: 'geo', text: profileCity ? `Popular in ${profileCity}` : 'Big in your area' };
    case 'momentum':
      return { kind: 'momentum', text: 'Trending this week' };
    default:
      return { kind: 'social', text: 'Hyped right now' };
  }
}
