import Link from 'next/link';
import { ActivityMap } from '@/components/ActivityMap';
import { ProfileCard } from '@/components/ProfileCard';
import { ShowCard } from '@/components/ShowCard';
import { db, withDbRetry } from '@/lib/db';
import { buildActivityMapPoints, buildActivityScopeCards } from '@/lib/activity-stats';
import { FEED_HEURISTICS_VERSION, sortShowsForFeed } from '@/lib/integrity';
import { getTransparencySnapshot } from '@/lib/transparency';

export const dynamic = 'force-dynamic';

const homeTabs = ['overview', 'geo', 'stats', 'feed', 'profiles'] as const;

type HomeTab = (typeof homeTabs)[number];

function getActiveHomeTab(tab: string | string[] | undefined): HomeTab {
  if (typeof tab === 'string' && homeTabs.includes(tab as HomeTab)) {
    return tab as HomeTab;
  }

  return 'overview';
}

function getHomeTabLabel(tab: HomeTab) {
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab = getActiveHomeTab(resolvedSearchParams.tab);

  const [[allShows, allProfiles, allRequests], transparencySnapshot] = await Promise.all([
    withDbRetry(() =>
      db.$transaction([
        db.show.findMany({
          where: { status: { not: 'CANCELED' } },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            status: true,
            startsAt: true,
            hypeCount: true,
            isTicketed: true,
            ticketPriceCents: true,
            ticketCapacity: true,
            ticketsSoldCount: true,
            tags: true,
            venueProfile: {
              select: {
                name: true,
                city: true,
                stateRegion: true,
                country: true,
                postalCode: true,
                latitude: true,
                longitude: true
              }
            },
            headlinerProfile: {
              select: {
                name: true,
                city: true,
                country: true
              }
            }
          }
        }),
        db.profile.findMany({
          orderBy: [{ verified: 'desc' }, { name: 'asc' }],
          select: {
            id: true,
            type: true,
            slug: true,
            hexId: true,
            name: true,
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
        db.venueConnectionRequest.findMany({
          select: {
            venueProfile: {
              select: {
                city: true,
                country: true
              }
            },
            artistProfile: {
              select: {
                city: true,
                country: true
              }
            }
          }
        })
      ])
    ),
    getTransparencySnapshot()
  ]);

  const profiles = allProfiles.slice(0, 6);
  const shows = sortShowsForFeed(allShows).slice(0, 6);
  const featured = shows[0] ?? null;
  const activityScopes = buildActivityScopeCards({
    profiles: allProfiles,
    shows: allShows,
    requests: allRequests
  });
  const activityPoints = buildActivityMapPoints({
    profiles: allProfiles,
    shows: allShows
  });
  const hotspots = activityPoints.slice(0, 4);

  const signalStripItems = [
    { label: 'Live now', value: `${transparencySnapshot.counters.liveShows} shows on air` },
    { label: 'Listeners', value: `${transparencySnapshot.counters.listenersLiveNow} active right now` },
    { label: 'Tickets', value: `${transparencySnapshot.counters.totalTicketsSold} sold network-wide` },
    { label: 'Heuristics', value: `v${FEED_HEURISTICS_VERSION}` }
  ];

  const statCards = [
    { label: 'Total listeners', value: transparencySnapshot.counters.totalListeners },
    { label: 'Total venues', value: transparencySnapshot.counters.totalVenues },
    { label: 'Total artists', value: transparencySnapshot.counters.totalArtists },
    { label: 'Total promoters', value: transparencySnapshot.counters.totalPromoters },
    { label: 'Events held', value: transparencySnapshot.counters.totalEventsHeld },
    { label: 'Tickets sold', value: transparencySnapshot.counters.totalTicketsSold },
    { label: 'Songs uploaded', value: transparencySnapshot.counters.totalSongsUploaded },
    { label: 'Venue requests', value: transparencySnapshot.counters.totalRequests }
  ];

  const strategyCards = [
    {
      title: 'Chicago Pilot',
      copy:
        'Built around Chicago rooms first, with a Midwest expansion path and global visibility already baked into the data model.'
    },
    {
      title: 'Trust Stack',
      copy:
        'Playback verification, hype gating, session security, and visible heuristics keep the product legible instead of mysterious.'
    },
    {
      title: 'Zero Commission',
      copy:
        'Ticketing math is explicit: venue and artist split the take, while the promoter pool stays fixed at 5% per ticket sold.'
    }
  ];

  return (
    <main className="container home-shell">
      <section className="home-submenu-shell">
        <div className="home-submenu-head">
          <div>
            <div className="badge">Main page menu</div>
            <h1 className="home-submenu-title">Everything on the front page now lives inside one scrollable tab deck.</h1>
          </div>
          <p className="kicker home-submenu-kicker">
            Switch tabs to move between the overview, geo intelligence, transparency stats, live feed, and network
            pages without leaving the same main-page module.
          </p>
        </div>

        <nav className="home-submenu-tabs" aria-label="Homepage sections">
          {homeTabs.map((tab) => (
            <Link
              key={tab}
              className={tab === activeTab ? 'home-submenu-tab active' : 'home-submenu-tab'}
              href={tab === 'overview' ? '/' : `/?tab=${tab}`}
            >
              {getHomeTabLabel(tab)}
            </Link>
          ))}
        </nav>

        <div className="home-submenu-status">
          <span className="home-eyebrow">Chicago-born live discovery with transparent momentum.</span>
          <span className="home-topline-meta">{getHomeTabLabel(activeTab)} tab active</span>
          <span className="home-topline-meta">Feed heuristics v{FEED_HEURISTICS_VERSION}</span>
        </div>

        <div className="home-submenu-body">
          {activeTab === 'overview' ? (
            <div className="home-tab-stack">
              <section className="home-pill-section">
                <div className="home-pill-hero">
                  <div className="home-pill-copy">
                    <div className="badge home-badge-ink">Live music signal</div>
                    <h2 className="home-pill-title">A cleaner front page for rooms, artists, venues, and the cities moving first.</h2>
                    <p className="home-pill-subtitle">
                      The homepage now follows your sketch: one oversized capsule, one thin signal bar, and a tabbed
                      lower deck where the network data, ticketing, and transparency machinery can all live in one
                      controlled space.
                    </p>
                    <div className="cta-row">
                      <Link href={featured ? `/shows/${featured.slug}` : '/artists'} className="button">
                        {featured ? 'Watch featured signal' : 'Explore artists'}
                      </Link>
                      <Link href="/?tab=geo" className="button secondary">
                        Open geo tab
                      </Link>
                      <Link href="/integrity" className="button secondary">
                        Read heuristics
                      </Link>
                    </div>
                  </div>

                  <aside className="home-pill-feature">
                    <div className="home-feature-chip">{featured?.status ?? 'Network live'}</div>
                    <h2>{featured?.title ?? 'Featured signal loading'}</h2>
                    <p className="meta">
                      {featured?.venueProfile?.name ?? 'Network venue'}
                      {featured?.headlinerProfile?.name ? ` | ${featured.headlinerProfile.name}` : ''}
                    </p>
                    <p>
                      {featured?.description ??
                        'Live and upcoming signals are still the core of the experience, just arranged in a sharper shell.'}
                    </p>
                    <div className="home-pill-metrics">
                      <div className="home-metric-pill">
                        <strong>{shows.length}</strong>
                        Featured shows
                      </div>
                      <div className="home-metric-pill">
                        <strong>{profiles.length}</strong>
                        Active profiles
                      </div>
                      <div className="home-metric-pill">
                        <strong>{transparencySnapshot.counters.liveShows}</strong>
                        Live broadcasts
                      </div>
                    </div>
                  </aside>
                </div>

                <div className="home-signal-strip">
                  {signalStripItems.map((item) => (
                    <div className="home-signal-item" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="home-lens-grid">
                <article className="home-wire-card home-geo-card">
                  <div className="home-card-header">
                    <div>
                      <div className="home-card-label">Geo</div>
                      <h2>Where the rooms are heating up.</h2>
                    </div>
                    <Link href="/?tab=geo" className="home-inline-link">
                      Open geo tab
                    </Link>
                  </div>

                  <div className="home-scope-stack">
                    {activityScopes.map((scope) => (
                      <div className="home-scope-row" key={scope.key}>
                        <div>
                          <strong>{scope.label}</strong>
                          <span>{scope.footprint}</span>
                        </div>
                        <div className="home-scope-values">
                          <span>{scope.profiles} profiles</span>
                          <span>{scope.activeShows} live + upcoming</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="home-hotspot-block">
                    <h3>Top hotspots</h3>
                    <div className="home-hotspot-list">
                      {hotspots.map((point) => (
                        <div className="home-hotspot" key={point.id}>
                          <div className="home-hotspot-code">{point.postalCode}</div>
                          <div>
                            <strong>
                              {point.city}
                              {point.stateRegion ? `, ${point.stateRegion}` : ''}
                            </strong>
                            <p className="meta">{point.venueCount} venues | {point.showCount} shows | {point.liveCount} live</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="home-wire-card home-stats-card">
                  <div className="home-card-header">
                    <div>
                      <div className="home-card-label">Stats</div>
                      <h2>Transparent network counts, surfaced up front.</h2>
                    </div>
                    <Link href="/?tab=stats" className="home-inline-link">
                      Open stats tab
                    </Link>
                  </div>

                  <div className="home-stat-grid">
                    {statCards.slice(0, 4).map((card) => (
                      <div className="home-stat-tile" key={card.label}>
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="home-strategy-grid">
                    {strategyCards.map((card) => (
                      <article className="home-strategy-tile" key={card.title}>
                        <h3>{card.title}</h3>
                        <p>{card.copy}</p>
                      </article>
                    ))}
                  </div>
                </article>
              </section>
            </div>
          ) : null}

          {activeTab === 'geo' ? (
            <div className="home-tab-stack">
              <section className="home-section-panel">
                <div className="home-section-header">
                  <div>
                    <div className="badge">Geo intelligence</div>
                    <h2>Regional, national, and global activity in one view.</h2>
                  </div>
                  <p className="kicker">
                    Postal clusters, venue density, and live-show presence all stay in one scrollable geo tab for quick
                    scanning.
                  </p>
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
                            <span>{scope.totalHype} total hype</span>
                            <span>{scope.requests} requests</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="home-hotspot-block">
                      <h3>Postal hotspots</h3>
                      <div className="home-hotspot-list">
                        {hotspots.map((point) => (
                          <div className="home-hotspot" key={point.id}>
                            <div className="home-hotspot-code">{point.postalCode}</div>
                            <div>
                              <strong>{point.label}</strong>
                              <p className="meta">
                                {point.profileCount} profiles | {point.venueCount} venues | {point.upcomingCount} active
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
                        <div className="badge">Map panel</div>
                        <h2>Listeners can see where the rooms and shows are.</h2>
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
                    <div className="badge">Transparency stats</div>
                    <h2>Core network counts and the strategy behind them.</h2>
                  </div>
                  <Link href="/api/transparency" className="home-inline-link">
                    JSON snapshot
                  </Link>
                </div>

                <div className="home-wire-card home-stats-card">
                  <div className="home-stat-grid">
                    {statCards.map((card) => (
                      <div className="home-stat-tile" key={card.label}>
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="home-strategy-grid">
                    {strategyCards.map((card) => (
                      <article className="home-strategy-tile" key={card.title}>
                        <h3>{card.title}</h3>
                        <p>{card.copy}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'feed' ? (
            <div className="home-tab-stack">
              <section className="home-gallery-panel">
                <div className="home-section-header">
                  <div>
                    <div className="badge">Streaming feed</div>
                    <h2>Live and upcoming signals</h2>
                  </div>
                  <p className="kicker">Still the core feed, now tucked into its own sub-menu lane.</p>
                </div>
                <div className="grid grid-2">
                  {shows.map((show) => (
                    <ShowCard key={show.id} show={show} />
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'profiles' ? (
            <div className="home-tab-stack">
              <section className="home-gallery-panel">
                <div className="home-section-header">
                  <div>
                    <div className="badge">Network pages</div>
                    <h2>Artists, promoters, venues, and listeners</h2>
                  </div>
                  <p className="kicker">The profile layer is now one tab away instead of living in a long page stack.</p>
                </div>
                <div className="grid grid-3">
                  {profiles.map((profile) => (
                    <ProfileCard key={profile.id} profile={profile} />
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
