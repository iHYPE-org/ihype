import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ContentReportControl } from '@/components/ContentReportControl';
import { getSafeBackgroundImageStyle, getSafeImageUrl } from '@/lib/asset-safety';
import { getSharedDiscoverFeed, isLocalMatch, isRegionalMatch } from '@/lib/discover-feed';
import { canManageOwnedResource } from '@/lib/permissions';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation, type RequestLocation } from '@/lib/request-location';
import { calculateFanLevel } from '@/lib/fan-level';
import {
  getDemoCreatorExclusion,
  getDemoOwnerExclusion,
  getDemoProfileRelationExclusion,
  getDemoShowRelationExclusion,
  isDemoUser,
  shouldHideDemoContent
} from '@/lib/runtime-flags';
import { FanHero } from './FanHero';
import { FanAbout } from './FanAbout';
import { FanRecommend } from './FanRecommend';

const listenerSections = ['about', 'recommend'] as const;

type ListenerSection = (typeof listenerSections)[number];
type LocationMatchShape = {
  postalCode?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
};

function getActiveSection(section: string | string[] | undefined): ListenerSection {
  if (typeof section === 'string' && listenerSections.includes(section as ListenerSection)) {
    return section as ListenerSection;
  }

  return 'about';
}

function getSectionLabel(section: ListenerSection) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function getTopFiveItems(content: string | null) {
  if (!content) {
    return [];
  }

  return content
    .split(/\r?\n|,/)
    .map((entry) => entry.replace(/^\s*[-*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function getLocationSignalScore(
  item: LocationMatchShape,
  viewerLocation: RequestLocation | null
) {
  if (isLocalMatch(item, viewerLocation)) {
    return 2;
  }

  if (isRegionalMatch(item, viewerLocation)) {
    return 1;
  }

  return 0;
}

function getLocationScopeLabel(
  item: LocationMatchShape,
  viewerLocation: RequestLocation | null
) {
  const score = getLocationSignalScore(item, viewerLocation);
  if (score === 2) return 'Local';
  if (score === 1) return 'Regional';
  return 'Network';
}

function sortByLocationSignal<
  T extends LocationMatchShape & {
    hypeCount: number;
    name: string;
  }
>(items: T[], viewerLocation: RequestLocation | null) {
  return [...items].sort((left, right) => {
    const leftScore = getLocationSignalScore(left, viewerLocation);
    const rightScore = getLocationSignalScore(right, viewerLocation);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    if (left.hypeCount !== right.hypeCount) {
      return right.hypeCount - left.hypeCount;
    }

    return left.name.localeCompare(right.name);
  });
}

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, genres: true, city: true, stateRegion: true, hypeCount: true, avatarImage: true }
  });

  if (!profile) return { title: 'Fan · iHYPE' };

  const loc    = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  const genres = profile.genres.slice(0, 3).join(', ');
  const title  = `${profile.name} · iHYPE`;
  const description = [
    'Fan',
    genres || null,
    loc || null,
    profile.hypeCount ? `${profile.hypeCount} HYPE` : null,
  ].filter(Boolean).join(' · ');
  const image = profile.avatarImage ?? undefined;

  return {
    title,
    description,
    openGraph: {
      type:        'profile',
      siteName:    'iHYPE',
      title,
      description,
      url:         `/fans/${slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card:        'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ListenerPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const session = await auth();
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeSection = getActiveSection(resolvedSearchParams.section);

  const profile = await db.profile.findUnique({
    where: { slug },
    include: {
      owner: {
        select: {
          email: true,
          username: true
        }
      }
    }
  });
  if (!profile || profile.type !== 'LISTENER') return notFound();
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();
  const viewerLocationPromise = detectRequestLocation();

  const [
    hypedShows,
    sentRecommendations,
    viewerLocation,
    venues,
    activeShows,
    profileHypes,
    promoterShows,
    fullSongListenCount,
    fullShowListenCount,
    discoverFeed,
    promoterProfiles
  ] = await Promise.all([
    db.hypeEvent.findMany({
      where: {
        userId: profile.ownerId,
        ...getDemoShowRelationExclusion()
      },
      include: {
        show: {
          include: {
            venueProfile: true,
            headlinerProfile: true,
            promoterProfile: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    db.venueConnectionRequest.findMany({
      where: { requesterId: profile.ownerId },
      orderBy: { createdAt: 'desc' }
    }),
    viewerLocationPromise,
    db.profile.findMany({
      where: {
        type: 'VENUE',
        latitude: { not: null },
        longitude: { not: null },
        ...getDemoOwnerExclusion()
      },
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        type: true,
        slug: true,
        hexId: true,
        name: true,
        addressLine1: true,
        contactInfo: true,
        hoursText: true,
        hometown: true,
        city: true,
        stateRegion: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        hypeCount: true,
        bio: true,
        genres: true,
        avatarImage: true
      }
    }),
    db.show.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        ...getDemoCreatorExclusion()
      },
      include: {
        venueProfile: true,
        headlinerProfile: true,
        promoterProfile: true
      },
      orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }],
      take: 16
    }),
    db.profileHypeEvent.findMany({
      where: {
        userId: profile.ownerId,
        ...getDemoProfileRelationExclusion()
      },
      include: {
        profile: {
          select: {
            id: true,
            type: true,
            genres: true
          }
        }
      }
    }),
    db.show.findMany({
      where: {
        promoterProfileId: { not: null },
        headlinerProfileId: { not: null },
        ...getDemoCreatorExclusion()
      },
      include: {
        promoterProfile: true,
        headlinerProfile: true,
        venueProfile: true
      },
      orderBy: [{ startsAt: 'desc' }, { hypeCount: 'desc' }],
      take: 24
    }),
    db.mediaListen.count({
      where: {
        userId: profile.ownerId,
        completedAt: { not: null }
      }
    }),
    db.showListen.count({
      where: {
        userId: profile.ownerId
      }
    }),
    viewerLocationPromise.then((location) => getSharedDiscoverFeed(location)),
    db.profile.findMany({
      where: {
        type: 'DJ',
        ...getDemoOwnerExclusion()
      },
      orderBy: [{ hypeCount: 'desc' }, { createdAt: 'desc' }],
      take: 24,
      select: {
        id: true,
        type: true,
        slug: true,
        hexId: true,
        name: true,
        contactInfo: true,
        addressLine1: true,
        hoursText: true,
        hometown: true,
        city: true,
        stateRegion: true,
        country: true,
        postalCode: true,
        hypeCount: true,
        bio: true,
        genres: true,
        avatarImage: true
      }
    })
  ]);

  const badges = await db.badge.findMany({
    where: { userId: profile.ownerId },
    select: { type: true, awardedAt: true },
    orderBy: { awardedAt: 'asc' },
  });

  // Cross-fan discovery: find fans with overlapping genres or Top 5 terms
  const fanGenres = profile.genres ?? [];
  const fanTopFiveTerms = getTopFiveItems(profile.topFiveContent)
    .map((t) => t.toLowerCase());

  const similarFans = fanGenres.length > 0
    ? await db.profile.findMany({
        where: {
          type: 'LISTENER',
          id: { not: profile.id },
          genres: { hasSome: fanGenres }
        },
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          country: true,
          genres: true,
          hypeCount: true,
          avatarImage: true,
          topFiveContent: true
        },
        orderBy: { hypeCount: 'desc' },
        take: 12
      })
    : [];

  // Score by genre overlap + Top 5 term overlap, keep top 5
  const scoredFans = similarFans
    .map((fan) => {
      const genreOverlap = fan.genres.filter((g) =>
        fanGenres.some((fg) => fg.toLowerCase() === g.toLowerCase())
      ).length;
      const fanTerms = getTopFiveItems(fan.topFiveContent).map((t) => t.toLowerCase());
      const topFiveOverlap = fanTopFiveTerms.filter((term) =>
        fanTerms.some((ft) => ft.includes(term) || term.includes(ft))
      ).length;
      return { ...fan, score: genreOverlap * 2 + topFiveOverlap * 3 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const now = new Date();
  const shows = hypedShows.map((entry) => entry.show);
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const previousShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE'));
  const isOwner = canManageOwnedResource(session, profile.ownerId);
  const likedGenreSet = new Set(
    profileHypes
      .filter((entry) => entry.profile.type === 'ARTIST')
      .flatMap((entry) => entry.profile.genres)
      .map((genre) => genre.trim().toLowerCase())
      .filter(Boolean)
  );
  const trendingArtists = discoverFeed.hypedNearMe.slice(0, 4);
  const newArtists = discoverFeed.newArtists.slice(0, 4);
  const nearbyVenuePool = venues.filter(
    (venue) => !viewerLocation || isLocalMatch(venue, viewerLocation) || isRegionalMatch(venue, viewerLocation)
  );
  const nearbyPromoterPool = promoterProfiles.filter(
    (promoter) => !viewerLocation || isLocalMatch(promoter, viewerLocation) || isRegionalMatch(promoter, viewerLocation)
  );
  const nearbyVenues = sortByLocationSignal(
    nearbyVenuePool.length ? nearbyVenuePool : venues,
    viewerLocation
  )
    .slice(0, 4)
    .map((venue) => ({
      ...venue,
      scopeLabel: getLocationScopeLabel(venue, viewerLocation)
    }));
  const nearbyPromoters = sortByLocationSignal(
    nearbyPromoterPool.length ? nearbyPromoterPool : promoterProfiles,
    viewerLocation
  )
    .slice(0, 4)
    .map((promoter) => ({
      ...promoter,
      scopeLabel: getLocationScopeLabel(promoter, viewerLocation)
    }));
  const promoterGenreMatches = Array.from(
    promoterShows.reduce(
      (map, show) => {
        if (!show.promoterProfile || !show.headlinerProfile || !likedGenreSet.size) {
          return map;
        }

        const matchedGenres = show.headlinerProfile.genres.filter((genre) => likedGenreSet.has(genre.trim().toLowerCase()));
        if (!matchedGenres.length) {
          return map;
        }

        const current = map.get(show.promoterProfile.id) ?? {
          id: show.promoterProfile.id,
          slug: show.promoterProfile.slug,
          name: show.promoterProfile.name,
          city: show.promoterProfile.city,
          stateRegion: show.promoterProfile.stateRegion,
          country: show.promoterProfile.country,
          postalCode: show.promoterProfile.postalCode,
          hexId: show.promoterProfile.hexId,
          type: show.promoterProfile.type,
          contactInfo: show.promoterProfile.contactInfo,
          addressLine1: show.promoterProfile.addressLine1,
          hoursText: show.promoterProfile.hoursText,
          hometown: show.promoterProfile.hometown,
          hypeCount: show.promoterProfile.hypeCount,
          bio: show.promoterProfile.bio,
          genres: show.promoterProfile.genres,
          avatarImage: show.promoterProfile.avatarImage,
          matchedArtistNames: new Set<string>(),
          matchedGenres: new Set<string>(),
          relatedShowCount: 0
        };

        current.matchedArtistNames.add(show.headlinerProfile.name);
        matchedGenres.forEach((genre) => current.matchedGenres.add(genre));
        current.relatedShowCount += 1;
        map.set(show.promoterProfile.id, current);
        return map;
      },
      new Map<
        string,
        {
          id: string;
          type: 'ARTIST' | 'DJ' | 'VENUE' | 'LISTENER';
          slug: string;
          hexId: string;
          name: string;
          contactInfo: string | null;
          addressLine1: string | null;
          hoursText: string | null;
          hometown: string | null;
          city: string | null;
          stateRegion: string | null;
          country: string | null;
          postalCode: string | null;
          hypeCount: number;
          bio: string | null;
          genres: string[];
          avatarImage: string | null;
          matchedArtistNames: Set<string>;
          matchedGenres: Set<string>;
          relatedShowCount: number;
        }
      >()
    ).values()
  )
    .map((entry) => ({
      ...entry,
      matchedArtistNames: [...entry.matchedArtistNames],
      matchedGenres: [...entry.matchedGenres],
      scopeLabel: getLocationScopeLabel(entry, viewerLocation)
    }))
    .sort((left, right) => {
      if (right.relatedShowCount !== left.relatedShowCount) {
        return right.relatedShowCount - left.relatedShowCount;
      }

      return right.matchedGenres.length - left.matchedGenres.length;
    })
    .slice(0, 4);
  const bannerStyle = getSafeBackgroundImageStyle(profile.heroImage);
  const pageDesignStyle = getProfileDesignStyleVars(profile.themePreset, {
    accentTone: profile.themeAccentTone,
    backdropTone: profile.themeBackdropTone,
    fontPreset: profile.themeFontPreset
  });
  const avatarImage = getSafeImageUrl(profile.avatarImage);
  const fanLevel = calculateFanLevel(fullSongListenCount, fullShowListenCount);
  const hypePoints = hypedShows.length + profileHypes.length;
  const pastEventCount = previousShows.length;
  const upcomingEventCount = upcomingShows.length;
  const topFiveItems = getTopFiveItems(profile.topFiveContent);
  const compactUpcomingShows = upcomingShows.slice(0, 3);
  const compactPreviousShows = previousShows.slice(0, 3);
  const globeRouteStops = previousShows
    .filter(
      (show) =>
        show.venueProfile?.latitude != null &&
        show.venueProfile.longitude != null
    )
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
    .map((show) => ({
      id: show.id,
      title: show.title,
      href: `/shows/${show.slug}`,
      venueName: show.venueProfile?.name ?? 'Venue',
      venueSlug: show.venueProfile?.slug ?? null,
      city: show.venueProfile?.city ?? null,
      stateRegion: show.venueProfile?.stateRegion ?? null,
      country: show.venueProfile?.country ?? null,
      postalCode: show.venueProfile?.postalCode ?? null,
      latitude: show.venueProfile?.latitude ?? null,
      longitude: show.venueProfile?.longitude ?? null,
      startsAtLabel: formatShowDate(show.startsAt),
      timing: 'past' as const
    }));

  return (
    <main className="container section profile-design-shell fan-page-shell" style={pageDesignStyle}>
      <FanHero
        avatarImage={avatarImage}
        badges={badges}
        bannerStyle={bannerStyle}
        fanLevel={fanLevel}
        fullShowListenCount={fullShowListenCount}
        fullSongListenCount={fullSongListenCount}
        isOwner={isOwner}
        profile={profile}
      />

      <section className="section">
        <nav className="section-tabs" aria-label="Fan page sections">
          {listenerSections.map((section) => (
            <Link
              key={section}
              className={section === activeSection ? 'section-tab active' : 'section-tab'}
              href={`/fans/${profile.slug}?section=${section}`}
            >
              {getSectionLabel(section)}
            </Link>
          ))}
        </nav>

        <div className="panel artist-section-panel">
          {activeSection === 'about' ? (
            <FanAbout
              compactPreviousShows={compactPreviousShows}
              compactUpcomingShows={compactUpcomingShows}
              fanGenres={fanGenres}
              fanLevel={fanLevel}
              fullShowListenCount={fullShowListenCount}
              fullSongListenCount={fullSongListenCount}
              hypePoints={hypePoints}
              pastEventCount={pastEventCount}
              profile={profile}
              scoredFans={scoredFans}
              topFiveItems={topFiveItems}
              upcomingEventCount={upcomingEventCount}
            />
          ) : null}

          {activeSection === 'recommend' ? (
            <FanRecommend
              globeRouteStops={globeRouteStops}
              nearbyPromoters={nearbyPromoters}
              nearbyVenues={nearbyVenues}
              newArtists={newArtists}
              promoterGenreMatches={promoterGenreMatches}
              trendingArtists={trendingArtists}
              venues={venues}
              viewerLocation={viewerLocation}
            />
          ) : null}
        </div>
      </section>

      <ContentReportControl targetId={profile.id} targetType="profile" />
    </main>
  );
}
