import Link from 'next/link';

interface Show {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
}

interface SimilarFan {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  genres: string[];
  hypeCount: number;
  avatarImage: string | null;
  score: number;
}

interface FanAboutProps {
  profile: {
    aboutContent: string | null;
    bio: string | null;
  };
  fanLevel: number;
  hypePoints: number;
  fullSongListenCount: number;
  fullShowListenCount: number;
  pastEventCount: number;
  upcomingEventCount: number;
  topFiveItems: string[];
  compactUpcomingShows: Show[];
  compactPreviousShows: Show[];
  scoredFans: SimilarFan[];
  fanGenres: string[];
}

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
}

export function FanAbout({
  profile,
  fanLevel,
  hypePoints,
  fullSongListenCount,
  fullShowListenCount,
  pastEventCount,
  upcomingEventCount,
  topFiveItems,
  compactUpcomingShows,
  compactPreviousShows,
  scoredFans,
  fanGenres
}: FanAboutProps) {
  return (
    <div className="fan-page-about-grid">
      <section className="fan-page-about-card fan-page-about-copy-card">
        <div className="fan-page-section-head">
          <h2>About</h2>
          <span className="meta">A compact view of this fan profile.</span>
        </div>
        <div className="artist-copy fan-page-about-copy">
          {profile.aboutContent || profile.bio || 'This fan has not filled out the About section yet.'}
        </div>
      </section>

      <section className="fan-page-about-card fan-page-about-stats-card">
        <div className="fan-page-section-head">
          <h3>Stats</h3>
          <span className="meta">Live totals</span>
        </div>
        <div className="fan-page-stat-grid">
          <div className="fan-page-stat-pill"><span>Fan level</span><strong>{fanLevel}</strong></div>
          <div className="fan-page-stat-pill"><span>Hype points</span><strong>{hypePoints}</strong></div>
          <div className="fan-page-stat-pill"><span>Songs</span><strong>{fullSongListenCount}</strong></div>
          <div className="fan-page-stat-pill"><span>Shows</span><strong>{fullShowListenCount}</strong></div>
          <div className="fan-page-stat-pill"><span>Past events</span><strong>{pastEventCount}</strong></div>
          <div className="fan-page-stat-pill"><span>Upcoming</span><strong>{upcomingEventCount}</strong></div>
        </div>
      </section>

      <section className="fan-page-about-card fan-page-about-topfive-card">
        <div className="fan-page-section-head">
          <h3>Top 5</h3>
          <span className="meta">Current favorites</span>
        </div>
        {topFiveItems.length ? (
          <ol className="fan-page-topfive-list">
            {topFiveItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : (
          <div className="empty fan-page-empty-compact">No top 5 list yet.</div>
        )}
      </section>

      {scoredFans.length > 0 && (
        <section className="fan-page-about-card fan-page-about-similar-card">
          <div className="fan-page-section-head">
            <h3>Fans like you</h3>
            <span className="meta">Overlapping taste</span>
          </div>
          <div className="fan-similar-list">
            {scoredFans.map((fan) => {
              const sharedGenres = fan.genres.filter((g) =>
                fanGenres.some((fg) => fg.toLowerCase() === g.toLowerCase())
              ).slice(0, 3);
              return (
                <Link className="fan-similar-row" href={`/fans/${fan.slug}`} key={fan.id}>
                  <div className="fan-similar-avatar">
                    {fan.avatarImage
                      ? <img src={fan.avatarImage} alt={fan.name} loading="lazy" />
                      : <span>{fan.name.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="fan-similar-info">
                    <strong>{fan.name}</strong>
                    <span className="meta">{[fan.city, fan.country].filter(Boolean).join(', ')}</span>
                    {sharedGenres.length > 0 && (
                      <div className="fan-similar-genres">
                        {sharedGenres.map((g) => (
                          <span className="tag" key={g}>{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="fan-page-about-card fan-page-about-events-card">
        <div className="fan-page-section-head">
          <h3>Events</h3>
          <span className="meta">Next and recent shows</span>
        </div>
        <div className="fan-page-event-columns">
          <div className="fan-page-event-column">
            <strong>Upcoming</strong>
            {compactUpcomingShows.length ? (
              <div className="fan-page-event-list">
                {compactUpcomingShows.map((show) => (
                  <Link className="fan-page-event-row" href={`/shows/${show.slug}`} key={show.id}>
                    <span>{show.title}</span>
                    <small>{formatShowDate(show.startsAt)}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty fan-page-empty-compact">No upcoming saved shows yet.</div>
            )}
          </div>

          <div className="fan-page-event-column">
            <strong>Previous</strong>
            {compactPreviousShows.length ? (
              <div className="fan-page-event-list">
                {compactPreviousShows.map((show) => (
                  <Link className="fan-page-event-row" href={`/shows/${show.slug}`} key={show.id}>
                    <span>{show.title}</span>
                    <small>{formatShowDate(show.startsAt)}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty fan-page-empty-compact">No previous saved shows yet.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
