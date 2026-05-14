import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';

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
          The music industry is broken.<br />
          <span className="lp-hero-gradient">We&rsquo;re fixing it.</span>
        </h1>
        <p className="lp-hero-sub lp-hero-sub--v2">
          Streaming platforms bury independent artists under algorithmic debt.
          Ticket fees line the pockets of middlemen. Play counts are gamed by bots.
          iHYPE was built because the scene deserves radical transparency — a platform
          that tells you exactly what&rsquo;s happening with your music, your money, and your fans.
        </p>
        <div className="lp-hero-actions">
          <Link href="/register" className="lp-btn-primary">Join free — it takes 60 seconds</Link>
          <Link href="/login" className="lp-btn-ghost">Sign in</Link>
        </div>
      </section>

      {/* Mission */}
      <section className="lp-mission">
        <p className="lp-section-eyebrow">WHY WE BUILT THIS</p>
        <div className="lp-mission-grid">
          <div className="lp-mission-block">
            <h2 className="lp-mission-h">
              We&rsquo;re not a startup chasing growth.<br />
              We&rsquo;re a community-owned tool.
            </h2>
            <p className="lp-mission-body">
              iHYPE is structured as a not-for-profit. No investors to answer to,
              no pressure to monetise your data, no financial incentive to promote one
              artist over another. Every feature we build traces back to one mission:
              keep independent music alive by making the economics visible and fair.
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
            That&rsquo;s not a promotional offer — it&rsquo;s written into how iHYPE works.
            Ticket fees are a tax on live music, and we refuse to collect them.</span>
          </div>
        </div>
      </section>

      {/* Transparency breakdown */}
      <section className="lp-how">
        <p className="lp-section-eyebrow">RADICAL TRANSPARENCY</p>
        <h2 className="lp-section-head">You see everything. Always.</h2>
        <div className="lp-how-steps">
          {[
            {
              n: '01',
              head: 'Real demand signal',
              body: 'A Hype only registers when a fan finishes a track or deliberately backs an artist. No bots. No bulk purchases. No pay-to-play shortcuts.',
            },
            {
              n: '02',
              head: 'Open hype charts',
              body: 'Every artist can see exactly who HYPEd them, where their fans are, and what that demand looks like to promoters and venues.',
            },
            {
              n: '03',
              head: 'Clear money flow',
              body: 'Ticket revenue, referral splits, and payout schedules are displayed in plain numbers. Nothing hidden in a percentage buried in terms of service.',
            },
            {
              n: '04',
              head: 'No algorithm for sale',
              body: 'Discovery is driven by Hype — real attention from real fans. You cannot buy placement. You cannot game the charts. Rising means rising.',
            },
          ].map((h) => (
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

      {/* Comparison */}
      <section className="lp-hype-explainer lp-hype-explainer--v2">
        <p className="lp-section-eyebrow">THE PROBLEM WITH EVERYWHERE ELSE</p>
        <h2 className="lp-section-head">Opacity is the product</h2>
        <p className="lp-hype-intro">
          The major platforms profit from confusion. Artists don&rsquo;t know why a track surfaces or
          disappears. Fans don&rsquo;t know what they&rsquo;re actually supporting. Venues pay fees
          they can&rsquo;t audit. iHYPE exists to end that.
        </p>
        <div className="lp-hype-compare">
          <div className="lp-hype-col lp-hype-col--bad">
            <p className="lp-hype-col-label">Everywhere else</p>
            <ul>
              <li>Stream counts gamed by bots and playlist services</li>
              <li>Algorithms reward what&rsquo;s already popular or paid for</li>
              <li>Ticket fees extracted at every layer — artist, venue, fan</li>
              <li>Artists pay for promotion to reach their own audience</li>
              <li>Revenue breakdowns hidden in opaque dashboards</li>
            </ul>
          </div>
          <div className="lp-hype-col lp-hype-col--good">
            <p className="lp-hype-col-label">iHYPE</p>
            <ul>
              <li>A Hype is logged only when a fan genuinely listens</li>
              <li>Charts surface rising artists — no promoted slots</li>
              <li>0% ticket fees, every dollar visible to everyone</li>
              <li>No pay-to-play, no algorithmic shortcuts for sale</li>
              <li>Every split, payout, and referral shown in plain numbers</li>
            </ul>
          </div>
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
