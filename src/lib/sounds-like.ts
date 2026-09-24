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
 * AI-assisted "similar artists" lookup behind the "Similar artists" section on
 * Artist profile pages call this directly as server
 * components. There used to be a GET /api/artists/[slug]/sounds-like wrapper
 * too; nothing ever fetched it, so it was removed rather than left as a second,
 * unauthenticated way into the same query.
 *
 * Narrows candidates to same-genre ARTIST/DJ profiles via a DB query, then asks the
 * model to pick the best few matches. Falls back to the top genre-matched candidates
 * (by hypeCount) if the model is unavailable or returns something unparseable.
 */
/** How long the Bio tab waits for the model before showing the hype-ranked fallback. */
export const SIMILAR_ARTISTS_AI_DEADLINE_MS = 2500;

type KnownProfile = { name: string; genres: string[]; bio: string | null };

export async function getSimilarArtists(
  slug: string,
  limit = 3,
  /* The artist pane has already read this row; passing it saves a round trip.
     Callers without it (none today) fall back to reading it by slug. */
  known?: KnownProfile,
): Promise<SimilarArtist[]> {
  const profile = known ?? await db.profile.findUnique({
    where: { slug },
    select: { name: true, genres: true, bio: true },
  });
  if (!profile) return [];

  const candidates = await db.profile.findMany({
    where: { type: 'ARTIST', slug: { not: slug }, genres: { hasSome: profile.genres as string[] } },
    // No `bio`: the prompt never reads a candidate's bio, and the rows are
    // handed to a client component, so it was twenty bios serialised for nothing.
    select: { name: true, slug: true, genres: true, avatarImage: true, type: true },
    take: 20,
    orderBy: { hypeCount: 'desc' },
  });
  if (candidates.length === 0) return [];

  /* BOUNDED (2026-09-24, DESIGN_SYNC row 513). The pane renders only when this
     resolves, and a Llama 3.3 70B generation has no ceiling of its own, so a
     slow or overloaded model held the whole Bio tab. Past the deadline the
     member gets the same hype-ranked fallback an unavailable model gives. */
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const raw = await Promise.race([
    runAI([
      {
        role: 'user',
        content: `Artist: ${profile.name} (${(profile.genres as string[]).join(', ')}). Bio: ${profile.bio ?? 'N/A'}.
Candidates: ${candidates.map((c) => `${c.name} (${(c.genres as string[]).join(', ')})`).join('; ')}.
Return a JSON array of the 3 best matches as slugs: {"similar":["slug1","slug2","slug3"]}. Only return JSON.`,
      },
    ], 300),
    new Promise<null>((resolve) => { deadline = setTimeout(() => resolve(null), SIMILAR_ARTISTS_AI_DEADLINE_MS); }),
  ]).finally(() => { if (deadline) clearTimeout(deadline); });

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
