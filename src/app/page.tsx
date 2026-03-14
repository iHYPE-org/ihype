import Link from 'next/link';
import { ActivityMap } from '@/components/ActivityMap';
import { buildActivityMapPoints, buildActivityScopeCards } from '@/lib/activity-stats';
import { FEED_HEURISTICS_VERSION, getShowVisibilitySignals } from '@/lib/integrity';
import { getHomePageData } from '@/lib/public-data';

export const revalidate = 60;

const homeTabs = ['mission', 'geography', 'stats'] as const;

type HomeTab = (typeof homeTabs)[number];

function getActiveHomeTab(tab: string | string[] | undefined): HomeTab {
  if (typeof tab === 'string' && homeTabs.includes(tab as HomeTab)) {
    return tab as HomeTab;
  }

  return 'mission';
}

function getHomeTabLabel(tab: HomeTab) {
  if (tab === 'mission') return 'Mission';
  if (tab === 'geography') return 'Geography';
  return 'Stats';
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab = getActiveHomeTab(resolvedSearchParams.tab);
  const { rankedShows, featuredShows, profiles, requests, transparencySnapshot } = await getHomePageData();

  const activityScopes = buildActivityScopeCards({
    profiles,
    shows: rankedShows,
    requests
  });
  const activityPoints = buildActivityMapPoints({
    profiles,
    shows: rankedShows
  });
  const hotspots = activityPoints.slice(0, 4);
  const featuredProfiles = profiles.slice(0, 4);

  const signalStripItems = [
    { label: 'Live now', value: `${transparencySnapshot.counters.liveShows} on air` },
    { label: 'Upcoming', value: `${transparencySnapshot.counters.upcomingShows} in queue` },
    { label: 'Tickets sold', value: transparencySnapshot.counters.totalTicketsSold.toLocaleString() },
    { label: 'Heuristics', value: `v${FEED_HEURISTICS_VERSION}` }
  ];

  const statCards = [
    { label: 'Total listeners', value: transparencySnapshot.counters.totalListeners },
    { label: 'Listeners live now', value: transparencySnapshot.counters.listenersLiveNow },
    { label: 'Total venues', value: transparencySnapshot.counters.totalVenues },
    { label: 'Total artists', value: transparencySnapshot.counters.totalArtists },
    { label: 'Total promoters', value: transparencySnapshot.counters.totalPromoters },
    { label: 'Events held', value: transparencySnapshot.counters.totalEventsHeld },
    { label: 'Tickets sold', value: transparencySnapshot.counters.totalTicketsSold },
    { label: 'Songs uploaded', value: transparencySnapshot.counters.totalSongsUploaded }
  ];

  const browseCards = [
    {
      href: '/shows',
      title: 'Shows',
      copy: 'Watch live rooms first, then move into scheduled and recent broadcasts.'
    },
    {
      href: '/artists',
      title: 'Artists',
      copy: 'Profiles, uploads, and direct discovery built around the artist page.'
    },
    {
      href: '/promoters',
      title: 'Promoters',
      copy: 'Program nights, build lineups, and shape audience demand around rooms.'
    },
    {
      href: '/venues',
      title: 'Venues',
      copy: 'See rooms, request bookings, and track the local demand building around them.'
    }
  ];

  return (
    <main className="container home-shell">
      <section className="home-submenu-shell">
        <nav className="home-submenu-tabs" aria-label="Homepage sections">
          {homeTabs.map((tab) => (
            <Link
              key={tab}
              className={tab === activeTab ? 'home-submenu-tab active' : 'home-submenu-tab'}
              href={tab === 'mission' ? '/' : `/?tab=${tab}`}
            >
              {getHomeTabLabel(tab)}
            </Link>
          ))}
        </nav>

        <div className="home-submenu-body">
          {activeTab === 'mission' ? (
            <div className="home-tab-stack">
              <section className="home-mission-grid">
                <article className="home-mission-panel">
                  <div className="badge">Streaming-first discovery</div>
                  <h1 className="home-mission-title">Live shows stay at the center. Everything else exists to help the right rooms fill faster.</h1>
                  <p className="home-mission-copy">
                    iHYPE is built to turn artist uploads, promoter programming, venue demand, and listener hype into a
                    usable network instead of a black-box feed. Watch what is live, find the next room, and understand
                    why it surfaced.
                  </p>
                  <div className="cta-row">
                    <Link className="button" href={featuredShows[0] ? `/shows/${featuredShows[0].slug}` : '/shows'}>
                      {featuredShows[0] ? 'Watch featured show' : 'Browse shows'}
                    </Link>
                    <Link className="button secondary" href="/register">
                      Create account
                    </Link>
                    <Link className="button secondary" href="/integrity">
                      See heuristics
                    </Link>
                  </div>

                  <div className="home-signal-strip home-signal-strip-dark">
                    {signalStripItems.map((item) => (
                      <div className="home-signal-item home-signal-item-dark" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </article>

                <aside className="home-featured-panel">
                  <div className="home-featured-head">
                    <div>
                      <div className="home-card-label">Live + upcoming</div>
                      <h2>Signal queue</h2>
                    </div>
                    <Link className="home-inline-link" href="/shows">
                      Open shows
                    </Link>
                  </div>

                  <div className="home-featured-list">
                    {featuredShows.length ? (
                      featuredShows.map((show) => {
                        const visibility = getShowVisibilitySignals(show);

                        return (
                          <Link className="home-featured-card" href={`/shows/${show.slug}`} key={show.id}>
                            <div className="home-featured-card-topline">
                              <span className="badge">{show.status}</span>
                              <span className="meta">{visibility.signals[0]?.value ?? 'Visible now'}</span>
                            </div>
                            <strong>{show.title}</strong>
                            <p className="meta">
                              {show.venueProfile?.name ?? 'Venue TBA'}
                              {show.headlinerProfile?.name ? ` | ${show.headlinerProfile.name}` : ''}
                            </p>
                            <p>{show.description ?? 'Built for direct discovery and quick tune-in.'}</p>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="empty">No shows are ready yet.</div>
                    )}
                  </div>
                </aside>
              </section>

              <section className="home-browse-grid">
                <div className="home-browse-panel panel">
                  <div className="home-featured-head">
                    <div>
                      <div className="home-card-label">Explore the network</div>
                      <h2>Browse by role</h2>
                    </div>
                  </div>

                  <div className="home-browse-card-grid">
                    {browseCards.map((card) => (
                      <Link className="home-browse-card" href={card.href} key={card.href}>
                        <strong>{card.title}</strong>
                        <p>{card.copy}</p>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="home-browse-panel panel">
                  <div className="home-featured-head">
                    <div>
                      <div className="home-card-label">Early leaders</div>
                      <h2>Profiles with traction</h2>
                    </div>
                  </div>

                  <div className="home-profile-list">
                    {featuredProfiles.map((profile) => {
                      const href =
                        profile.type === 'ARTIST'
                          ? `/artists/${profile.slug}`
                          : profile.type === 'DJ'
                            ? `/promoters/${profile.slug}`
                            : profile.type === 'VENUE'
                              ? `/venues/${profile.slug}`
                              : `/listeners/${profile.slug}`;

                      return (
                        <Link className="home-profile-row" href={href} key={profile.id}>
                          <div>
                            <strong>{profile.name}</strong>
                            <p className="meta">
                              {profile.type === 'DJ' ? 'PROMOTER' : profile.type}
                              {[profile.city, profile.country].filter(Boolean).length
                                ? ` | ${[profile.city, profile.country].filter(Boolean).join(', ')}`
                                : ''}
                            </p>
                          </div>
                          <span>{profile.hypeCount} hype</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'geography' ? (
            <div className="home-tab-stack">
              <section className="home-section-panel">
                <div className="home-section-header">
                  <div>
                    <div className="badge">Geography</div>
                    <h2>Start at full orbit, then dive into the nearest public activity layer.</h2>
                  </div>
                  <p className="kicker">The globe eases toward nearby network activity without exposing any viewer location details.</p>
                </div>

                <div className="home-lens-grid">
                  <article className="home-wire-card home-geo-card">
                    <div className="home-card-header">
                      <div>
                        <div className="home-card-label">Scope</div>
                        <h2>Footprint by market layer.</h2>
                      </div>
                    </div>

                    <div className="home-scope-stack">
                      {activityScopes.map((scope) => (
                        <div className="home-scope-row" key={scope.key}>
                          <div>
                            <strong>{scope.label}</strong>
                            <span>{scope.description}</span>
                          </div>
                          <div className="home-scope-values">
                            <span>{scope.profiles} profiles</span>
                            <span>{scope.activeShows} active shows</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="home-hotspot-block">
                      <h3>Public zip hotspots</h3>
                      <div className="home-hotspot-list">
                        {hotspots.map((point) => (
                          <div className="home-hotspot" key={point.id}>
                            <div className="home-hotspot-code">{point.postalCode}</div>
                            <div>
                              <strong>{point.label}</strong>
                              <p className="meta">
                                {point.venueCount} venues | {point.showCount} shows | {point.liveCount} live
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>

                  <article className="home-gallery-panel">
                    <div className="home-section-header">
                      <div>
                        <div className="badge">Map</div>
                        <h2>Orbital activity globe</h2>
                      </div>
                    </div>
                    <ActivityMap points={activityPoints} scopes={activityScopes} />
                  </article>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'stats' ? (
            <div className="home-tab-stack">
              <section className="home-section-panel">
                <div className="home-section-header">
                  <div>
                    <div className="badge">Transparency</div>
                    <h2>Core platform counts and the rules shaping visibility.</h2>
                  </div>
                  <Link className="home-inline-link" href="/api/transparency">
                    JSON snapshot
                  </Link>
                </div>

                <div className="home-transparency-grid">
                  <div className="panel home-transparency-panel">
                    <div className="home-stat-grid">
                      {statCards.map((card) => (
                        <div className="home-stat-tile" key={card.label}>
                          <span>{card.label}</span>
                          <strong>{card.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="panel home-transparency-panel">
                    <div className="home-featured-head">
                      <div>
                        <div className="home-card-label">Heuristics ledger</div>
                        <h2>Visibility rules</h2>
                      </div>
                    </div>
                    <div className="home-heuristics-list">
                      {transparencySnapshot.heuristicsLedger.slice(0, 4).map((entry) => (
                        <article className="home-heuristic-card" key={entry.id}>
                          <strong>{entry.title}</strong>
                          <p>{entry.summary}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
