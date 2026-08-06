import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoOwnerExclusion, isRadioEnabledRuntime } from '@/lib/runtime-flags';
import { log } from '@/lib/logger';
import { releasedMediaWhere } from '@/lib/media-release';

export const dynamic = 'force-dynamic';

// Returns up to 20 playable uploaded tracks for autoplay radio.
// Ordered by artist hypeCount so trending artists surface first.
// Excludes track IDs passed in the `exclude` query param (comma-separated hexIds).
export async function GET(request: Request) {
  try {
    if (!(await isRadioEnabledRuntime())) {
      return NextResponse.json({ error: 'Radio is temporarily paused.', code: 'RADIO_PAUSED' }, { status: 503, headers: { 'Retry-After': '300' } });
    }
    const session = await auth().catch(() => null);
    const { searchParams } = new URL(request.url);
    const excludeParam = searchParams.get('exclude') ?? '';
    const excludeIds = excludeParam ? excludeParam.split(',').filter(Boolean) : [];
    const limit = 20;
    const genre = (searchParams.get('genre') ?? 'All sounds').trim().slice(0, 40);
    const location = (searchParams.get('location') ?? '').trim().slice(0, 60).replace(/^Near\s+/i, '');
    const topic = (searchParams.get('topic') ?? '').trim().slice(0, 40);
    const ranking = (searchParams.get('ranking') ?? 'Recommended for you').trim().slice(0, 40);

    // Bias towards artists the viewer has hyped if logged in.
    let hypedProfileIds: string[] = [];
    if (session?.user?.id) {
      const hyped = await db.profileHypeEvent.findMany({
        where: { userId: session.user.id },
        select: { profileId: true },
        take: 50
      });
      hypedProfileIds = hyped.map((h) => h.profileId);
    }

    // Playable tracks only. The DJ-authored radio-show query that used to sit
    // alongside this is gone: shows are created by nobody now (the Show Creator
    // was retired with the DJ role) and production holds zero isRadioShow rows,
    // so it could only ever return []. Its `stations` output had no consumer --
    // /radio reads /api/radio/station and the Music shell reads /api/stations,
    // both of which compute a station per listener instead.
    const [hypedTracks, trendingTracks] = await Promise.all([
    hypedProfileIds.length > 0
      ? db.artistMediaAsset.findMany({
          where: {
            profileId: { in: hypedProfileIds },
            hexId: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
            ...releasedMediaWhere(),
            profile: { ...getDemoOwnerExclusion(), discoverable: true }
          },
          select: {
            id: true, hexId: true, title: true, notes: true,
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
        ...releasedMediaWhere(),
        profile: { ...getDemoOwnerExclusion(), type: 'ARTIST', discoverable: true }
      },
      select: {
        id: true, hexId: true, title: true, notes: true,
        profile: { select: { name: true, slug: true, avatarImage: true, hypeCount: true } }
      },
      orderBy: { profile: { hypeCount: 'desc' } },
      take: limit
      }),
    ]);

    // Merge, deduplicate, cap at limit.
    const seen = new Set<string>();
    const tracks = [...hypedTracks, ...trendingTracks]
    .filter((t) => { if (seen.has(t.hexId)) return false; seen.add(t.hexId); return true; })
    .slice(0, limit)
    .map((t) => ({
      hexId: t.hexId,
      mediaId: t.id,
      title: t.title,
      notes: t.notes ?? null,
      url: `/api/media/${t.hexId}`,
      artistName: t.profile.name,
      artistSlug: t.profile.slug,
      artworkUrl: t.profile.avatarImage ?? null
      }));

    return NextResponse.json({ tracks }, { headers: { 'Cache-Control': session?.user?.id ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch (err) {
    log.error('[api/radio]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
