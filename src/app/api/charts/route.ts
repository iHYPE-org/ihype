import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PALETTE = ['#ff5029', '#b983ff', '#22e5d4', '#ff3e9a', '#ffb84a', '#7fb3ff'];

export type ChartTrack = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  city: string;
  genres: string[];
  hypeCount: number;
  color: string;
  mediaUrl: string;
  durationSec: number;
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ national: [], local: [], forYou: [] });
  }

  const city = (new URL(request.url).searchParams.get('city') ?? '').trim().toLowerCase();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentHypes = await db.seed.findMany({
    where: { action: 'hype', createdAt: { gte: since } },
    select: { mediaId: true },
  });

  if (!recentHypes.length) {
    return NextResponse.json({ national: [], local: [], forYou: [] });
  }

  const hypeCount = new Map<string, number>();
  for (const r of recentHypes) {
    hypeCount.set(r.mediaId, (hypeCount.get(r.mediaId) ?? 0) + 1);
  }

  const topIds = [...hypeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([id]) => id);

  const media = await db.artistMediaAsset.findMany({
    where: { id: { in: topIds }, isPublished: true },
    select: {
      id: true,
      title: true,
      durationSecs: true,
      storageUrl: true,
      profile: { select: { name: true, slug: true, city: true, genres: true } },
    },
  });

  const toTrack = (m: typeof media[number], i: number): ChartTrack => ({
    id: m.id,
    title: m.title,
    artistName: m.profile?.name ?? 'Unknown Artist',
    artistSlug: m.profile?.slug ?? '',
    city: m.profile?.city ?? '',
    genres: m.profile?.genres ?? [],
    hypeCount: hypeCount.get(m.id) ?? 0,
    color: PALETTE[i % PALETTE.length],
    mediaUrl: m.storageUrl ?? '',
    durationSec: m.durationSecs ?? 0,
  });

  const sorted = [...media].sort((a, b) => (hypeCount.get(b.id) ?? 0) - (hypeCount.get(a.id) ?? 0));

  const national = sorted.slice(0, 10).map(toTrack);

  const local = sorted
    .filter(m => city && (m.profile?.city ?? '').toLowerCase().includes(city))
    .slice(0, 10)
    .map(toTrack);

  // forYou: match genres the user's hyped artists play
  const myHypes = await db.profileHypeEvent.findMany({
    where: { userId: session.user.id },
    select: { profile: { select: { genres: true } } },
    take: 50,
  });
  const myGenres = new Set(myHypes.flatMap(h => h.profile.genres));

  const forYou = (myGenres.size > 0
    ? sorted.filter(m => m.profile?.genres?.some(g => myGenres.has(g)))
    : sorted
  ).slice(0, 10).map(toTrack);

  return NextResponse.json(
    { national, local, forYou },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
