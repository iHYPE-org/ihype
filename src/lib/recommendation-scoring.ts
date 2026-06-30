// Pure scoring helpers for the recommender. Kept free of any DB import so the
// logic can be unit-tested in isolation (src/lib/db pulls in the Prisma client).

// Signal weights. Collaborative filtering is the strongest individual signal
// when the viewer has enough hype history; taste (genre overlap from hyped
// artists) covers users with <3 hypes; geo covers cold-start users with neither.
export const WEIGHTS = { taste: 0.28, geo: 0.18, social: 0.12, momentum: 0.10, collab: 0.22, comparable: 0.10 };

export type RecommendationReason = {
  kind: 'taste' | 'collab' | 'comparable' | 'geo' | 'momentum' | 'social';
  text: string;
  artistName?: string;
  artistSlug?: string;
};

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

// Picks the dominant weighted signal and turns it into a human "why" — the
// "Because you hyped X" explainability. Naming a hyped artist is reserved for
// the taste signal, where we can honestly tie it to a shared-genre artist the
// viewer actually hyped.
export function buildReason(
  signals: Signals,
  profileGenres: string[],
  genreToArtist: Map<string, { name: string; slug: string }>,
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
          return { kind: 'taste', text: `Because you hyped ${artist.name}`, artistName: artist.name, artistSlug: artist.slug };
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
