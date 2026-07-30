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
          <p className="fan-home-kicker">Your scene. No subscription.</p>
          <h1>Free local music.</h1>
          <p>Hear the artists playing around you. Discover something unexpected. HYPE what you love and help your scene get heard.</p>
          <div className="fan-home-actions">
            <Link className="fan-home-primary" href="/register">{primaryCtaLabel} — start listening</Link>
          </div>
          <p className="fan-home-assurance">No subscription · No paywall · We never sell your data</p>
        </div>

        <div className="fan-home-brand-art" aria-hidden="true">
          <span className="fan-home-brand-echo fan-home-brand-echo-a">HYPE</span>
          <span className="fan-home-brand-echo fan-home-brand-echo-b">HYPE</span>
          <div className="fan-home-brand-wordmark">
            <span>i</span><strong>HYPE</strong>
          </div>
          <div className="fan-home-brand-signal">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <p>SUPPORT THE SCENE · BE THE SIGNAL</p>
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
