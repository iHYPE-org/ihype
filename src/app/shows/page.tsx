import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
export const metadata: Metadata = {
  title: 'Radio',
  description: 'Upcoming and archived independent music shows. Browse by city, artist, or genre on iHYPE.',
  openGraph: { title: 'Radio · iHYPE', description: 'Upcoming and archived independent music shows.' },
  twitter: { card: 'summary_large_image', title: 'Radio · iHYPE', description: 'Upcoming and archived independent music shows.' },
};
import { ShowCard } from '@/components/ShowCard';
import { getShowsDirectoryData } from '@/lib/public-data';
import { sortShowsForFeed } from '@/lib/integrity';
import { detectRequestLocation } from '@/lib/request-location';
import { isLocalMatch, isRegionalMatch } from '@/lib/discover-feed';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { ReasonChip } from '@/lib/integrity';

export const dynamic = 'force-dynamic';

export default async function ShowsIndexPage({
  searchParams
}: {
  searchParams?: Promise<{ near?: string; genre?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const genreFilter = resolvedParams.genre?.trim() || null;
  const [rawShows, viewerLocation, session] = await Promise.all([
    getShowsDirectoryData(),
    detectRequestLocation(),
    auth().catch(() => null)
  ]);

  // Determine user's home city (preferred over IP-derived viewer location)
  let userCity: string | null = null;
  if (session?.user?.id) {
    const userProfile = await db.profile.findFirst({
      where: { ownerId: session.user.id },
      select: { city: true },
      orderBy: { createdAt: 'asc' }
    }).catch(() => null);
    userCity = userProfile?.city ?? null;
  }
  const nearCity = userCity ?? viewerLocation?.city ?? null;
  const nearModeRequested = resolvedParams.near;
  // Default to near mode when we know the city; user can switch with ?near=0
  const nearMode = nearCity ? nearModeRequested !== '0' : false;

  const allShows = sortShowsForFeed(rawShows).map((show) => ({
    ...show,
    startsAt: show.startsAt instanceof Date ? show.startsAt : new Date(show.startsAt)
  }));
  const locationFiltered = nearMode && nearCity
    ? allShows.filter((s) => {
        const showCity = s.venueProfile?.city;
        return showCity ? showCity.toLowerCase() === nearCity.toLowerCase() : false;
      })
    : allShows;

  const shows = genreFilter
    ? locationFiltered.filter((s) => s.headlinerProfile?.genres?.some((g) => g.toLowerCase() === genreFilter.toLowerCase()))
    : locationFiltered;

  // Collect all genres for filter chips
  const allGenres = [...new Set(allShows.flatMap((s) => s.headlinerProfile?.genres ?? []))].sort().slice(0, 16);

  const buildShowsUrl = (genre: string | null, near: string | null) => {
    const p = new URLSearchParams();
    if (near) p.set('near', near);
    if (genre) p.set('genre', genre);
    const q = p.toString();
    return `/shows${q ? `?${q}` : ''}`;
  };

  const now = new Date();
  const upcomingShows = shows.filter((show) => show.status !== 'LIVE' && show.startsAt >= now);
  const recentShows = shows.filter((show) => show.status === 'ENDED' || (show.startsAt < now && show.status !== 'LIVE')).slice(0, 6);

  function locationChips(show: typeof shows[0]): ReasonChip[] {
    const chips: ReasonChip[] = [];
    const venue = show.venueProfile;
    if (!venue || !viewerLocation) return chips;
    if (isLocalMatch(venue, viewerLocation)) {
      chips.push({ icon: '📍', label: 'Near you', detail: `Venue is in ${venue.city ?? 'your city'}.` });
    } else if (isRegionalMatch(venue, viewerLocation)) {
      chips.push({ icon: '🗺️', label: 'Your region', detail: `Venue is in your region.` });
    }
    return chips;
  }

  return (
    <main className="container section">
      <section className="directory-hero panel">
        <div className="directory-hero-copy">
          <div className="badge">SHOWS</div>
          <h1 className="directory-title">Upcoming and recently archived independent music shows.</h1>
          <p className="subtitle">
            Browse scheduled shows and past archives by city, artist, or genre.
          </p>
          <div className="cta-row">
            <Link className="button small secondary" href="/register?role=ARTIST">
              Add artist dates
            </Link>
            <Link className="button small secondary" href="/register?role=VENUE">
              List venue shows
            </Link>
            <Link className="button small secondary" href="/shows/map">
              Map view
            </Link>
          </div>
          {nearCity ? (
            <div className="cta-row" style={{ marginTop: '0.75rem' }} role="group" aria-label="Location filter">
              <Link
                className={nearMode ? 'button small' : 'button small secondary'}
                href={buildShowsUrl(genreFilter, '1')}
                aria-pressed={nearMode}
              >
                📍 Near me ({nearCity})
              </Link>
              <Link
                className={!nearMode ? 'button small' : 'button small secondary'}
                href={buildShowsUrl(genreFilter, '0')}
                aria-pressed={!nearMode}
              >
                All shows
              </Link>
            </div>
          ) : null}
          {allGenres.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: '0.75rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.3)', flexShrink: 0 }}>Genre</span>
              {genreFilter && (
                <Link href={buildShowsUrl(null, nearMode ? '1' : nearCity ? null : null)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: '#ff3e9a', color: '#fff', cursor: 'pointer' }}>{genreFilter} ×</span>
                </Link>
              )}
              {allGenres.filter(g => g !== genreFilter).map(g => (
                <Link key={g} href={buildShowsUrl(g, nearMode ? '1' : nearCity ? null : null)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.06)', color: 'rgba(240,235,229,.6)', cursor: 'pointer', border: '1px solid rgba(255,255,255,.08)' }}>{g}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="directory-hero-stats">
          <div className="directory-stat">
            <span>Upcoming</span>
            <strong>{upcomingShows.length}</strong>
          </div>
          <div className="directory-stat">
            <span>Recent archives</span>
            <strong>{recentShows.length}</strong>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="directory-section-head">
          <h2>
            <span className="section-status-chip section-status-chip-upcoming">UPCOMING</span>
            {upcomingShows.length > 0 && <span style={{ fontWeight: 400, fontSize: '1rem', color: 'var(--muted)' }}>{upcomingShows.length} show{upcomingShows.length !== 1 ? 's' : ''}</span>}
          </h2>
        </div>
        <div className="grid grid-2">
          {upcomingShows.length ? upcomingShows.map((show) => <ShowCard key={show.id} show={show} reasonChips={locationChips(show)} />) : (
            <EmptyState
              icon="🗓️"
              title="No shows listed yet — creating one takes 2 minutes."
              ctaLabel="Add your first show"
              ctaHref={session ? '/home' : '/register'}
            />
          )}
        </div>
      </section>

      <section className="section">
        <div className="directory-section-head">
          <h2>
            <span className="section-status-chip section-status-chip-past">RECENT ARCHIVES</span>
            {recentShows.length > 0 && <span style={{ fontWeight: 400, fontSize: '1rem', color: 'var(--muted)' }}>{recentShows.length} show{recentShows.length !== 1 ? 's' : ''}</span>}
          </h2>
        </div>
        <div className="grid grid-2">
          {recentShows.length ? recentShows.map((show) => <ShowCard key={show.id} show={show} />) : (
            <EmptyState
              icon="📼"
              title="No archived shows yet."
              body="Past broadcasts appear here once an artist or venue publishes a recap."
              ctaLabel={session ? 'Go to workbench' : 'Create an account'}
              ctaHref={session ? '/home' : '/register'}
            />
          )}
        </div>
      </section>
    </main>
  );
}
