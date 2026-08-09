import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RequestBetaAccessForm } from '@/components/RequestBetaAccessForm';

/**
 * The public front door at `/`.
 *
 * Two product decisions shape everything here, both explicit:
 *
 * 1. **It says what the app IS: a free app for local music.** The previous copy
 *    ("Listen. Engage. HYPE local.") named the verbs but never the thing, so a
 *    first-time visitor could not tell whether iHYPE was a streaming service, a
 *    ticketing site or a social network. Every line now answers "what is this"
 *    before it answers "what can I do".
 *
 * 2. **It does not pitch artists or venues.** They understand the offer without
 *    being sold, and the recruiting pages (`/for-artists`, `/for-venues`) exist
 *    for the moment they want detail. A landing page that argues three
 *    audiences at once convinces none of them. This page speaks to the person
 *    who wants to hear music from their own city.
 *
 * ## Access is by request, not by signup
 *
 * There is no "Join free" anywhere on this page, and that is deliberate rather
 * than an omission: the product is pre-beta, and a button promising instant
 * signup is a promise the invite gate then breaks. The primary action is
 * `RequestBetaAccessForm`, which already existed for exactly this — it posts to
 * `/api/beta-access-request` (rate limited, honeypot, written to the audit log,
 * emailed to the admin recipients). Nothing new was built for it.
 *
 * **This page is not the gate.** The server-side gate is the
 * `invite_only_signup` runtime flag read by `isInviteCodeRequiredRuntime()`;
 * with that flag off, `/register` still accepts anyone who reaches it directly.
 * Removing the link is presentation. Keep the flag on while access is by
 * request, or the two disagree and the URL wins.
 *
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
          {/* An in-page anchor, not /register: the header must not offer a door
              that is currently closed. */}
          <a className="fan-entry-join" href="#request-access">Request access</a>
        </nav>
      </header>

      <main className="fan-entry-main">
        <section className="fan-entry-hero">
          <div className="fan-entry-copy">
            <p className="fan-entry-kicker">Private alpha · Portland, ME</p>
            <h1>The free app for<br /><span>local music.</span></h1>
            <p className="fan-entry-lead">
              Stream music from artists in your own city — all of it free, none of it
              behind a subscription. Find the shows they are playing this week, and
              HYPE the ones you want more people to hear.
            </p>

            <div className="fan-entry-actions" id="request-access">
              <div className="fan-entry-request">
                <p className="fan-entry-request-lead">
                  We are opening the app city by city. Leave your email and we will send
                  you an invite when we reach yours.
                </p>
                <RequestBetaAccessForm defaultOpen />
              </div>
            </div>

            <p className="fan-entry-secondary-line">
              Already invited? <Link className="fan-entry-secondary" href="/login">Sign in</Link>
            </p>

            <p className="fan-entry-assurance">
              Free forever <i aria-hidden="true">·</i> No ads between songs <i aria-hidden="true">·</i> We never sell your data
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

        {/* What the app does, in the order you would do it. Named as concrete
            capabilities rather than the old one-word verbs, which read as a
            brand slogan rather than a description of software. */}
        <section aria-label="What iHYPE does" className="fan-entry-steps">
          <article><span>01</span><div><strong>Listen free</strong><p>Full tracks from artists near you. No subscription, no paywall.</p></div></article>
          <article><span>02</span><div><strong>Find the show</strong><p>Who is playing this week, at which room, for how much.</p></div></article>
          <article><span>03</span><div><strong>HYPE it</strong><p>Your HYPE moves an artist up your city&rsquo;s chart. That is the whole ranking.</p></div></article>
        </section>

        <section aria-label="Live iHYPE platform statistics" className="fan-entry-stats">
          {stats}
        </section>
      </main>
    </div>
  );
}
