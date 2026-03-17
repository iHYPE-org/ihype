import Link from 'next/link';
import { RegisterAccountChoices } from '@/components/RegisterAccountChoices';
import {
  NetworkEarthGlobe,
  type NetworkEarthRouteStop,
  type NetworkEarthVenue
} from '@/components/NetworkEarthGlobe';
import { getAdvertisingRecommendations } from '@/lib/market-recommendations';
import { getHomePageData } from '@/lib/public-data';
import { detectRequestLocation } from '@/lib/request-location';
import { formatCurrencyFromCents } from '@/lib/ticketing';

export const revalidate = 60;

type DiscoverRole = 'fans' | 'artists' | 'promoters' | 'venues';
type DiscoverModule =
  | 'recommendations'
  | 'globe'
  | 'character-lab'
  | 'signup'
  | 'ticket-hub'
  | 'show-creator';

const discoverModuleLabels: Record<DiscoverModule, string> = {
  recommendations: 'Recommendation Engine',
  globe: 'Globe Search',
  'character-lab': 'Character Lab',
  signup: 'Sign Up Wizard',
  'ticket-hub': 'Ticket Hub',
  'show-creator': 'Show Creator'
};

const discoverRoleModules: Record<DiscoverRole, DiscoverModule[]> = {
  fans: ['signup', 'character-lab', 'globe', 'recommendations', 'ticket-hub'],
  artists: ['signup', 'globe', 'ticket-hub', 'recommendations'],
  promoters: ['signup', 'show-creator', 'globe', 'ticket-hub', 'recommendations'],
  venues: ['signup', 'globe', 'ticket-hub', 'recommendations']
};

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

function getDiscoverRole(roleValue?: string | string[]): DiscoverRole | null {
  if (
    roleValue === 'fans' ||
    roleValue === 'artists' ||
    roleValue === 'promoters' ||
    roleValue === 'venues'
  ) {
    return roleValue;
  }

  return null;
}

function getDiscoverModule(
  moduleValue?: string | string[],
  legacyView?: string | string[]
): DiscoverModule | null {
  if (
    moduleValue === 'recommendations' ||
    moduleValue === 'globe' ||
    moduleValue === 'character-lab' ||
    moduleValue === 'signup' ||
    moduleValue === 'ticket-hub' ||
    moduleValue === 'show-creator'
  ) {
    return moduleValue;
  }

  if (legacyView === 'globe') {
    return 'globe';
  }

  return null;
}

function getRegisterPathForRole(role: DiscoverRole) {
  if (role === 'artists') return '/register/artist';
  if (role === 'promoters') return '/register/promoter';
  if (role === 'venues') return '/register/venue';
  return '/register';
}

function getRegisterRoleForChoices(role: DiscoverRole): 'FAN' | 'ARTIST' | 'DJ' | 'VENUE' {
  if (role === 'artists') return 'ARTIST';
  if (role === 'promoters') return 'DJ';
  if (role === 'venues') return 'VENUE';
  return 'FAN';
}

function getRoleTitle(role: DiscoverRole) {
  if (role === 'fans') return 'Fans';
  if (role === 'artists') return 'Artists';
  if (role === 'promoters') return 'Promoters';
  return 'Venues';
}

function getRoleSignupCopy(role: DiscoverRole) {
  if (role === 'artists') {
    return {
      fields: 'Artist name, contact info, hometown, username, password.',
      modules: 'Page Builder · Media Upload · Event Calendar'
    };
  }

  if (role === 'promoters') {
    return {
      fields: 'Promoter name, username, password.',
      modules: 'Page Builder · Avatar Builder · Show Creator'
    };
  }

  if (role === 'venues') {
    return {
      fields: 'Venue name, address, contact info, username, password.',
      modules: 'Verification · Page Builder · Event Calendar · Ticketing'
    };
  }

  return {
    fields: 'Avatar name, ZIP code, username, password.',
    modules: 'Character Lab · My Scheme · Top 5'
  };
}

function buildRouteStops(
  rankedShows: Awaited<ReturnType<typeof getHomePageData>>['rankedShows']
): NetworkEarthRouteStop[] {
  const now = Date.now();

  return rankedShows
    .filter((show) => show.venueProfile?.latitude != null && show.venueProfile?.longitude != null)
    .flatMap((show) => {
      const startsAt = show.startsAt instanceof Date ? show.startsAt : new Date(show.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        return [];
      }

      return [
        {
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
          }).format(startsAt),
          timing:
            show.status === 'LIVE'
              ? 'live'
              : startsAt.getTime() < now
                ? 'past'
                : 'upcoming'
        } satisfies NetworkEarthRouteStop
      ];
    })
    .slice(0, 16);
}

