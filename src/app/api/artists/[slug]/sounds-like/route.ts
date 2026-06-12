import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runAI } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, genres: true, bio: true }
  });
  if (!profile) return NextResponse.json({ similar: [] });

  const candidates = await db.profile.findMany({
    where: { type: { in: ['ARTIST', 'DJ'] }, slug: { not: slug }, genres: { hasSome: profile.genres as string[] } },
    select: { name: true, slug: true, genres: true, bio: true },
    take: 20,
    orderBy: { hypeCount: 'desc' }
  });
  if (candidates.length === 0) return NextResponse.json({ similar: [] });

  const raw = await runAI([
    {
      role: 'user',
      content: `Artist: ${profile.name} (${(profile.genres as string[]).join(', ')}). Bio: ${profile.bio ?? 'N/A'}.
Candidates: ${candidates.map(c => `${c.name} (${(c.genres as string[]).join(', ')})`).join('; ')}.
Return a JSON array of the 3 best matches as slugs: {"similar":["slug1","slug2","slug3"]}. Only return JSON.`
    }
  ], 300);

  if (!raw) return NextResponse.json({ similar: candidates.slice(0, 3) });

  try {
    const parsed = JSON.parse(raw) as { similar: string[] };
    const matched = parsed.similar
      .map(name => candidates.find(c => c.name === name || c.slug === name))
      .filter(Boolean)
      .slice(0, 3);
    return NextResponse.json({ similar: matched });
  } catch {
    return NextResponse.json({ similar: candidates.slice(0, 3) });
  }
}
