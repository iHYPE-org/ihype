import Image from 'next/image';
import Link from 'next/link';

export function FanFirstLanding({
  primaryCtaLabel,
  stats,
}: {
  primaryCtaLabel: string;
  stats: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="fan-home">
      <section className="fan-home-hero">
        <div className="fan-home-hero-copy">
          <h1>Free<br />local<br />music.</h1>
          <p>Hear the artists playing around you. HYPE what you love. Help your scene get heard.</p>
          <div className="fan-home-actions">
            <Link className="fan-home-primary" href="/register">{primaryCtaLabel} — start listening</Link>
          </div>
          <p className="fan-home-assurance">No subscription · No paywall · We never sell your data</p>
        </div>

        <div className="fan-home-approved-art" aria-hidden="true">
          <Image
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 58vw"
            src="/brand/local-music-signal.png"
          />
        </div>
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
