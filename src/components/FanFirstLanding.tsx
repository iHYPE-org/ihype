'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';

type ShowCard = {
  slug: string;
  title: string;
  startsAt: string;
  posterImage: string | null;
  venueName: string | null;
  city: string | null;
};

export function FanFirstLanding({
  tracks,
  shows,
  primaryCtaLabel,
  stats,
}: {
  tracks: MediaTrack[];
  shows: ShowCard[];
  primaryCtaLabel: string;
  stats: Array<{ value: string; label: string }>;
}) {
  const { currentTrack, isPlaying, playTrack, togglePlayback } = useMediaPlayer();
  const featured = tracks[0];

  const play = (track: MediaTrack) => {
    if (currentTrack?.id === track.id) togglePlayback();
    else playTrack(track, tracks);
  };

  return (
    <div className="fan-home">
      <section className="fan-home-hero">
        <div className="fan-home-hero-copy">
          <p className="fan-home-kicker">Free local music discovery</p>
          <h1>Support the scene. Be the signal. Your voice matters.</h1>
          <p>Discover artists, DJs, venues, songs, radio, and shows near you. HYPE what you love, and your voice helps turn local attention into real demand, real tickets, and real money for the scene.</p>
          <div className="fan-home-actions">
            <Link className="fan-home-primary" href="/register">{primaryCtaLabel}</Link>
            <Link className="fan-home-secondary" href="/listen">Start listening</Link>
          </div>
          <p className="fan-home-assurance">Everything is free · Real fans · Real local signal · Real-world impact</p>
        </div>

        {featured ? (
          <article className="fan-home-feature">
            <div className="fan-home-feature-art">
              {featured.artworkUrl ? (
                <Image src={featured.artworkUrl} alt="" fill sizes="(max-width: 800px) 100vw, 48vw" priority style={{ objectFit: 'cover' }} />
              ) : <span aria-hidden="true">iHYPE</span>}
            </div>
            <div className="fan-home-feature-overlay">
              <p>Start here</p>
              <h2>{featured.title}</h2>
              <span>{featured.artistName}</span>
              <button type="button" onClick={() => play(featured)}>
                {currentTrack?.id === featured.id && isPlaying ? 'Pause' : 'Play now'}
              </button>
            </div>
          </article>
        ) : (
          <div className="fan-home-feature fan-home-feature-empty">
            <span>Fresh independent music lands here.</span>
            <Link href="/register">Join the first listeners</Link>
          </div>
        )}
      </section>

      {stats.length > 0 && (
        <section className="fan-home-stats" aria-label="iHYPE community activity">
          {stats.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>
      )}

      <section className="fan-home-promise" aria-label="Why fans use iHYPE">
        <div><span>01</span><strong>Discover real local music</strong><p>Seed mixes your taste with surprise so overlooked music can reach real people.</p></div>
        <div><span>02</span><strong>Turn taste into signal</strong><p>Listening, radio, events, and referrals earn HYPE you give to what deserves attention.</p></div>
        <div><span>03</span><strong>Make attention pay</strong><p>Local demand drives bookings and ticket sales that pay artists, venues, and DJs.</p></div>
      </section>

      <section className="fan-home-cycle" aria-label="How HYPE strengthens local music">
        <span>Real discovery</span><i aria-hidden="true">→</i>
        <span>Genuine HYPE</span><i aria-hidden="true">→</i>
        <span>Visible local demand</span><i aria-hidden="true">→</i>
        <span>Bookings + ticket sales</span><i aria-hidden="true">→</i>
        <span>Paid, provable momentum</span>
      </section>

      <section className="fan-home-trust" aria-labelledby="fan-trust-title">
        <div className="fan-home-trust-lead">
          <p className="fan-home-kicker">Built by musicians who lived the problem</p>
          <h2 id="fan-trust-title">Your data is not the product. Music is the point.</h2>
          <p>We took a band to New York City and faced the old system ourselves: pay to play, work for “exposure,” find every fan and venue alone, then watch everyone take a piece. iHYPE connects discovery, real fan demand, booking, and fair ticket income so making music does not have to mean doing every other job alone.</p>
          <p>iHYPE is a 501(c)(3) scene-run philanthropic platform, operated by two brothers with AI helping route the work—not replace human accountability. Our goal is to steward it full-time when sustainable, keeping it private, future-proof, and locally focused forever.</p>
        </div>
        <ul>
          <li><strong>Never sold</strong><span>We never sell user data. Ever.</span></li>
          <li><strong>Music-only support</strong><span>Only radio-style ads connected to music.</span></li>
          <li><strong>Revenue stays on mission</strong><span>Ads fund infrastructure, transparent reasonable wages, and the scene—not owners or investors.</span></li>
          <li><strong>Scene-governed</strong><span>A three-person independent board provides oversight, and every fan gets a voice on feature changes through <Link href="/community">Community</Link>.</span></li>
        </ul>
      </section>

      {tracks.length > 0 && (
        <section className="fan-home-section" aria-labelledby="fan-tracks-title">
          <div className="fan-home-section-head">
            <div><p>Listen · earn HYPE</p><h2 id="fan-tracks-title">A few tracks to start with.</h2></div>
            <Link href="/listen">View all</Link>
          </div>
          <div className="fan-track-grid">
            {tracks.map((track, index) => (
              <button className="fan-track-card" type="button" onClick={() => play(track)} key={track.id}>
                <span className="fan-track-art">
                  {track.artworkUrl ? <Image src={track.artworkUrl} alt="" fill sizes="88px" style={{ objectFit: 'cover' }} /> : <span>{index + 1}</span>}
                </span>
                <span className="fan-track-copy"><strong>{track.title}</strong><small>{track.artistName}</small></span>
                <span className="fan-track-play" aria-hidden="true">{currentTrack?.id === track.id && isPlaying ? 'Ⅱ' : '▶'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {shows.length > 0 && (
        <section className="fan-home-section" aria-labelledby="fan-shows-title">
          <div className="fan-home-section-head">
            <div><p>Attend · earn HYPE</p><h2 id="fan-shows-title">Hear them in the room.</h2></div>
            <Link href="/shows">View all</Link>
          </div>
          <div className="fan-show-grid">
            {shows.map((show) => {
              const date = new Date(show.startsAt);
              return (
                <Link className="fan-show-card" href={`/shows/${show.slug}`} key={show.slug}>
                  <span className="fan-show-art">
                    {show.posterImage ? <Image src={show.posterImage} alt="" fill sizes="(max-width: 700px) 75vw, 280px" style={{ objectFit: 'cover' }} /> : null}
                    <span className="fan-show-date"><strong>{date.toLocaleDateString('en-US', { month: 'short' })}</strong>{date.getDate()}</span>
                  </span>
                  <strong>{show.title}</strong>
                  <small>{[show.venueName, show.city].filter(Boolean).join(' · ')}</small>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="fan-home-close">
        <div>
          <p className="fan-home-kicker">Local listening can build real careers—without selling out</p>
          <h2>Help great music earn the crowd, income, and proof it deserves.</h2>
          <p className="fan-home-close-copy">Strong local HYPE and ticket history give artists credible stats they can take to labels, bookers, and bigger stages.</p>
        </div>
        <Link className="fan-home-primary" href="/register">{primaryCtaLabel}</Link>
      </section>
    </div>
  );
}
