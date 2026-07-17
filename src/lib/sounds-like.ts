import { db } from '@/lib/db';
import { runAI } from '@/lib/ai';

export type SimilarArtist = {
  name: string;
  slug: string;
  genres: string[];
  avatarImage: string | null;
  type: string;
};

/**
 * AI-assisted "similar artists" lookup shared by GET /api/artists/[slug]/sounds-like
 * and the "Similar artists" section on /artists/[slug] and /promoters/[slug].
 *
 * Narrows candidates to same-genre ARTIST/DJ profiles via a DB query, then asks the
 * model to pick the best few matches. Falls back to the top genre-matched candidates
 * (by hypeCount) if the model is unavailable or returns something unparseable.
 */
export async function getSimilarArtists(slug: string, limit = 3): Promise<SimilarArtist[]> {
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, genres: true, bio: true },
  });
  if (!profile) return [];

  const candidates = await db.profile.findMany({
    where: { type: { in: ['ARTIST', 'DJ'] }, slug: { not: slug }, genres: { hasSome: profile.genres as string[] } },
    select: { name: true, slug: true, genres: true, bio: true, avatarImage: true, type: true },
    take: 20,
    orderBy: { hypeCount: 'desc' },
  });
  if (candidates.length === 0) return [];

  const raw = await runAI([
    {
      role: 'user',
      content: `Artist: ${profile.name} (${(profile.genres as string[]).join(', ')}). Bio: ${profile.bio ?? 'N/A'}.
Candidates: ${candidates.map((c) => `${c.name} (${(c.genres as string[]).join(', ')})`).join('; ')}.
Return a JSON array of the 3 best matches as slugs: {"similar":["slug1","slug2","slug3"]}. Only return JSON.`,
    },
  ], 300);

  if (!raw) return candidates.slice(0, limit);

  try {
    const parsed = JSON.parse(raw) as { similar: string[] };
    const matched = parsed.similar
      .map((name) => candidates.find((c) => c.name === name || c.slug === name))
      .filter((c): c is (typeof candidates)[number] => Boolean(c))
      .slice(0, limit);
    return matched.length > 0 ? matched : candidates.slice(0, limit);
  } catch {
    return candidates.slice(0, limit);
  }
}
