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

    // Fetch playable tracks and actual DJ-authored radio shows together.
    const [hypedTracks, trendingTracks, radioShows] = await Promise.all([
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
        profile: { ...getDemoOwnerExclusion(), type: { in: ['ARTIST', 'DJ'] }, discoverable: true }
      },
      select: {
        id: true, hexId: true, title: true, notes: true,
        profile: { select: { name: true, slug: true, avatarImage: true, hypeCount: true } }
      },
      orderBy: { profile: { hypeCount: 'desc' } },
      take: limit
      }),
      db.show.findMany({
        where: {
          isRadioShow: true,
          status: { in: ['LIVE', 'SCHEDULED'] },
          moderationStatus: 'APPROVED',
          ...(genre !== 'All sounds' ? { tags: { has: genre } } : {}),
          ...(topic && topic !== 'New releases' ? { tags: { has: topic } } : {}),
          ...(location && location !== 'Anywhere' && location !== 'Michigan' && location !== 'Great Lakes' ? {
            OR: [
              { headlinerProfile: { city: { contains: location, mode: 'insensitive' }, discoverable: true } },
              { venueProfile: { city: { contains: location, mode: 'insensitive' }, discoverable: true } },
              { creator: { profiles: { some: { type: 'DJ', city: { contains: location, mode: 'insensitive' }, discoverable: true } } } },
            ],
          } : {}),
        },
        orderBy: ranking === 'Most HYPED' ? [{ hypeCount: 'desc' }, { startsAt: 'asc' }] : [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
        take: 20,
        select: {
          id: true, slug: true, title: true, status: true, startsAt: true, hypeCount: true, tags: true,
          headlinerProfile: { select: { id: true, name: true, slug: true, type: true, city: true, stateRegion: true, avatarImage: true } },
          creator: { select: { profiles: { where: { type: 'DJ', discoverable: true }, take: 1, select: { id: true, name: true, slug: true, city: true, stateRegion: true, avatarImage: true } } } },
          radioTracks: { orderBy: { position: 'asc' }, take: 1, select: { title: true, artistName: true, mediaAsset: { select: { id: true, hexId: true, title: true, profile: { select: { name: true, slug: true, avatarImage: true } } } } } },
        },
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

    const stationProfiles = radioShows.map((show) => show.headlinerProfile?.type === 'DJ' ? show.headlinerProfile : show.creator.profiles[0]).filter(Boolean);
    const followedIds = session?.user?.id && stationProfiles.length
      ? new Set((await db.follow.findMany({ where: { followerId: session.user.id, followeeProfileId: { in: stationProfiles.map((profile) => profile!.id) } }, select: { followeeProfileId: true } })).map((follow) => follow.followeeProfileId))
      : new Set<string>();
    const stations = radioShows.map((show) => {
      const profile = show.headlinerProfile?.type === 'DJ' ? show.headlinerProfile : show.creator.profiles[0];
      const queued = show.radioTracks[0];
      const media = queued?.mediaAsset;
      return {
        id: show.id,
        title: show.title,
        meta: [profile?.name, profile?.city, profile?.stateRegion, show.tags.slice(0, 2).join(' · ')].filter(Boolean).join(' · ') || 'Independent radio',
        signal: `${show.hypeCount.toLocaleString()} HYPES`,
        time: show.status === 'LIVE' ? 'LIVE' : new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(show.startsAt),
        href: `/shows/${show.slug}`,
        profileId: profile?.id ?? null,
        following: profile ? followedIds.has(profile.id) : false,
        track: media ? {
          mediaId: media.id,
          hexId: media.hexId,
          title: media.title || queued.title,
          artist: media.profile.name || queued.artistName || 'Independent artist',
          artistSlug: media.profile.slug,
          art: media.profile.avatarImage || profile?.avatarImage || '/brand/ihype-menu-logo.webp',
          url: `/api/media/${media.hexId}`,
          scene: [profile?.city, profile?.stateRegion].filter(Boolean).join(' · ') || 'Independent radio',
          match: show.title,
          hypeCount: show.hypeCount,
        } : null,
      };
    });

    return NextResponse.json({ tracks, stations }, { headers: { 'Cache-Control': session?.user?.id ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch (err) {
    log.error('[api/radio]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
