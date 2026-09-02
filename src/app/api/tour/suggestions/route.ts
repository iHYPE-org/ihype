import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildAiTourPlan } from '@/lib/ai-tour';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Three aggregates and a Workers AI call per GET with no budget (second
  // security scan, 2026-09-02).
  const rl = await consumeRateLimit(rateLimitKey('ai-tour-plan', session.user.id, null), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests — try again later.' }, { status: 429 });

  // Venue profiles with city data, sorted by hypeCount
  const venues = await db.profile.findMany({
    where: { type: 'VENUE', city: { not: null } },
    orderBy: { hypeCount: 'desc' },
    take: 60,
    select: { id: true, name: true, city: true, hypeCount: true, slug: true, stateRegion: true },
  }).catch(() => [] as { id: string; name: string; city: string | null; hypeCount: number; slug: string; stateRegion: string | null }[]);

  // Upcoming shows per city (aggregate demand signal)
  const upcomingShows = await db.show.groupBy({
    by: ['venueProfileId'],
    where: { status: { in: ['SCHEDULED', 'LIVE'] }, startsAt: { gte: new Date() }, venueProfileId: { not: null } },
    _count: { id: true },
    _sum: { hypeCount: true },
  }).catch(() => [] as { venueProfileId: string | null; _count: { id: number }; _sum: { hypeCount: number | null } }[]);

  const showsByVenue = new Map(upcomingShows.map(s => [s.venueProfileId, { count: s._count.id, hype: s._sum.hypeCount ?? 0 }]));

  // Group venues by city
  type Stop = { city: string; venues: { id: string; name: string; slug: string; hypeCount: number; upcomingShows: number }[]; totalHype: number; showCount: number };
  const cityMap = new Map<string, Stop>();
  for (const v of venues) {
    const city = v.city!;
    if (!cityMap.has(city)) cityMap.set(city, { city, venues: [], totalHype: 0, showCount: 0 });
    const entry = cityMap.get(city)!;
    const showData = showsByVenue.get(v.id) ?? { count: 0, hype: 0 };
    entry.venues.push({ id: v.id, name: v.name, slug: v.slug, hypeCount: v.hypeCount, upcomingShows: showData.count });
    entry.totalHype += v.hypeCount + showData.hype;
    entry.showCount += showData.count;
  }

  const stops = Array.from(cityMap.values())
    .sort((a, b) => b.totalHype - a.totalHype)
    .slice(0, 10)
    .map(s => ({
      city: s.city,
      score: Math.min(99, Math.round(50 + Math.log2(s.totalHype + 2) * 5)),
      reach: s.totalHype >= 1000 ? `${(s.totalHype / 1000).toFixed(1)}k` : String(s.totalHype),
      showCount: s.showCount,
      venues: s.venues.slice(0, 3),
    }));

  // Top trending artists/DJs for venue booking
  const artists = await db.profile.findMany({
    where: { type: 'ARTIST', hypeCount: { gt: 0 }, fanShareEnabled: true },
    orderBy: { hypeCount: 'desc' },
    take: 12,
    select: { id: true, name: true, city: true, genres: true, hypeCount: true, slug: true, type: true },
  }).catch(() => [] as { id: string; name: string; city: string | null; genres: string[]; hypeCount: number; slug: string; type: string }[]);

  // AI routing layer: order the demand-ranked stops into an itinerary for the
  // requesting artist. Null when no artist profile or the AI binding is down.
  const ownProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: 'ARTIST' },
    select: { name: true, genres: true, city: true, stateRegion: true, hypeCount: true },
  }).catch(() => null);

  const aiPlan = ownProfile ? await buildAiTourPlan(ownProfile, stops).catch(() => null) : null;

  return NextResponse.json({ stops, artists, aiPlan });
}
