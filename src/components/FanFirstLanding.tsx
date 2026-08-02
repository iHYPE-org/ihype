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
          <Image alt="" height={44} priority src="/brand/ihype-signal-mark.svg" width={44} />
          <span>i</span><strong>HYPE</strong>
        </div>
        <nav aria-label="Account" className="scene-landing-nav">
          <ThemeToggle />
          <Link className="scene-landing-signin" href="/login">Sign in</Link>
          <Link className="scene-landing-join" href="/register">Join free</Link>
        </nav>
      </header>

      <section className="scene-landing-hero">
        <div className="scene-landing-copy">
          <p className="scene-landing-kicker">Discover local music · Support the scene</p>
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

        <div className="scene-landing-visual" aria-hidden="true">
          <Image
            alt=""
            className="scene-landing-art"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 55vw"
            src="/brand/local-scene-signal-v2.webp"
            unoptimized
          />
          <div className="scene-landing-scrim" />
          <p className="scene-landing-visual-label"><span /> Live scene signal</p>
          <div className="scene-landing-visual-tags"><span>LOCAL</span><span>FREE</span><span>HUMAN</span></div>
          <p className="scene-landing-signal"><span /> Local sound matters</p>
        </div>
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
