import { ShowCard } from '@/components/ShowCard';
import { getShowsDirectoryData } from '@/lib/public-data';
import { sortShowsForFeed } from '@/lib/integrity';
import { detectRequestLocation } from '@/lib/request-location';
import { isLocalMatch, isRegionalMatch } from '@/lib/discover-feed';
import type { ReasonChip } from '@/lib/integrity';

export const dynamic = 'force-dynamic';

export default async function ShowsIndexPage() {
  const [rawShows, viewerLocation] = await Promise.all([
    getShowsDirectoryData(),
    detectRequestLocation()
  ]);

  const shows = sortShowsForFeed(rawShows).map((show) => ({
    ...show,
    startsAt: show.startsAt instanceof Date ? show.startsAt : new Date(show.startsAt)
  }));

  const now = new Date();
  const liveShows = shows.filter((show) => show.status === 'LIVE');
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
          <h1 className="directory-title">Live, upcoming, and recently archived broadcasts in one place.</h1>
          <p className="subtitle">
            Shows are the front door to the product. Live broadcasts surface first, then scheduled rooms close behind,
            with recent archives still visible long enough to help discovery.
          </p>
        </div>

        <div className="directory-hero-stats">
          <div className="directory-stat">
            <span>Live</span>
            <strong>{liveShows.length}</strong>
          </div>
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

      {liveShows.length > 0 && (
        <div className="panel" style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.3)', padding: '1rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ff3c3c', boxShadow: '0 0 8px #ff3c3c', flexShrink: 0 }} />
          <span><strong>{liveShows.length} show{liveShows.length !== 1 ? 's' : ''} live right now</strong> — scroll down or <a href="#live-now">jump to live</a></span>
        </div>
      )}

      <section className="section" id="live-now">
        <div className="directory-section-head">
          <h2>
            <span className="section-status-chip section-status-chip-live">● LIVE</span>
            {liveShows.length > 0 && <span style={{ fontWeight: 400, fontSize: '1rem', color: 'var(--muted)' }}>{liveShows.length} broadcast{liveShows.length !== 1 ? 's' : ''}</span>}
          </h2>
        </div>
        <div className="grid grid-2">
          {liveShows.length ? liveShows.map((show) => <ShowCard key={show.id} show={show} reasonChips={locationChips(show)} />) : (
            <div className="empty">
              <span className="empty-icon">📡</span>
              <span className="empty-title">Nothing live right now</span>
              <p>Check back soon — Chicago artists stream every day.</p>
            </div>
          )}
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
            <div className="empty">
              <span className="empty-icon">🗓️</span>
              <span className="empty-title">No upcoming shows scheduled</span>
              <p>Artists add new dates regularly — check back or <a href="/artists">browse artists</a>.</p>
            </div>
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
            <div className="empty">
              <span className="empty-icon">📼</span>
              <span className="empty-title">No recent archives yet</span>
              <p>Past broadcasts will appear here once the platform launches.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
