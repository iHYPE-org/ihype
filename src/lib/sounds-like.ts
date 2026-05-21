import Anthropic from '@anthropic-ai/sdk';
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

  const prompt = `You are a music recommendation engine for the iHYPE platform.
Artist name: "${profile.name}"
Genres: ${genreStr || 'unknown'}
Bio snippet: "${bioSnippet}"

List exactly 3 artist names (first and last name or stage name only) from the iHYPE platform that sound similar to this artist.
Respond with ONLY a JSON array of strings, e.g. ["Artist One", "Artist Two", "Artist Three"].
No explanation, no markdown, just the JSON array.`;

  const client = new Anthropic();
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]';
    const names: unknown = JSON.parse(text);
    if (!Array.isArray(names)) return [];

    const nameStrings = (names as unknown[])
      .filter((n): n is string => typeof n === 'string')
      .slice(0, 3);

    if (nameStrings.length === 0) return [];

    const matches = await db.profile.findMany({
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

    return matches;
  } catch {
    return [];
  }
}
