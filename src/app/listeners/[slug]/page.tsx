import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ShowCard } from '@/components/ShowCard';
import { HypeButton } from '@/components/HypeButton';
import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { FanRecommendationsPanel } from '@/components/FanRecommendationsPanel';
import { getSafeBackgroundImageStyle, getSafeImageUrl } from '@/lib/asset-safety';
import { getSharedDiscoverFeed, isLocalMatch, isRegionalMatch } from '@/lib/discover-feed';
import { canManageOwnedResource } from '@/lib/permissions';
import { getProfileDesignStyleVars } from '@/lib/profile-design';
import { detectRequestLocation, type RequestLocation } from '@/lib/request-location';
import { calculateFanLevel } from '@/lib/fan-level';

const listenerSections = ['about', 'recommend', 'upcoming', 'previous', 'top5', 'stats'] as const;

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
  if (section === 'top5') return 'Top 5';
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
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

  const profile = await db.profile.findUnique({ where: { slug } });
  if (!profile || profile.type !== 'LISTENER') return notFound();
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
      where: { userId: profile.ownerId },
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
        longitude: { not: null }
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
        status: { in: ['SCHEDULED', 'LIVE'] }
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
      where: { userId: profile.ownerId },
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
        headlinerProfileId: { not: null }
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
        type: 'DJ'
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
      <header className="artist-banner panel" style={bannerStyle}>
        <div className="profile-banner-row">
          {avatarImage ? (
            <img alt={`${profile.name} avatar`} className="profile-avatar profile-avatar-hero" src={avatarImage} />
          ) : (
            <div className="profile-avatar profile-avatar-hero profile-avatar-fallback">{getInitials(profile.name)}</div>
          )}
          <div className="artist-banner-copy">
            <div className="badge">FAN</div>
            <h1 className="title" style={{ fontSize: '2.9rem' }}>{profile.name}</h1>
            <p className="artist-headline">{profile.headline || 'Capture the shows, artists, and moments you keep coming back to.'}</p>
            <p className="subtitle">{profile.bio}</p>
            <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
            <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
            <p className="meta">FAN Level {fanLevel} | {fullSongListenCount} full songs | {fullShowListenCount} full shows</p>
            <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
            <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="fan page" />
          </div>
          {isOwner ? (
            <div className="profile-banner-actions">
              <Link className="button small secondary" href={`/dashboard?profile=${profile.id}&edit=menu`}>
                Edit Page
              </Link>
            </div>
          ) : null}
        </div>
      </header>

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
            <>
              <h2>About</h2>
              <div className="artist-copy">{profile.aboutContent || profile.bio || 'This fan has not filled out the About section yet.'}</div>
            </>
          ) : null}

          {activeSection === 'recommend' ? (
            <>
              <NetworkEarthGlobe
                description="Start at the detected ZIP from this request, highlight nearby venues, then zoom out to browse farther scenes and trace the shows this fan has already attended."
                emptyRouteLabel="No previous attended shows are mapped yet."
                routeLabel="Attended shows"
                routeStops={globeRouteStops}
                title="Earth globe for nearby venues and attended shows"
                venues={venues}
                viewerLocation={viewerLocation}
              />
              <FanRecommendationsPanel
                nearbyPromoters={nearbyPromoters}
                nearbyVenues={nearbyVenues}
                newArtists={newArtists}
                promoterGenreMatches={promoterGenreMatches}
                trendingArtists={trendingArtists}
                zipLabel={viewerLocation?.postalCode ?? viewerLocation?.city ?? viewerLocation?.stateRegion ?? null}
              />
            </>
          ) : null}

          {activeSection === 'upcoming' ? (
            <>
              <h2>Upcoming</h2>
              <div className="grid grid-2">
                {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No upcoming saved shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'previous' ? (
            <>
              <h2>Previous</h2>
              <div className="grid grid-2">
                {previousShows.length ? previousShows.map((show) => <ShowCard key={show.id} show={show} />) : <div className="empty">No previous saved shows yet.</div>}
              </div>
            </>
          ) : null}

          {activeSection === 'top5' ? (
            <>
              <h2>Top 5</h2>
              <div className="artist-copy">{profile.topFiveContent || 'No top 5 list yet.'}</div>
            </>
          ) : null}

          {activeSection === 'stats' ? (
            <>
              <h2>Stats</h2>
              <div className="grid grid-3">
                <div className="stat"><strong>{fanLevel}</strong>FAN level</div>
                <div className="stat"><strong>{hypePoints}</strong>Hype points</div>
                <div className="stat"><strong>{fullSongListenCount}</strong>Total songs listened</div>
                <div className="stat"><strong>{fullShowListenCount}</strong>Total shows listened</div>
                <div className="stat"><strong>{pastEventCount}</strong>Total events gone to</div>
                <div className="stat"><strong>{upcomingEventCount}</strong>Upcoming events going to</div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
