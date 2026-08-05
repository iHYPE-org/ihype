import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * `stats` is a slot, not data: the caller passes a Suspense boundary so the
 * hero can paint before the counters' query resolves. See LandingStats.tsx.
 */
export function FanFirstLanding({ stats }: { stats: ReactNode }) {
  return (
    <div className="fan-entry">
      <header aria-label="iHYPE" className="fan-entry-header">
        <Link aria-label="iHYPE home" className="fan-entry-logo" href="/">
          <Image alt="" height={54} priority src="/brand/ihype-menu-logo.webp" width={54} />
        </Link>
        <nav aria-label="Account" className="fan-entry-nav">
          <ThemeToggle />
          <Link className="fan-entry-signin" href="/login">Sign in</Link>
          <Link className="fan-entry-join" href="/register">Join free</Link>
        </nav>
      </header>

      <main className="fan-entry-main">
        <section className="fan-entry-hero">
          <div className="fan-entry-copy">
            <p className="fan-entry-kicker">Your scene is playing · Always free</p>
            <h1>Listen. Engage.<br /><span>HYPE local.</span></h1>
            <p className="fan-entry-lead">
              Hear free music from artists around you, discover shows worth leaving home for,
              and turn every HYPE into real support for the music you love.
            </p>
            <div className="fan-entry-actions">
              <Link className="fan-entry-primary" href="/register">
                Join free <span aria-hidden="true">—</span> start listening
              </Link>
              <Link className="fan-entry-secondary" href="/login">Already a member? Sign in</Link>
            </div>
            <p className="fan-entry-assurance">
              Always free <i aria-hidden="true">·</i> Music-only support <i aria-hidden="true">·</i> We never sell your data
            </p>
          </div>

          <div className="fan-entry-visual">
            <div aria-hidden="true" className="fan-entry-stage-light" />
            <Image
              alt="iHYPE.org — local music"
              className="fan-entry-art"
              height={1024}
              priority
              sizes="(max-width: 900px) 82vw, 42vw"
              src="/brand/ihype-icon-master-2026.png"
              width={1024}
            />
            <p className="fan-entry-signal"><span /> Support the scene. Be the signal.</p>
          </div>
        </section>

        <section aria-label="How iHYPE works for fans" className="fan-entry-steps">
          <article><span>01</span><div><strong>Listen</strong><p>Free music from artists in and beyond your scene.</p></div></article>
          <article><span>02</span><div><strong>Engage</strong><p>Discover songs, radio, artists, and live events.</p></div></article>
          <article><span>03</span><div><strong>HYPE</strong><p>Turn what you love into a real local signal.</p></div></article>
        </section>

        <section aria-label="Live iHYPE platform statistics" className="fan-entry-stats">
          {stats}
        </section>
      </main>
    </div>
  );
}
