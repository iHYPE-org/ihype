import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

type LandingStat = {
  label: string;
  value: string;
};

export function FanFirstLanding({ stats }: { stats: LandingStat[] }) {
  return (
    <div className="scene-landing">
      <header aria-label="iHYPE" className="scene-landing-header">
        <div aria-label="iHYPE" className="scene-landing-logo" role="img">
          <span>i</span><strong>HYPE</strong>
        </div>
        <nav aria-label="Account" className="scene-landing-nav">
          <ThemeToggle />
          <Link className="scene-landing-signin" href="/login">Sign in</Link>
          <Link className="scene-landing-join" href="/register">Join free</Link>
        </nav>
      </header>

      <section className="scene-landing-hero">
        <Image
          alt=""
          className="scene-landing-art"
          fill
          priority
          sizes="100vw"
          src="/brand/local-scene-signal-v2.webp"
          unoptimized
        />
        <div aria-hidden="true" className="scene-landing-scrim" />

        <div className="scene-landing-copy">
          <p className="scene-landing-kicker">Your scene. Your signal.</p>
          <h1><span>Free</span><span>local</span><span>music.</span></h1>
          <p className="scene-landing-lead">
            Hear the artists playing around you. HYPE what you love.
            Help your scene get heard.
          </p>
          <Link className="scene-landing-primary" href="/register">
            Join free <span aria-hidden="true">—</span> start listening
          </Link>
          <p className="scene-landing-assurance">
            No subscription <i aria-hidden="true">·</i> No paywall <i aria-hidden="true">·</i> We never sell your data
          </p>
        </div>

        <p className="scene-landing-signal" aria-hidden="true">
          <span />
          Local sound matters
        </p>
      </section>

      <section aria-label="Live iHYPE platform statistics" className="scene-landing-stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
