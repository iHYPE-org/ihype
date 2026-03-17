import { ProfileDirectoryBrowser, type DirectoryBrowserProfile } from '@/components/ProfileDirectoryBrowser';
import { DiscoverLaneMap } from '@/components/PageConnectionMap';

type DirectoryProfile = DirectoryBrowserProfile;

function getTopMarkets(profiles: DirectoryProfile[]) {
  const counts = new Map<string, number>();

  for (const profile of profiles) {
    const label = [profile.city, profile.stateRegion ?? profile.country].filter(Boolean).join(', ');
    if (!label) {
      continue;
    }

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label, count]) => `${label} (${count})`);
}

export function ProfileDirectoryPage({
  badge,
  title,
  description,
  profiles,
  currentHref,
  modules
}: {
  badge: string;
  title: string;
  description: string;
  profiles: DirectoryProfile[];
  currentHref: string;
  modules?: string[];
}) {
  const topMarkets = getTopMarkets(profiles);

  return (
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

      {modules?.length ? <DiscoverLaneMap badge={badge} modules={modules} title={title} /> : null}

      {topMarkets.length ? (
        <section className="section directory-market-strip" aria-label="Top markets">
          {topMarkets.map((market) => (
            <span className="directory-market-pill" key={market}>
              {market}
            </span>
          ))}
        </section>
      ) : null}

      <section className="section">
        <ProfileDirectoryBrowser currentHref={currentHref} profiles={profiles} />
      </section>
    </main>
  );
}
