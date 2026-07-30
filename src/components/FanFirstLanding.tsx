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
          <h1>Discover music. Earn HYPE. Lift up your scene.</h1>
          <p>Listen to songs and radio, attend events, and bring friends into the scene. You earn HYPE as you go—then use it to support everything you love.</p>
          <div className="fan-home-actions">
            <Link className="fan-home-primary" href="/register">{primaryCtaLabel}</Link>
            <Link className="fan-home-secondary" href="/listen">Start listening</Link>
          </div>
          <p className="fan-home-assurance">Everything is free · Supported only by music-related audio ads</p>
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
        <div><span>01</span><strong>Free means free</strong><p>No subscription or ticket fees. Music-only audio ads keep iHYPE open.</p></div>
        <div><span>02</span><strong>Earn and use HYPE</strong><p>Listening, radio, events, and referrals earn the signal you give back.</p></div>
        <div><span>03</span><strong>Plant a Seed</strong><p>Swipe left to skip or right to grow a discovery playlist: 75% your taste, 25% pure surprise.</p></div>
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
          <p className="fan-home-kicker">Listen · attend · invite · HYPE · discover</p>
          <h2>Your local music life should count for something.</h2>
        </div>
        <Link className="fan-home-primary" href="/register">{primaryCtaLabel}</Link>
      </section>
    </div>
  );
}
