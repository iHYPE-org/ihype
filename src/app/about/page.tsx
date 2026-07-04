import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | iHYPE.org',
};

export default function AboutPage() {
  return (
    <div className="lp-wrap">
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
        </p>
        <span className="lp-coming-soon">Detailed funding breakdown coming soon</span>
      </section>

      {/* Timeline */}
      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow">OUR STORY</p>
        <h2 className="lp-section-head">How we got here</h2>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { date: 'January 2026', head: 'Founded in Portland, ME', body: 'iHYPE incorporated as a not-for-profit organization in Portland, Maine. The founding charter locked in 0% platform fees and the 45/45/10 revenue split.' },
            { date: 'February 2026', head: 'Design system & charter published', body: 'The iHYPE design system and community charter were published openly. The revenue split, governance model, and founding principles are locked in the charter.' },
            { date: 'March 2026', head: 'Platform beta launched', body: 'Beta access opened to artists, venues, and promoters in the Portland area. First shows went live on the platform.' },
            { date: 'June 2026', head: 'Expanded beta & radio shows', body: 'Fan beta access opened nationally. Audio-only radio shows and live DJ sets went live. iHYPE has never hosted video and never will.' },
          ].map((item, i, arr) => (
            <div key={item.date} style={{ display: 'flex', gap: 20, paddingBottom: i < arr.length - 1 ? 28 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', marginTop: 4, flexShrink: 0 }} />
                {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--line-2)', marginTop: 6 }} />}
              </div>
              <div style={{ paddingBottom: i < arr.length - 1 ? 0 : 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>{item.date}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', marginBottom: 6 }}>{item.head}</h3>
                <p style={{ color: 'var(--ink-2)', lineHeight: 1.65, fontSize: '0.95rem' }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The team */}
      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow">THE TEAM</p>
        <h2 className="lp-section-head">Who builds iHYPE</h2>
        <p className="lp-hype-body">
          iHYPE is built by a small team of musicians, developers, and community organizers who got tired of watching
          independent venues close and independent artists lose income to platform fees. We are not venture-backed.
          We do not have a growth-at-all-costs mandate.
        </p>
        <span className="lp-coming-soon">Full team page coming soon</span>
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
    </div>
  );
}
