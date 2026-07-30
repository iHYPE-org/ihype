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
  stats: string[];
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
          <p className="fan-home-kicker">Independent music · near you</p>
          <h1>Find the track you&apos;ll tell everyone about.</h1>
          <p>Listen locally, HYPE what hits, and see the artists live before the rest of the world catches up.</p>
          <div className="fan-home-actions">
            <Link className="fan-home-primary" href="/register">{primaryCtaLabel}</Link>
            <Link className="fan-home-secondary" href="/shows">See live shows</Link>
          </div>
          {stats.length > 0 && <p className="fan-home-stats">{stats.join(' · ')}</p>}
        </div>

        {featured ? (
          <article className="fan-home-feature">
            <div className="fan-home-feature-art">
              {featured.artworkUrl ? (
                <Image src={featured.artworkUrl} alt="" fill sizes="(max-width: 800px) 100vw, 48vw" priority style={{ objectFit: 'cover' }} />
              ) : <span aria-hidden="true">iHYPE</span>}
            </div>
            <div className="fan-home-feature-overlay">
              <p>Featured right now</p>
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

      {tracks.length > 0 && (
        <section className="fan-home-section" aria-labelledby="fan-tracks-title">
          <div className="fan-home-section-head">
            <div><p>For you</p><h2 id="fan-tracks-title">Press play somewhere new.</h2></div>
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
            <div><p>Live near you</p><h2 id="fan-shows-title">Turn a listen into a night out.</h2></div>
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
        <p>Artists, DJs, venues, and promoters have their own tools—fans get the front door.</p>
        <Link href="/join">Build your place in the scene</Link>
      </section>
    </div>
  );
}
