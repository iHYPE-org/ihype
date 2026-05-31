import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | iHYPE.org',
};

export default function AboutPage() {
  return (
    <main className="lp-wrap">
      <section className="lp-hero" style={{ paddingBottom: '20px' }}>
        <p className="lp-hype-eyebrow">NOT-FOR-PROFIT · BUILT FOR THE SCENE</p>
        <h1 className="lp-hero-h" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>About iHYPE</h1>
        <p className="lp-hero-sub">
          iHYPE exists to give independent artists, venues, and promoters a platform that doesn&apos;t take a cut.
          No platform fee on tickets. No streaming royalty deductions. No algorithmic pay-to-play.
          Built and governed by the community it serves.
        </p>
      </section>

      {/* Our promise */}
      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow">OUR PROMISE</p>
        <h2 className="lp-section-head">What we will never do</h2>
        <div className="lp-reason-grid" style={{ marginTop: '20px' }}>
          {[
            { icon: '◐', head: '0% ticket fee', body: 'Face value is face value. Every cent from a ticket sale goes directly to the artist or venue — no platform deduction, ever.' },
            { icon: '♡', head: 'No streaming cuts', body: 'iHYPE does not take royalties. Hypes are a demand signal, not a revenue share mechanism.' },
            { icon: '◇', head: 'No ads', body: 'The platform is funded by the community, not by advertisers. Your listening habits are never sold.' },
            { icon: '◉', head: 'Open to all', body: 'Any independent artist, venue, or promoter can join for free. There is no gated tier, no premium listing, no pay-to-surface.' },
          ].map((r) => (
            <div key={r.icon} className="lp-reason-card">
              <div className="lp-reason-icon">{r.icon}</div>
              <h3 className="lp-reason-head">{r.head}</h3>
              <p className="lp-reason-body">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it's funded */}
      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow">FUNDING</p>
        <h2 className="lp-section-head">How it&apos;s funded</h2>
        <p className="lp-hype-body">
          iHYPE is sustained by a mix of community grants, optional artist memberships that unlock extra
          analytics and promotional tools, and direct donations from fans who believe independent music
          infrastructure should belong to artists. We publish full financial summaries on our{' '}
          <Link href="/transparency" style={{ color: '#22e5d4' }}>transparency page</Link>.
          [Detailed funding breakdown coming soon.]
        </p>
      </section>

      {/* The team */}
      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow">THE TEAM</p>
        <h2 className="lp-section-head">Who builds iHYPE</h2>
        <p className="lp-hype-body">
          iHYPE is built by a small team of musicians, developers, and community organizers who got tired of watching
          independent venues close and independent artists lose income to platform fees. We are not venture-backed.
          We do not have a growth-at-all-costs mandate. [Full team page coming soon.]
        </p>
      </section>

      {/* CTA */}
      <section className="lp-footer-cta">
        <h2 className="lp-section-head" style={{ marginBottom: '8px' }}>Join the scene</h2>
        <p className="lp-hype-body" style={{ textAlign: 'center', marginBottom: '24px' }}>
          Ready to be part of a platform that puts artists first?
        </p>
        <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/register" className="lp-btn-primary">Get started free</Link>
          <Link href="/transparency" className="lp-btn-ghost">Transparency report →</Link>
        </div>
      </section>
    </main>
  );
}
