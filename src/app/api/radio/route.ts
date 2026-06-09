import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

// Returns up to 20 playable uploaded tracks for autoplay radio.
// Ordered by artist hypeCount so trending artists surface first.
// Excludes track IDs passed in the `exclude` query param (comma-separated hexIds).
export async function GET(request: Request) {
  try {
    const session = await auth().catch(() => null);
    const { searchParams } = new URL(request.url);
  const excludeParam = searchParams.get('exclude') ?? '';
  const excludeIds = excludeParam ? excludeParam.split(',').filter(Boolean) : [];
  const limit = 20;

  // Bias towards artists the viewer has hyped if logged in
  let hypedProfileIds: string[] = [];
  if (session?.user?.id) {
    const hyped = await db.profileHypeEvent.findMany({
      where: { userId: session.user.id },
      select: { profileId: true },
      take: 50
    });
    hypedProfileIds = hyped.map((h) => h.profileId);
  }

  // Fetch from hyped artists first, then fill with trending artists
  const [hypedTracks, trendingTracks] = await Promise.all([
    hypedProfileIds.length > 0
      ? db.artistMediaAsset.findMany({
          where: {
            profileId: { in: hypedProfileIds },
            hexId: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
            profile: getDemoOwnerExclusion()
          },
          select: {
            hexId: true, title: true, notes: true,
            profile: { select: { name: true, slug: true, avatarImage: true, hypeCount: true } }
          },
          take: 10,
          orderBy: { profile: { hypeCount: 'desc' } }
        })
      : Promise.resolve([]),
    db.artistMediaAsset.findMany({
      where: {
        profileId: hypedProfileIds.length > 0 ? { notIn: hypedProfileIds } : undefined,
        hexId: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
        profile: { ...getDemoOwnerExclusion(), type: { in: ['ARTIST', 'DJ'] } }
      },
      select: {
        hexId: true, title: true, notes: true,
        profile: { select: { name: true, slug: true, avatarImage: true, hypeCount: true } }
      },
      orderBy: { profile: { hypeCount: 'desc' } },
      take: limit
    })
  ]);

  // Merge, deduplicate, cap at limit
  const seen = new Set<string>();
  const tracks = [...hypedTracks, ...trendingTracks]
    .filter((t) => { if (seen.has(t.hexId)) return false; seen.add(t.hexId); return true; })
    .slice(0, limit)
    .map((t) => ({
      hexId: t.hexId,
      title: t.title,
      notes: t.notes ?? null,
      url: `/api/media/${t.hexId}`,
      artistName: t.profile.name,
      artistSlug: t.profile.slug,
      artworkUrl: t.profile.avatarImage ?? null
    }));

    return NextResponse.json({ tracks });
  } catch (err) {
    console.error('[api/radio] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
