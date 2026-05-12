import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';

const ROLES = [
  {
    k: 'fan',
    label: 'Fan',
    sub: 'Discover artists before they blow up. Build your top-5 lists. Hype the tracks that deserve it.',
    c: '#b983ff',
    icon: '♡',
    cta: 'Join as Fan',
  },
  {
    k: 'artist',
    label: 'Artist',
    sub: 'Upload your music. List your shows. See real demand signal — not bot-inflated stream counts.',
    c: '#ff5029',
    icon: '◐',
    cta: 'Join as Artist',
  },
  {
    k: 'venue',
    label: 'Venue',
    sub: 'List shows for free. Issue tickets with zero platform fees. Every dollar stays in the scene.',
    c: '#22e5d4',
    icon: '◇',
    cta: 'Join as Venue',
  },
  {
    k: 'promoter',
    label: 'DJ / Promoter',
    sub: 'Book talent. Run live or recorded radio sets directly on the platform. Build your affiliate network.',
    c: '#ff3e9a',
    icon: '◉',
    cta: 'Join as DJ / Promoter',
  },
];

const HOW = [
  {
    n: '01',
    head: 'Upload or discover',
    body: 'Artists upload tracks. Fans browse by city, genre, or mood — no algorithm deciding what you hear first.',
  },
  {
    n: '02',
    head: 'Hype what hits',
    body: 'A Hype is earned by finishing a track or deliberately backing an artist. It\'s a demand signal, not a like.',
  },
  {
    n: '03',
    head: 'Shows follow the signal',
    body: 'Promoters and venues read the hype charts to book rising talent. Artists with real fan demand get booked.',
  },
  {
    n: '04',
    head: 'Tickets, zero fees',
    body: 'Buy tickets on iHYPE. The artist and venue keep 100% of the revenue. No Ticketmaster. No cuts.',
  },
];

