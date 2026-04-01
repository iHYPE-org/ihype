import { ProfileDirectoryBrowser, type DirectoryBrowserProfile } from '@/components/ProfileDirectoryBrowser';
import type { ReactNode } from 'react';
import { getTopMarketLabels, type DiscoverModuleId } from '@/lib/discover-modules';

type DirectoryProfile = DirectoryBrowserProfile;

export function ProfileDirectoryPage({
  badge,
  title,
  description,
  profiles,
  currentHref,
  activeModule,
  modulePanel,
  moduleSubheader
}: {
  badge: string;
  title: string;
  description: string;
  profiles: DirectoryProfile[];
  currentHref: string;
  activeModule: DiscoverModuleId;
  modulePanel?: ReactNode;
  moduleSubheader?: ReactNode;
}) {
  const topMarkets = getTopMarketLabels(profiles);

  return (
    <>
      {moduleSubheader}

      <main className="container section">
        <section className="directory-hero panel">
          <div className="directory-hero-copy">
            <div className="badge">{badge}</div>
            <h1 className="directory-title">{title}</h1>
            <p className="subtitle">{description}</p>
          </div>

          <div className="directory-hero-stats">
            <div className="directory-stat">
              <span>Profiles</span>
              <strong>{profiles.length}</strong>
            </div>
            <div className="directory-stat">
              <span>Focus</span>
              <strong>Find + hype</strong>
            </div>
            <div className="directory-stat">
              <span>Top markets</span>
              <strong>{topMarkets[0] ?? 'Building'}</strong>
            </div>
          </div>
        </section>

        {activeModule === 'discover' ? (
          <section className="section">
            <div className="panel discover-module-panel">
              <div className="discover-module-header">
                <div>
                  <div className="badge">Discover</div>
                  <h2>Browse {title.replace(/ discover$/i, '')}</h2>
                </div>
                <p className="meta">
                  Search the live directory, compare markets, and open the pages worth following next.
                </p>
              </div>

              {topMarkets.length ? (
                <div className="discover-market-strip" aria-label="Top markets">
                  {topMarkets.map((market) => (
                    <span className="discover-market-pill" key={market}>
                      {market}
                    </span>
                  ))}
                </div>
              ) : null}

              <ProfileDirectoryBrowser currentHref={currentHref} profiles={profiles} />
            </div>
          </section>
        ) : (
          modulePanel
        )}
      </main>
    </>
  );
}
