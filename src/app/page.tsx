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
          Hype is earned.<br />
          <span className="lp-hero-gradient">Not bought. Not gamed.</span>
        </h1>
        <p className="lp-hero-sub lp-hero-sub--v2">
          iHYPE is a non-profit discovery platform where fans vote with real
          actions — finished listens, show attendance, genuine backing — and
          that attention is the only thing that moves an artist up the charts.
          No algorithms for sale. No pay-to-play. No middlemen skimming your money.
          Just the scene, deciding what rises.
          Music discovery that works<br />
          <span className="lp-hero-gradient">for the scene, not the algorithm.</span>
        </h1>
        <p className="lp-hero-sub lp-hero-sub--v2">
          iHYPE is a community-owned platform where fans vote with real listens,
          artists rise on genuine demand, and every dollar from every ticket stays
          with the people who made the show happen.
        </p>
        <div className="lp-hero-actions">
          <Link href="/register" className="lp-btn-primary lp-btn-primary--lg">Join free — it takes 60 seconds</Link>
          <Link href="/login" className="lp-btn-ghost">Sign in</Link>
        </div>
      </section>

      {/* Seeds — product hook */}
      <section className="lp-how">
        <p className="lp-section-eyebrow">HOW DISCOVERY WORKS</p>
        <h2 className="lp-section-head">Swipe to discover. Listen to vote.</h2>
        <p className="lp-hype-intro">
          Every track gets a <strong>Seed</strong> — a 15–30 second high-energy clip pulled from its best moment.
          Swipe right and the full track drops into your queue. Swipe left and move on.
          No algorithm decides what you hear next. Your swipes do.
        </p>
        <div className="lp-how-steps">
          {[
            {
              n: '01',
              head: 'Seeds, not infinite scroll',
              body: 'Short clips cut through the paradox of choice. You hear the best 20 seconds of a track before committing — no more three-second skips that bury an artist.',
            },
            {
              n: '02',
              head: '70 / 20 / 10 mix',
              body: 'Seeds are served 70% from your taste, 20% from adjacent genres, and 10% pure wildcards. You stay in your lane while the scene expands around you.',
            },
            {
              n: '03',
              head: 'A Hype that means something',
              body: 'A Hype only registers when you finish a track. No background plays, no bots, no gaming. One genuine listen = one real vote for that artist.',
            },
            {
              n: '04',
              head: 'Show up, earn more',
              body: 'Attending a show earns 10 Hype points — verified by QR or GPS at the venue. Presence matters. The scene rewards people who are actually there.',
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

      {/* Zero-fee callout */}
      <section className="lp-zero-fee">
        <div className="lp-zero-fee-inner">
          <div className="lp-zero-fee-num">0%</div>
          <div className="lp-zero-fee-text">
            <strong>iHYPE takes nothing from ticket sales. Ever.</strong>
            <span>Artists and venues keep 100% of every ticket sold on this platform.
            That&rsquo;s not a promotional rate — it&rsquo;s written into how iHYPE works.
            Ticket fees are a tax on live music, and we refuse to collect them.</span>
          </div>
        </div>
      </section>

      {/* Mission / not-for-profit */}
      <section className="lp-mission">
        <p className="lp-section-eyebrow">WHY WE BUILT THIS</p>
        <div className="lp-mission-grid">
          <div className="lp-mission-block">
            <h2 className="lp-mission-h">
              We&rsquo;re not a startup chasing growth.<br />
              We&rsquo;re a cooperative you own.
            </h2>
            <p className="lp-mission-body">
              iHYPE is structured as a not-for-profit platform cooperative.
              No investors to answer to, no pressure to monetise your data,
              no financial incentive to promote one artist over another.
              Major platform decisions — new features, new rules — are put to
              a community vote by verified members. Every feature we build
              traces back to one mission: keep independent music alive by
              making the economics visible and fair.
              iHYPE is structured as a not-for-profit platform cooperative. No investors,
              no pressure to monetise your data, no incentive to promote one artist over another.
              Every verified member can propose and vote on platform changes — from new discovery
              heuristics to community rules — following Robert&rsquo;s Rules of Order.
              The scene built this. The scene runs it.
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

      {/* How Hype Works */}
      <section className="lp-how">
        <p className="lp-section-eyebrow">HOW HYPE WORKS</p>
        <h2 className="lp-section-head">Attention you can trust.</h2>
        <div className="lp-how-steps">
          {[
            {
              n: '01',
              head: 'Fans discover via Seeds',
              body: 'Music is introduced as short high-energy clips — the best 15-30 seconds of a track. Swipe right to add the full song to your queue. No passive autoplay. Every listen starts with a genuine choice.',
            },
            {
              n: '02',
              head: 'Hype is earned, not bought',
              body: 'A Hype point registers only when a fan finishes a track or shows up to a verified event. No bots. No bulk purchases. No pay-to-play shortcuts. One fan, one action, one signal.',
            },
            {
              n: '03',
              head: 'Charts reflect reality',
              body: 'Rising means rising. The Hype leaderboard shows artists with real momentum — fans who listened, attended, and backed them. You cannot buy your way onto it.',
            },
            {
              n: '04',
              head: 'Artists see everything',
              body: 'Every Hype, every fan location, every demand signal is visible to the artist in plain numbers. No opaque dashboards. No black-box recommendations. You own your data.',
            },
          ].map((h) => (
            <div key={h.n} className="lp-how-step">
              <span className="lp-how-n">{h.n}</span>
              <div>
                <h3 className="lp-how-head">{h.head}</h3>
                <p className="lp-how-body">{h.body}</p>
              </div>
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
              <li>Your data sold to the highest bidder</li>
            </ul>
          </div>
          <div className="lp-hype-col lp-hype-col--good">
            <p className="lp-hype-col-label">iHYPE</p>
            <ul>
              <li>A Hype only counts when a fan genuinely finishes a track</li>
              <li>Seeds surface rising artists — no promoted slots, ever</li>
              <li>0% ticket fees, every dollar visible to everyone</li>
              <li>No pay-to-play, no shortcuts for sale</li>
              <li>Your data is never sold — industry-only ads, aggregated only</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Community governance */}
      <section className="lp-how" style={{ background: 'transparent' }}>
        <p className="lp-section-eyebrow">COMMUNITY GOVERNANCE</p>
        <h2 className="lp-section-head">The scene runs this platform.</h2>
        <p className="lp-hype-intro" style={{ maxWidth: '640px', margin: '0 auto 2.5rem' }}>
          iHYPE operates as a platform cooperative. Any verified member can
          propose a new feature or rule change, open the floor for debate, and
          call a vote. We follow Robert&rsquo;s Rules of Order — the same democratic
          process community organisations have used for over a century. No founder
          can unilaterally change how this platform works.
        </p>
        <div className="lp-how-steps">
          {[
            {
              n: 'I',
              head: 'Propose',
              body: 'Any member can submit a motion — a new heuristic, a policy change, a feature request — using a standard template.',
            },
            {
              n: 'II',
              head: 'Debate',
              body: 'The floor is open. All verified members can weigh in during the discussion period before a vote is called.',
            },
            {
              n: 'III',
              head: 'Vote',
              body: 'A digital quorum decides. The outcome is binding. Changes to the platform reflect what the community actually wants.',
      {/* Data ethics */}
      <section className="lp-how" style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: '48px' }}>
        <p className="lp-section-eyebrow">DATA ETHICS CHARTER</p>
        <h2 className="lp-section-head">Your data belongs to you. Full stop.</h2>
        <div className="lp-how-steps">
          {[
            {
              n: '01',
              head: 'Zero PII sale',
              body: 'Your individual profile is never sold or shared with anyone, full stop. Not to labels, not to advertisers, not to anyone.',
            },
            {
              n: '02',
              head: 'Industry-only ads',
              body: 'The only advertising on iHYPE comes from music-adjacent entities — venues, labels, record stores. No surveillance advertising. No retargeting.',
            },
            {
              n: '03',
              head: 'K-anonymity enforced',
              body: 'No data query ever reports on fewer than 5 people. You cannot be singled out from any aggregate we publish or share.',
            },
            {
              n: '04',
              head: 'Identity detached in 24h',
              body: 'Listening data is aggregated and your User ID replaced with a Cohort ID within 24 hours. We collect context, not surveillance.',
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

      {/* Data ethics */}
      <section className="lp-hype-explainer lp-hype-explainer--v2">
        <p className="lp-section-eyebrow">DATA ETHICS CHARTER</p>
        <h2 className="lp-section-head">Your data is not the product.</h2>
        <p className="lp-hype-intro">
          Most platforms profit from selling or targeting your behaviour. iHYPE&rsquo;s
          social contract works differently — and it&rsquo;s not marketing language, it&rsquo;s
          how the system is architected.
        </p>
        <div className="lp-hype-compare">
          <div className="lp-hype-col lp-hype-col--bad">
            <p className="lp-hype-col-label">Everywhere else</p>
            <ul>
              <li>Stream counts gamed by bots and playlist services</li>
              <li>Algorithms reward what&rsquo;s already popular or paid for</li>
              <li>Ticket fees extracted at every layer — artist, venue, fan</li>
              <li>Your listening data sold to the highest bidder</li>
              <li>Revenue breakdowns hidden in opaque dashboards</li>
            </ul>
          </div>
          <div className="lp-hype-col lp-hype-col--good">
            <p className="lp-hype-col-label">iHYPE</p>
            <ul>
              <li>Hype only registers on a completed, deliberate listen</li>
              <li>Charts surface rising artists — zero promoted slots</li>
              <li>0% ticket fees, every dollar visible to everyone</li>
              <li>Individual profiles are never sold or shared — ever</li>
              <li>Ads restricted to music-related entities only (venues, labels, stores)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="lp-footer-cta lp-footer-cta--v2">
        <p className="lp-section-eyebrow">FREE FOREVER · NOT-FOR-PROFIT · COMMUNITY-OWNED</p>
      {/* Footer CTA */}
      <section className="lp-footer-cta lp-footer-cta--v2">
        <p className="lp-section-eyebrow">FREE FOREVER · COMMUNITY-OWNED · NOT-FOR-PROFIT</p>
        <h2 className="lp-footer-cta-h">
          Built by the scene.<br />
          <span className="lp-hero-gradient">It belongs to the scene.</span>
        </h2>
        <p className="lp-footer-cta-sub">
          No subscription. No hidden fees. No algorithm selling your attention to the
          highest bidder. iHYPE is built and maintained for the independent music
          community — and the community votes on every change we make.
          No subscription. No hidden fees. No algorithm selling your attention.
          Join as a fan, an artist, a venue, or a promoter — and vote on how the platform evolves.
          iHYPE is yours.
        </p>
        <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/register" className="lp-btn-primary lp-btn-primary--lg">Join iHYPE free</Link>
          <Link href="/login" className="lp-btn-ghost">Already a member? Sign in</Link>
        </div>
      </section>

    </main>
  );
}
