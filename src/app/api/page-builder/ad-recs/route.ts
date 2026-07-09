import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { runAI } from '@/lib/ai';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const profileId = new URL(request.url).searchParams.get('profileId');
  const select = { ownerId: true, type: true, name: true, genres: true, city: true, hypeCount: true, bio: true } as const;
  const profile = profileId && profileId.length <= 64
    ? await db.profile.findUnique({ where: { id: profileId }, select })
    : await db.profile.findFirst({ where: { ownerId: session.user.id }, select });
  if (!profile || !canManageOwnedResource(session, profile.ownerId)) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const context = [
    profile.name && `Name: ${profile.name}`,
    profile.type && `Role: ${profile.type}`,
    profile.genres?.length && `Genres: ${profile.genres.join(', ')}`,
    profile.city && `City: ${profile.city}`,
    profile.hypeCount && `Hype count: ${profile.hypeCount}`,
    profile.bio && `Bio: ${profile.bio.slice(0, 200)}`,
  ].filter(Boolean).join('\n');

  const aiResult = await runAI([
    {
      role: 'system',
      content: 'You are a music marketing strategist. Given an artist/venue profile, return exactly 4 short ad campaign ideas as JSON array: [{"headline":"...","body":"...","channel":"...","cta":"..."}]. Headlines max 8 words. Body max 20 words. Channel = one of: Instagram, TikTok, Spotify, Local Flyers. CTA max 5 words. Return only valid JSON.',
    },
    { role: 'user', content: context },
  ], 400);

  let recs: Array<{ headline: string; body: string; channel: string; cta: string }> = [];
  if (aiResult) {
    try {
      const parsed = JSON.parse(aiResult.trim().replace(/^```json\s*/i, '').replace(/```$/, ''));
      if (Array.isArray(parsed)) recs = parsed.slice(0, 4);
    } catch { /* fall through to defaults */ }
  }

  if (recs.length === 0) {
    const name = profile.name ?? 'Your';
    recs = [
      { headline: `Discover ${name} on iHYPE`, body: 'Stream new music and hype your favourite artists.', channel: 'Instagram', cta: 'Listen now →' },
      { headline: `${name} is live — catch the moment`, body: 'See upcoming shows and grab tickets before they sell out.', channel: 'TikTok', cta: 'Get tickets →' },
      { headline: 'Support local music', body: `${name} is building something special. Hype them up.`, channel: 'Local Flyers', cta: 'Add your hype →' },
      { headline: `Follow ${name} on Spotify`, body: 'New tracks dropping soon — be first to hear them.', channel: 'Spotify', cta: 'Follow now →' },
    ];
  }

  return NextResponse.json({ recs });
}
