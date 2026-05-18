import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
const client = new Anthropic();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, genres: true, bio: true }
  });
  if (!profile) return NextResponse.json({ similar: [] });

  // Get other artists in same genres
  const candidates = await db.profile.findMany({
    where: { type: { in: ['ARTIST', 'DJ'] }, slug: { not: slug }, genres: { hasSome: profile.genres as string[] } },
    select: { name: true, slug: true, genres: true, bio: true },
    take: 20,
    orderBy: { hypeCount: 'desc' }
  });
  if (candidates.length === 0) return NextResponse.json({ similar: [] });

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Artist: ${profile.name} (${(profile.genres as string[]).join(', ')}). Bio: ${profile.bio ?? 'N/A'}.
Candidates: ${candidates.map(c => `${c.name} (${(c.genres as string[]).join(', ')})`).join('; ')}.
Return a JSON array of the 3 best matches as slugs: {"similar":["slug1","slug2","slug3"]}. Only return JSON.`
      }]
    });
    const text = (msg.content[0] as { text: string }).text;
    const parsed = JSON.parse(text) as { similar: string[] };
    const matched = parsed.similar
      .map(name => candidates.find(c => c.name === name || c.slug === name))
      .filter(Boolean)
      .slice(0, 3);
    return NextResponse.json({ similar: matched });
  } catch {
    return NextResponse.json({ similar: candidates.slice(0, 3) });
  }
}