export default async function MarketingPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/home');
  }

  return (
    <main className="lp-wrap">

      {/* Hero */}
      <section className="lp-hero lp-hero--v2">
        <div className="lp-hero-eyebrow">
          <span className="lp-live-dot" />
          Not-for-profit · Free forever · 0% ticket fees
        </div>
        <h1 className="lp-hero-h lp-hero-h--v2">
          Independent music<br />
          <span className="lp-hero-gradient">built for the scene.</span>
        </h1>
        <p className="lp-hero-sub lp-hero-sub--v2">
          The music industry is rigged. Streaming platforms bury independent artists under
          algorithmic debt. Ticket fees line the pockets of middlemen. Likes and play counts
          are gamed by bots. We built iHYPE because the scene deserves a platform that actually
          works for artists, fans, venues, and promoters — not against them.
        </p>
        <div className="lp-hero-actions">
          <Link href="/register" className="lp-btn-primary">Join free — it takes 60 seconds</Link>
          <Link href="/login" className="lp-btn-ghost">Sign in</Link>
        </div>
      </section>

      {/* Mission statement */}
      <section className="lp-mission">
        <p className="lp-section-eyebrow">WHY WE BUILT THIS</p>
        <div className="lp-mission-grid">
          <div className="lp-mission-block">
            <h2 className="lp-mission-h">
              We're not a startup chasing growth.<br />
              We're a community-owned tool.
            </h2>
            <p className="lp-mission-body">
              iHYPE is structured as a not-for-profit. That means no investors to answer to,
              no pressure to monetise your data, and no financial incentive to promote one
              artist over another. The platform exists to serve the independent music community —
              full stop. Every feature we build, every policy we set, traces back to that mission.
            </p>
          </div>
          <div className="lp-mission-stats">
            <div className="lp-mission-stat">
              <span className="lp-mission-stat-n" style={{ color: '#ff5029' }}>0%</span>
              <span className="lp-mission-stat-l">taken from ticket sales</span>
            </div>
            <div className="lp-mission-stat">
              <span className="lp-mission-stat-n" style={{ color: '#22e5d4' }}>0</span>
              <span className="lp-mission-stat-l">paid placements or promoted slots</span>
            </div>
            <div className="lp-mission-stat">
              <span className="lp-mission-stat-n" style={{ color: '#b983ff' }}>∞</span>
              <span className="lp-mission-stat-l">free storage for your music</span>
            </div>
          </div>
        </div>
      </section>

      {/* Zero-fee callout */}
      <section className="lp-zero-fee">
        <div className="lp-zero-fee-inner">
          <div className="lp-zero-fee-num">0%</div>
          <div className="lp-zero-fee-text">
            <strong>iHYPE takes nothing from ticket sales. Ever.</strong>
            <span>Artists and venues keep 100% of every ticket sold on this platform.
            That's not a promotional offer — it's written into how iHYPE works.
            We believe ticket fees are a tax on live music, and we refuse to collect them.</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="lp-how">
        <p className="lp-section-eyebrow">HOW IT WORKS</p>
        <h2 className="lp-section-head">Simple. Transparent. Yours.</h2>
        <div className="lp-how-steps">
          {HOW.map((h) => (
            <div key={h.n} className="lp-how-step">
              <span className="lp-how-n">{h.n}</span>
              <div>
                <h3 className="lp-how-head">{h.head}</h3>
                <p className="lp-how-body">{h.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hype explainer */}
      <section className="lp-hype-explainer lp-hype-explainer--v2">
        <p className="lp-section-eyebrow">THE CURRENCY OF THE SCENE</p>
        <h2 className="lp-section-head">A Hype is worth something</h2>
        <p className="lp-hype-intro">
          On every other platform, engagement is cheap. A like is a reflex.
          A stream can be bought in bulk. Play counts tell you nothing real.
          On iHYPE, a Hype is different — it only registers when a fan
          actually listens, or makes a deliberate choice to back an artist they believe in.
        </p>
        <div className="lp-hype-compare">
          <div className="lp-hype-col lp-hype-col--bad">
            <p className="lp-hype-col-label">Everywhere else</p>
            <ul>
              <li>Stream counts gamed by bots and playlisting services</li>
              <li>Likes cost nothing — one tap, no attention required</li>
              <li>Algorithms reward what's already popular</li>
              <li>Artists pay for promotion to reach their own fans</li>
            </ul>
          </div>
          <div className="lp-hype-col lp-hype-col--good">
            <p className="lp-hype-col-label">iHYPE</p>
            <ul>
              <li>A Hype is logged only when a fan finishes a track</li>
              <li>Or explicitly backs an artist they believe in</li>
              <li>Hype charts surface rising artists, not promoted ones</li>
              <li>Zero pay-to-play. No algorithmic shortcuts for sale</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Role picker */}
      <section className="lp-roles">
        <p className="lp-section-eyebrow">WHO IS THIS FOR</p>
        <h2 className="lp-section-head">Built for every part of the scene</h2>
        <p className="lp-section-sub">One account, multiple roles. Start with the one that fits today.</p>
        <div className="lp-role-grid lp-role-grid--v2">
          {ROLES.map((r) => (
            <Link
              key={r.k}
              href={`/register?role=${r.k}`}
              className="lp-role-card lp-role-card--v2"
              style={{ '--role-c': r.c } as React.CSSProperties}
            >
              <span className="lp-role-icon" style={{ color: r.c }}>{r.icon}</span>
              <strong className="lp-role-label">{r.label}</strong>
              <span className="lp-role-sub lp-role-sub--v2">{r.sub}</span>
              <span className="lp-role-cta" style={{ color: r.c }}>{r.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="lp-footer-cta lp-footer-cta--v2">
        <p className="lp-section-eyebrow">FREE FOREVER · NOT-FOR-PROFIT</p>
        <h2 className="lp-footer-cta-h">
          The scene built this.<br />
          <span className="lp-hero-gradient">It belongs to the scene.</span>
        </h2>
        <p className="lp-footer-cta-sub">
          No subscription. No hidden fees. No algorithm selling your attention to the highest bidder.
          iHYPE is built and maintained for the independent music community — and that will never change.
        </p>
        <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/register" className="lp-btn-primary lp-btn-primary--lg">Join iHYPE free</Link>
          <Link href="/login" className="lp-btn-ghost">Already a member? Sign in</Link>
        </div>
      </section>

    </main>
  );
}
