import { runAI } from '@/lib/ai';
import { db } from '@/lib/db';

type ProfileSummary = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  genres: string[];
  hypeCount: number;
  avatarImage: string | null;
};

export async function getSoundsLike(profileId: string): Promise<ProfileSummary[]> {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, name: true, bio: true, genre: true, genres: true }
  });

  if (!profile) return [];

  const genreStr = [...profile.genres, profile.genre].filter(Boolean).join(', ');
  const bioSnippet = profile.bio?.slice(0, 200) ?? '';

  const raw = await runAI([
    {
      role: 'system',
      content: 'You are a music recommendation engine. Respond ONLY with a JSON array of 3 artist name strings. No explanation, no markdown.'
    },
    {
      role: 'user',
      content: `Artist name: "${profile.name}"\nGenres: ${genreStr || 'unknown'}\nBio snippet: "${bioSnippet}"\n\nList exactly 3 artist names from the iHYPE platform that sound similar. Respond ONLY with a JSON array: ["Artist One", "Artist Two", "Artist Three"]`
    }
  ], 200);

  if (!raw) return [];

  try {
    const names: unknown = JSON.parse(raw);
    if (!Array.isArray(names)) return [];

    const nameStrings = (names as unknown[])
      .filter((n): n is string => typeof n === 'string')
      .slice(0, 3);

    if (nameStrings.length === 0) return [];

    return db.profile.findMany({
      where: {
        name: { in: nameStrings, mode: 'insensitive' },
        type: { in: ['ARTIST', 'DJ'] },
        id: { not: profileId }
      },
      select: {
        id: true, slug: true, name: true, bio: true, genres: true, hypeCount: true, avatarImage: true
      },
      take: 3
    });
  } catch {
    return [];
  }
}