function formatShowDate(value: Date | string) {
  const nextValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(nextValue.getTime())) {
    return 'Date coming soon';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(nextValue);
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ module?: string | string[]; role?: string | string[]; view?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeRole = getDiscoverRole(resolvedSearchParams.role);
  const requestedModule = getDiscoverModule(resolvedSearchParams.module, resolvedSearchParams.view);
  const activeModule =
    activeRole && requestedModule && discoverRoleModules[activeRole].includes(requestedModule)
      ? requestedModule
      : null;

  const [{ profiles, rankedShows, transparencySnapshot }, viewerLocation] = await Promise.all([
    getHomePageData(),
    detectRequestLocation()
  ]);

  const topArtists = getProfilesByType(profiles, 'ARTIST', 5);
  const topPromoters = getProfilesByType(profiles, 'DJ', 5);
  const topVenues = getProfilesByType(profiles, 'VENUE', 5);
  const featuredArtist = topArtists[0] ?? null;
  const featuredPromoter = topPromoters[0] ?? null;
  const featuredVenue = topVenues[0] ?? null;

  const [artistRecommendations, promoterRecommendations, venueRecommendations] = await Promise.all([
    featuredArtist
      ? getAdvertisingRecommendations({
          profile: {
            type: 'ARTIST',
            city: featuredArtist.city,
            country: featuredArtist.country
          },
          stats: {
            pageHype: featuredArtist.hypeCount,
            upcomingCount: rankedShows.filter(
              (show) =>
                show.status !== 'ENDED' &&
                show.headlinerProfile?.name &&
                show.headlinerProfile.name === featuredArtist.name
            ).length,
            previousCount: rankedShows.filter(
              (show) =>
                show.status === 'ENDED' &&
                show.headlinerProfile?.name &&
                show.headlinerProfile.name === featuredArtist.name
            ).length
          }
        })
      : Promise.resolve([]),
    featuredPromoter
      ? getAdvertisingRecommendations({
          profile: {
            type: 'DJ',
            city: featuredPromoter.city,
            country: featuredPromoter.country
          },
          stats: {
            pageHype: featuredPromoter.hypeCount,
            upcomingCount: 0,
            previousCount: 0
          }
        })
      : Promise.resolve([]),
    featuredVenue
      ? getAdvertisingRecommendations({
          profile: {
            type: 'VENUE',
            city: featuredVenue.city,
            country: featuredVenue.country
          },
          stats: {
            pageHype: featuredVenue.hypeCount,
            upcomingCount: rankedShows.filter(
              (show) =>
                show.status !== 'ENDED' &&
                show.venueProfile?.name &&
                show.venueProfile.name === featuredVenue.name
            ).length,
            previousCount: rankedShows.filter(
              (show) =>
                show.status === 'ENDED' &&
                show.venueProfile?.name &&
                show.venueProfile.name === featuredVenue.name
            ).length,
            ticketsSold: rankedShows
              .filter((show) => show.venueProfile?.name && show.venueProfile.name === featuredVenue.name)
              .reduce((sum, show) => sum + show.ticketsSoldCount, 0)
          }
        })
      : Promise.resolve([])
  ]);

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
  const ticketedShows = rankedShows.filter((show) => show.isTicketed).slice(0, 6);

  const recommendationCards = [
    {
      badge: 'Artists',
      title: featuredArtist?.name ?? 'Artist lane loading',
      subtitle: 'Use trend direction to decide where artists should advertise and book next.',
      href: '/artists',
      recommendations: artistRecommendations.slice(0, 2)
    },
    {
      badge: 'Promoters',
      title: featuredPromoter?.name ?? 'Promoter lane loading',
      subtitle: 'See where promoter pages should push booking and audience signals next.',
      href: '/promoters',
      recommendations: promoterRecommendations.slice(0, 2)
    },
    {
      badge: 'Venues',
      title: featuredVenue?.name ?? 'Venue lane loading',
      subtitle: 'Turn venue traffic and event signals into clearer growth directions.',
      href: '/venues',
      recommendations: venueRecommendations.slice(0, 2)
    }
  ];

  const discoverRoleCards = [
    {
      key: 'fans' as const,
      label: 'Fans',
      browseHref: '/fans',
      count: transparencySnapshot.counters.totalListeners
    },
    {
      key: 'artists' as const,
      label: 'Artists',
      browseHref: '/artists',
      count: transparencySnapshot.counters.totalArtists
    },
    {
      key: 'promoters' as const,
      label: 'Promoters',
      browseHref: '/promoters',
      count: transparencySnapshot.counters.totalPromoters
    },
    {
      key: 'venues' as const,
      label: 'Venues',
      browseHref: '/venues',
      count: transparencySnapshot.counters.totalVenues
    }
  ];

  const activeRoleLabel = activeRole ? getRoleTitle(activeRole) : null;
  const activeSignupCopy = activeRole ? getRoleSignupCopy(activeRole) : null;

  return (
    <main className="container section discover-page-shell">
      <section className="panel discover-index-banner">
        <div className="discover-logo-lockup">
          <span className="discover-logo-mark">iHYPE</span>
          <strong className="discover-logo-word">Discover</strong>
        </div>
        <h1 className="discover-banner-title">Browse the network by role and open the exact tool you need.</h1>
        <p className="subtitle discover-banner-subtitle">
          Fans, artists, promoters, and venues each get their own module stack. Pick a lane first, then open one focused tool without the rest crowding the screen.
        </p>
        <div className="discover-index-links">
          {discoverRoleCards.map((roleCard) => (
            <Link className="discover-banner-link" href={roleCard.browseHref} key={roleCard.key}>
              <span>Browse {roleCard.label}</span>
              <strong>{roleCard.count}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="discover-role-grid" id="discover-module">
        {discoverRoleCards.map((roleCard) => (
          <article className="discover-role-column" key={roleCard.key}>
            <div className="discover-role-pill">
              <span>{roleCard.label}</span>
            </div>

            <div className="discover-role-module-stack">
              {discoverRoleModules[roleCard.key].map((moduleKey) => (
                <Link
                  className={
                    activeRole === roleCard.key && activeModule === moduleKey
                      ? 'discover-role-module active'
                      : 'discover-role-module'
                  }
                  href={`/?role=${roleCard.key}&module=${moduleKey}#discover-module`}
                  key={`${roleCard.key}-${moduleKey}`}
                >
                  {discoverModuleLabels[moduleKey]}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      {activeRole && activeModule ? (
        <section className="discover-role-detail-shell">
          <div className="panel discover-module-panel discover-module-panel-active">
            <div className="discover-module-head">
              <div>
                <div className="badge">{activeRoleLabel}</div>
                <h3>{discoverModuleLabels[activeModule]}</h3>
              </div>
              <p className="kicker">
                {activeModule === 'recommendations'
                  ? `${activeRoleLabel} can use trend direction to decide what to hype, where to push visibility, and which lanes are heating up next.`
                  : activeModule === 'globe'
                    ? `${activeRoleLabel} can start near the current request ZIP, then zoom out into regional, national, and global discovery.`
                    : activeModule === 'character-lab'
                      ? 'Fans can turn a written phrase into a saved sprite-ready companion tied to their fan identity.'
                      : activeModule === 'signup'
                        ? `${activeRoleLabel} get a focused setup flow with the right fields and secondary tools from day one.`
                        : activeModule === 'ticket-hub'
                          ? `${activeRoleLabel} can use serialized tickets, QR verification, and live event tracking without leaving the network.`
                          : 'Promoters can build streaming shows from artist media, voice breaks, and live sequence tools.'}
              </p>
            </div>

            {activeModule === 'recommendations' ? (
              <div className="discover-recommendation-grid">
                {recommendationCards.map((card) => (
                  <article className="discover-recommendation-card" key={card.badge}>
                    <div className="discover-recommendation-topline">
                      <span className="badge">{card.badge}</span>
                      <Link className="home-inline-link" href={card.href}>
                        Open lane
                      </Link>
                    </div>
                    <h4>{card.title}</h4>
                    <p>{card.subtitle}</p>
                    {card.recommendations.length ? (
                      <div className="discover-recommendation-list">
                        {card.recommendations.map((recommendation) => (
                          <div className="discover-recommendation-item" key={`${card.badge}-${recommendation.key}`}>
                            <strong>{recommendation.label}</strong>
                            <span>{recommendation.trendLabel}</span>
                            <p>{recommendation.adFocus}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty">Recommendation data is building for this lane.</div>
                    )}
                  </article>
                ))}
              </div>
            ) : null}

            {activeModule === 'globe' ? (
              <NetworkEarthGlobe
                badge={`${activeRoleLabel} Globe`}
                description="Start near the viewer request ZIP, then zoom out into regional, national, and global venue discovery."
                emptyRouteLabel="No routed show stops are available in the current globe scope."
                routeLabel="Live scene path"
                routeStops={globeRouteStops}
                title="Earth browse for venues and live paths"
                venues={globeVenues}
                viewerLocation={viewerLocation}
              />
            ) : null}

            {activeModule === 'character-lab' ? (
              <div className="discover-character-layout">
                <div className="discover-character-stage">
                  <div className="discover-character-glow discover-character-glow-a" />
                  <div className="discover-character-glow discover-character-glow-b" />
                  <div className="discover-character-card">
                    <span className="discover-character-eyes" />
                    <span className="discover-character-mouth" />
                  </div>
                  <div className="discover-character-bubble">
                    "Make me a neon night owl fan character with bold concert energy."
                  </div>
                </div>

                <div className="discover-tool-copy">
                  <div className="discover-tool-pills">
                    <span className="discover-tool-pill">Prompt phrase</span>
                    <span className="discover-tool-pill">4 generated options</span>
                    <span className="discover-tool-pill">Save to fan ID</span>
                    <span className="discover-tool-pill">Family-friendly 13+</span>
                  </div>
                  <ol className="discover-step-list">
                    <li>Write the phrase that describes the fan character you want.</li>
                    <li>Generate animated options and choose the best fit.</li>
                    <li>Save the selected companion and sprite set to your fan identity.</li>
                  </ol>
                  <div className="cta-row">
                    <Link className="button" href="/login">
                      Sign in to open lab
                    </Link>
                    <Link className="button secondary" href="/fans">
                      Browse fans
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {activeModule === 'signup' && activeSignupCopy ? (
              <>
                <RegisterAccountChoices activeRole={getRegisterRoleForChoices(activeRole)} />

                <div className="discover-signup-grid">
                  <Link className="discover-signup-card discover-signup-card-featured" href={getRegisterPathForRole(activeRole)}>
                    <strong>{activeRoleLabel} sign up</strong>
                    <p>{activeSignupCopy.fields}</p>
                    <span>{activeSignupCopy.modules}</span>
                  </Link>
                </div>
              </>
            ) : null}

            {activeModule === 'ticket-hub' ? (
              <div className="discover-ticket-grid">
                {ticketedShows.length ? (
                  ticketedShows.map((show) => (
                    <article className="discover-ticket-card" key={show.id}>
                      <div className="discover-ticket-topline">
                        <span className="badge">{show.status}</span>
                        <span>{formatCurrencyFromCents(show.ticketPriceCents)}</span>
                      </div>
                      <h4>{show.title}</h4>
                      <p>
                        {formatShowDate(show.startsAt)}
                        {show.venueProfile?.name ? ` · ${show.venueProfile.name}` : ''}
                      </p>
                      <p className="meta">
                        {show.ticketCapacity
                          ? `${show.ticketsSoldCount}/${show.ticketCapacity} sold`
                          : `${show.ticketsSoldCount} sold`}
                      </p>
                      <div className="discover-tool-pills">
                        <span className="discover-tool-pill">Unique serialized ID</span>
                        <span className="discover-tool-pill">Verification QR</span>
                      </div>
                      <Link className="button small secondary" href={`/shows/${show.slug}`}>
                        Open ticket page
                      </Link>
                    </article>
                  ))
                ) : (
                  <div className="empty">No ticketed shows are live right now.</div>
                )}
              </div>
            ) : null}

            {activeModule === 'show-creator' ? (
              <div className="discover-creator-layout">
                <div className="discover-creator-surface">
                  <div className="discover-creator-deck">
                    <span>Deck A</span>
                    <strong>Artist uploads</strong>
                  </div>
                  <div className="discover-creator-mixer">
                    <span>Crossfader</span>
                    <strong>Playlist + recorder</strong>
                  </div>
                  <div className="discover-creator-deck">
                    <span>Deck B</span>
                    <strong>Voice + samples</strong>
                  </div>
                </div>

                <div className="discover-tool-copy">
                  <div className="discover-tool-pills">
                    <span className="discover-tool-pill">{transparencySnapshot.counters.totalArtists} artists ready</span>
                    <span className="discover-tool-pill">{transparencySnapshot.counters.totalPromoters} promoters live</span>
                    <span className="discover-tool-pill">{rankedShows.length} shows in network</span>
                  </div>
                  <ol className="discover-step-list">
                    <li>Drag artist media into the playlist.</li>
                    <li>Record voice-over breaks and assign sample pads.</li>
                    <li>Publish the run-of-show as a streaming event.</li>
                  </ol>
                  <div className="cta-row">
                    <Link className="button" href="/register/promoter">
                      Start as promoter
                    </Link>
                    <Link className="button secondary" href="/promoters">
                      Browse promoters
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="panel discover-module-panel discover-empty-panel">
          <div className="discover-module-head">
            <div>
              <div className="badge">Index</div>
              <h3>Select a role and module</h3>
            </div>
            <p className="kicker">
              The stacks above mirror the network: fans, artists, promoters, and venues each get their own module path.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
