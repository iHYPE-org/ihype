import Link from 'next/link';
import { ProfileCard } from '@/components/ProfileCard';
import {
  NetworkEarthGlobe,
  type NetworkEarthRouteStop,
  type NetworkEarthVenue
} from '@/components/NetworkEarthGlobe';
import { getHomePageData } from '@/lib/public-data';
import { detectRequestLocation } from '@/lib/request-location';

export const revalidate = 60;

type DiscoverView = 'globe' | 'top5';
type TopFiveGroup = 'artists' | 'promoters' | 'venues';

function getProfilesByType<T extends 'ARTIST' | 'DJ' | 'VENUE'>(
  profiles: Awaited<ReturnType<typeof getHomePageData>>['profiles'],
  type: T,
  count = 6
) {
  return profiles
    .filter((profile) => profile.type === type)
    .sort((left, right) => right.hypeCount - left.hypeCount)
    .slice(0, count);
}

function getDiscoverView(value?: string | string[]): DiscoverView {
  return value === 'top5' ? 'top5' : 'globe';
}

function getTopFiveGroup(value?: string | string[]): TopFiveGroup {
  if (value === 'promoters' || value === 'venues') {
    return value;
  }

  return 'artists';
}

function buildRouteStops(
  rankedShows: Awaited<ReturnType<typeof getHomePageData>>['rankedShows']
): NetworkEarthRouteStop[] {
  const now = Date.now();

  return rankedShows
    .filter((show) => show.venueProfile?.latitude != null && show.venueProfile?.longitude != null)
    .slice(0, 16)
    .map((show) => ({
      id: show.id,
      title: show.title,
      href: `/shows/${show.slug}`,
      venueName: show.venueProfile?.name ?? 'Venue TBA',
      city: show.venueProfile?.city ?? null,
      stateRegion: show.venueProfile?.stateRegion ?? null,
      country: show.venueProfile?.country ?? null,
      postalCode: show.venueProfile?.postalCode ?? null,
      latitude: show.venueProfile?.latitude ?? null,
      longitude: show.venueProfile?.longitude ?? null,
      startsAtLabel: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(show.startsAt),
      timing:
        show.status === 'LIVE'
          ? 'live'
          : show.startsAt.getTime() < now
            ? 'past'
            : 'upcoming'
    }));
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ view?: string | string[]; top?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeView = getDiscoverView(resolvedSearchParams.view);
  const activeTopFiveGroup = getTopFiveGroup(resolvedSearchParams.top);

  const [{ profiles, rankedShows, transparencySnapshot }, viewerLocation] = await Promise.all([
    getHomePageData(),
    detectRequestLocation()
  ]);

  const topArtists = getProfilesByType(profiles, 'ARTIST', 5);
  const topPromoters = getProfilesByType(profiles, 'DJ', 5);
  const topVenues = getProfilesByType(profiles, 'VENUE', 5);

  const topFiveGroups: Record<
    TopFiveGroup,
    {
      badge: string;
      heading: string;
      copy: string;
      href: string;
      profiles: typeof topArtists;
    }
  > = {
    artists: {
      badge: 'Artists',
      heading: 'Top 5 artists',
      copy: 'The most hyped artist pages in the network right now.',
      href: '/artists',
      profiles: topArtists
    },
    promoters: {
      badge: 'Promoters',
      heading: 'Top 5 promoters',
      copy: 'Promoters pulling the strongest signal from fans right now.',
      href: '/promoters',
      profiles: topPromoters
    },
    venues: {
      badge: 'Venues',
      heading: 'Top 5 venues',
      copy: 'Rooms and spaces fans are pushing higher across the network.',
      href: '/venues',
      profiles: topVenues
    }
  };

  const globeVenues: NetworkEarthVenue[] = profiles
    .filter((profile) => profile.type === 'VENUE')
    .map((profile) => ({
      id: profile.id,
      slug: profile.slug,
      name: profile.name,
      addressLine1: profile.addressLine1,
      hoursText: profile.hoursText,
      city: profile.city,
      stateRegion: profile.stateRegion,
      country: profile.country,
      postalCode: profile.postalCode,
      latitude: profile.latitude,
      longitude: profile.longitude
    }));
  const globeRouteStops = buildRouteStops(rankedShows);
  const activeTopFive = topFiveGroups[activeTopFiveGroup];

  return (
    <main className="container section discover-page-shell">
      <section className="panel discover-banner">
        <div className="discover-banner-copy">
          <div className="discover-logo-lockup">
            <span className="discover-logo-mark">iHYPE</span>
            <strong className="discover-logo-word">Discover</strong>
          </div>
          <h1 className="discover-banner-title">Find the next artist, promoter, or venue worth hyping.</h1>
          <p className="subtitle discover-banner-subtitle">
            Start with direct browse lanes, or drop into the globe and top-five signal to see where the
            network is pulling hardest.
          </p>
        </div>

        <div className="discover-banner-links">
          <Link className="discover-banner-link" href="/artists">
            <span>Browse Artists</span>
            <strong>{transparencySnapshot.counters.totalArtists}</strong>
          </Link>
          <Link className="discover-banner-link" href="/promoters">
            <span>Browse Promoters</span>
            <strong>{transparencySnapshot.counters.totalPromoters}</strong>
          </Link>
          <Link className="discover-banner-link" href="/venues">
            <span>Browse Venues</span>
            <strong>{transparencySnapshot.counters.totalVenues}</strong>
          </Link>
        </div>
      </section>

      <section className="discover-module-shell" id="discover-module">
        <div className="panel discover-module-control">
          <div>
            <div className="badge">Discover modules</div>
            <h2 className="discover-module-title">Pick a lane and keep it open.</h2>
          </div>
          <div className="discover-module-tabs">
            <Link
              className={activeView === 'globe' ? 'discover-module-tab active' : 'discover-module-tab'}
              href="/?view=globe#discover-module"
            >
              Globe Browse
            </Link>
            <Link
              className={activeView === 'top5' ? 'discover-module-tab active' : 'discover-module-tab'}
              href="/?view=top5#discover-module"
            >
              Top 5
            </Link>
          </div>
        </div>

        {activeView === 'globe' ? (
          <NetworkEarthGlobe
            badge="Earth Browse"
            description="Start near the viewer request ZIP, then zoom out into regional, national, and global venue discovery."
            emptyRouteLabel="No routed show stops are available in the current globe scope."
            routeLabel="Live scene path"
            routeStops={globeRouteStops}
            title="Globe venue discovery"
            venues={globeVenues}
            viewerLocation={viewerLocation}
          />
        ) : (
          <section className="panel discover-topfive-panel">
            <div className="discover-topfive-topline">
              <div>
                <div className="badge">{activeTopFive.badge}</div>
                <h3>{activeTopFive.heading}</h3>
                <p className="kicker">{activeTopFive.copy}</p>
              </div>
              <div className="discover-topfive-tabs">
                <Link
                  className={activeTopFiveGroup === 'artists' ? 'discover-topfive-tab active' : 'discover-topfive-tab'}
                  href="/?view=top5&top=artists#discover-module"
                >
                  Artists
                </Link>
                <Link
                  className={activeTopFiveGroup === 'promoters' ? 'discover-topfive-tab active' : 'discover-topfive-tab'}
                  href="/?view=top5&top=promoters#discover-module"
                >
                  Promoters
                </Link>
                <Link
                  className={activeTopFiveGroup === 'venues' ? 'discover-topfive-tab active' : 'discover-topfive-tab'}
                  href="/?view=top5&top=venues#discover-module"
                >
                  Venues
                </Link>
              </div>
            </div>

            <div className="discover-topfive-grid">
              {activeTopFive.profiles.length ? (
                activeTopFive.profiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)
              ) : (
                <div className="empty">No pages are live in this Top 5 lane yet.</div>
              )}
            </div>

            <div className="discover-topfive-footer">
              <Link className="button secondary" href={activeTopFive.href}>
                Open full {activeTopFive.badge.toLowerCase()} directory
              </Link>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
