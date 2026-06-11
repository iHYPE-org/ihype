import { randomInt } from 'node:crypto';

// Pronounceable non-dictionary slugs ("veloka", "taniro") built from
// consonant-vowel syllables. The consonant set is curated to avoid
// offensive-looking combinations; vowels are the plain five.
const CONSONANTS = ['b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z'] as const;
const VOWELS = ['a', 'e', 'i', 'o', 'u'] as const;

/** Returns a pronounceable nonword like "veloka" (3 CV syllables, 6 letters). */
export function generateNonwordSlug(syllables = 3): string {
  let slug = '';
  for (let i = 0; i < syllables; i += 1) {
    // node:crypto randomInt is unbiased (rejection sampling) and works on
    // the Workers runtime via nodejs_compat — same usage as password-reset.
    slug += CONSONANTS[randomInt(CONSONANTS.length)] + VOWELS[randomInt(VOWELS.length)];
  }
  return slug;
}

type SlugDb = {
  profile: {
    findUnique(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
  };
};

/**
 * Generates a nonword slug that is not yet taken in the Profile table.
 * Retries up to 5 times, appending a random digit on later attempts.
 */
export async function generateUniqueNonwordSlug(db: SlugDb): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let slug = generateNonwordSlug();
    if (attempt > 0) slug += String(randomInt(10));
    const existing = await db.profile.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  // Last resort: longer nonword plus digits — collision is practically impossible.
  return `${generateNonwordSlug(4)}${randomInt(10)}${randomInt(10)}`;
}
