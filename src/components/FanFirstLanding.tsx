import Image from 'next/image';
import Link from 'next/link';
import type { MediaTrack } from '@/components/GlobalMediaPlayer';

export function FanFirstLanding({
  tracks,
  primaryCtaLabel,
  stats,
}: {
  tracks: MediaTrack[];
  primaryCtaLabel: string;
  stats: Array<{ value: string; label: string }>;
}) {
  const featured = tracks[0];

  return (
    <div className="fan-home">
      <section className="fan-home-hero">
        <div className="fan-home-hero-copy">
          <p className="fan-home-kicker">Your local music scene. One free account.</p>
          <h1>Find the music happening around you.</h1>
          <p>Hear local artists you would otherwise miss. HYPE what you love and help real music reach real people in your scene.</p>
          <div className="fan-home-actions">
            <Link className="fan-home-primary" href="/register">{primaryCtaLabel}</Link>
          </div>
          <p className="fan-home-assurance">Free forever · No data sales · Music-only support</p>
        </div>

        {featured ? (
          <article className="fan-home-feature">
            <div className="fan-home-feature-art">
              {featured.artworkUrl ? (
                <Image src={featured.artworkUrl} alt="" fill sizes="(max-width: 800px) 100vw, 48vw" priority style={{ objectFit: 'cover' }} />
              ) : <span aria-hidden="true">iHYPE</span>}
            </div>
            <div className="fan-home-feature-overlay">
              <p>From the local scene</p>
              <h2>{featured.title}</h2>
              <span>{featured.artistName}</span>
            </div>
          </article>
        ) : (
          <div className="fan-home-feature fan-home-feature-empty">
            <strong>Local music lives here.</strong>
            <span>Join free and hear what is happening around you.</span>
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
    </div>
  );
}
