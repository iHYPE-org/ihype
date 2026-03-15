import Link from 'next/link';
import { RegisterAccountChoices } from '@/components/RegisterAccountChoices';
import {
  NetworkEarthGlobe,
  type NetworkEarthRouteStop,
  type NetworkEarthVenue
} from '@/components/NetworkEarthGlobe';
import { getHomePageData } from '@/lib/public-data';
import { detectRequestLocation } from '@/lib/request-location';
import { getAdvertisingRecommendations } from '@/lib/market-recommendations';
import { formatCurrencyFromCents } from '@/lib/ticketing';

export const revalidate = 60;

type DiscoverModule =
  | 'recommendations'
  | 'globe'
  | 'character-lab'
  | 'signup'
  | 'ticket-hub'
  | 'show-creator';

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

function getDiscoverModule(
  moduleValue?: string | string[],
  legacyView?: string | string[]
): DiscoverModule {
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

  return 'recommendations';
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
  searchParams?: Promise<{ module?: string | string[]; view?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeModule = getDiscoverModule(resolvedSearchParams.module, resolvedSearchParams.view);

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
  const moduleLinks: Array<{ key: DiscoverModule; label: string }> = [
    { key: 'recommendations', label: 'Recommendation Engine' },
    { key: 'globe', label: 'Globe Search' },
    { key: 'character-lab', label: 'Character Lab' },
    { key: 'signup', label: 'Sign Up Wizard' },
    { key: 'ticket-hub', label: 'Ticket Hub' },
    { key: 'show-creator', label: 'Show Creator' }
  ];

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
            Browse the network directly or open one focused module at a time to explore discovery, identity,
            tickets, and show-building tools.
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
            <h2 className="discover-module-title">Open one tool and keep the rest out of the way.</h2>
          </div>
          <div className="discover-module-tabs">
            {moduleLinks.map((moduleLink) => (
              <Link
                className={activeModule === moduleLink.key ? 'discover-module-tab active' : 'discover-module-tab'}
                href={`/?module=${moduleLink.key}#discover-module`}
                key={moduleLink.key}
              >
                {moduleLink.label}
              </Link>
            ))}
          </div>
        </div>

        {activeModule === 'recommendations' ? (
          <section className="panel discover-module-panel discover-recommendation-panel">
            <div className="discover-module-head">
              <div>
                <div className="badge">Recommendation engine</div>
                <h3>Trend direction across artists, promoters, and venues</h3>
              </div>
              <p className="kicker">
                These lanes use live network activity to suggest where each side of the ecosystem should push next.
              </p>
            </div>

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
          </section>
        ) : null}

        {activeModule === 'globe' ? (
          <NetworkEarthGlobe
            badge="Globe Search"
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
          <section className="panel discover-module-panel discover-character-panel">
            <div className="discover-module-head">
              <div>
                <div className="badge">Character lab</div>
                <h3>Build an animated fan companion from a phrase</h3>
              </div>
              <p className="kicker">
                Fans can write a short prompt, generate animated avatar options, and save the chosen character to
                their fan ID for future page interactions.
              </p>
            </div>

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
                </div>
                <ol className="discover-step-list">
                  <li>Write the phrase that describes the fan character you want.</li>
                  <li>Generate animated options and choose the best fit.</li>
                  <li>Save the selected companion to your fan page identity.</li>
                </ol>
                <div className="cta-row">
                  <Link className="button" href="/login">
                    Sign in to open lab
                  </Link>
                  <Link className="button secondary" href="/fans">
                    Browse fan pages
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeModule === 'signup' ? (
          <section className="panel discover-module-panel discover-signup-panel">
            <div className="discover-module-head">
              <div>
                <div className="badge">Sign up wizard</div>
                <h3>Choose the right entry path fast</h3>
              </div>
              <p className="kicker">
                Every account type has a focused setup flow with the right fields and secondary tools from the start.
              </p>
            </div>

            <RegisterAccountChoices activeRole="FAN" />

            <div className="discover-signup-grid">
              <Link className="discover-signup-card" href="/register">
                <strong>Fan</strong>
                <p>Avatar name, ZIP, username, password.</p>
                <span>Avatar Builder · Page Builder · Top 5</span>
              </Link>
              <Link className="discover-signup-card" href="/register/artist">
                <strong>Artist</strong>
                <p>Artist name, contact info, hometown, username, password.</p>
                <span>Page Builder · Media Upload · Event Calendar</span>
              </Link>
              <Link className="discover-signup-card" href="/register/promoter">
                <strong>Promoter</strong>
                <p>Promoter name, username, password.</p>
                <span>Page Builder · Avatar Builder · Show Creator</span>
              </Link>
              <Link className="discover-signup-card" href="/register/venue">
                <strong>Venue</strong>
                <p>Venue name, address, contact info, username, password.</p>
                <span>Verification · Page Builder · Event Calendar · Ticketing</span>
              </Link>
            </div>
          </section>
        ) : null}

        {activeModule === 'ticket-hub' ? (
          <section className="panel discover-module-panel discover-ticket-panel">
            <div className="discover-module-head">
              <div>
                <div className="badge">Ticket hub</div>
                <h3>Serialized tickets, QR verification, and live event access</h3>
              </div>
              <p className="kicker">
                Ticketing stays inside the network with unique ticket IDs, scan validation, and venue-side fraud checks.
              </p>
            </div>

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
          </section>
        ) : null}

        {activeModule === 'show-creator' ? (
          <section className="panel discover-module-panel discover-creator-panel">
            <div className="discover-module-head">
              <div>
                <div className="badge">Show creator</div>
                <h3>Promoter workspace for building streaming shows</h3>
              </div>
              <p className="kicker">
                Promoters can pull artist uploads into a playlist, add voice-overs, trigger sample pads, and publish
                structured streaming shows from one workspace.
              </p>
            </div>

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
          </section>
        ) : null}
      </section>
    </main>
  );
}
