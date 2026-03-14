import Link from 'next/link';
import { ProfileCard } from '@/components/ProfileCard';
import { getHomePageData } from '@/lib/public-data';

export const revalidate = 60;

function getProfilesByType<T extends 'ARTIST' | 'DJ' | 'VENUE'>(
  profiles: Awaited<ReturnType<typeof getHomePageData>>['profiles'],
  type: T
) {
  return profiles
    .filter((profile) => profile.type === type)
    .sort((left, right) => right.hypeCount - left.hypeCount)
    .slice(0, 6);
}

export default async function HomePage() {
  const { profiles, transparencySnapshot } = await getHomePageData();
  const featuredArtists = getProfilesByType(profiles, 'ARTIST');
  const featuredPromoters = getProfilesByType(profiles, 'DJ');
  const featuredVenues = getProfilesByType(profiles, 'VENUE');

  const directoryCards = [
    {
      href: '/artists',
      title: 'Artists',
      count: transparencySnapshot.counters.totalArtists,
      copy: 'Search artists, open their pages fast, and hype the acts you want to push forward.'
    },
    {
      href: '/promoters',
      title: 'Promoters',
      count: transparencySnapshot.counters.totalPromoters,
      copy: 'Find the promoters shaping nights in your scene and hype the ones building momentum.'
    },
    {
      href: '/venues',
      title: 'Venues',
      count: transparencySnapshot.counters.totalVenues,
      copy: 'Browse venues by city and signal, then hype the rooms you want to see stay active.'
    }
  ];

  return (
    <main className="container section">
      <section className="panel home-discovery-hero">
        <div className="home-discovery-hero-copy">
          <div className="badge">Fan-first discovery</div>
          <h1 className="home-discovery-title">Find artists, promoters, and venues worth hyping.</h1>
          <p className="subtitle">
            iHYPE is now centered on one simple loop: browse the network, open the pages that feel real, and
            hype the people and places pushing the scene forward.
          </p>
          <div className="cta-row">
            <Link className="button" href="/artists">
              Browse artists
            </Link>
            <Link className="button secondary" href="/promoters">
              Browse promoters
            </Link>
            <Link className="button secondary" href="/venues">
              Browse venues
            </Link>
          </div>
        </div>

        <div className="home-discovery-stats">
          <article className="home-discovery-stat">
            <span>Artists</span>
            <strong>{transparencySnapshot.counters.totalArtists}</strong>
          </article>
          <article className="home-discovery-stat">
            <span>Promoters</span>
            <strong>{transparencySnapshot.counters.totalPromoters}</strong>
          </article>
          <article className="home-discovery-stat">
            <span>Venues</span>
            <strong>{transparencySnapshot.counters.totalVenues}</strong>
          </article>
          <article className="home-discovery-stat">
            <span>Total profile hype</span>
            <strong>{profiles.reduce((sum, profile) => sum + profile.hypeCount, 0)}</strong>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="home-simple-directory-grid">
          {directoryCards.map((card) => (
            <Link className="home-simple-directory-card panel" href={card.href} key={card.href}>
              <span className="badge">{card.title}</span>
              <strong>{card.count} to explore</strong>
              <p>{card.copy}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="directory-section-head">
          <div>
            <div className="badge">Artists</div>
            <h2>Top artist pages right now</h2>
          </div>
          <Link className="home-inline-link" href="/artists">
            View all artists
          </Link>
        </div>
        <div className="grid grid-3">
          {featuredArtists.length ? (
            featuredArtists.map((profile) => <ProfileCard key={profile.id} profile={profile} />)
          ) : (
            <div className="empty">No artist pages are live yet.</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="directory-section-head">
          <div>
            <div className="badge">Promoters</div>
            <h2>Promoters building traction</h2>
          </div>
          <Link className="home-inline-link" href="/promoters">
            View all promoters
          </Link>
        </div>
        <div className="grid grid-3">
          {featuredPromoters.length ? (
            featuredPromoters.map((profile) => <ProfileCard key={profile.id} profile={profile} />)
          ) : (
            <div className="empty">No promoter pages are live yet.</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="directory-section-head">
          <div>
            <div className="badge">Venues</div>
            <h2>Venue pages with signal</h2>
          </div>
          <Link className="home-inline-link" href="/venues">
            View all venues
          </Link>
        </div>
        <div className="grid grid-3">
          {featuredVenues.length ? (
            featuredVenues.map((profile) => <ProfileCard key={profile.id} profile={profile} />)
          ) : (
            <div className="empty">No venue pages are live yet.</div>
          )}
        </div>
      </section>
    </main>
  );
}
