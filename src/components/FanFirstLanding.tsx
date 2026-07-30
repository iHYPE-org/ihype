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
          <p className="fan-home-kicker">Free music. Your scene.</p>
          <h1>Local music should be easy to find.</h1>
          <p>Listen to artists from your scene, discover something unexpected, and HYPE the music you want more people to hear.</p>
          <div className="fan-home-actions">
            <Link className="fan-home-primary" href="/register">{primaryCtaLabel} — start listening</Link>
          </div>
          <p className="fan-home-assurance">No subscription · No paywall · We never sell your data</p>
        </div>

        <div className="fan-home-signal" aria-hidden="true">
          <div className="fan-home-signal-disc">
            <span className="fan-home-signal-ring fan-home-signal-ring-a" />
            <span className="fan-home-signal-ring fan-home-signal-ring-b" />
            <span className="fan-home-signal-center">iHYPE</span>
          </div>
          <div className="fan-home-signal-words">
            <span>FREE</span>
            <span>LOCAL</span>
            <span>MUSIC</span>
          </div>
          <p>Support the scene. Be the signal.</p>
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
