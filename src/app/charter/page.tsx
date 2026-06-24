import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community Charter | iHYPE.org',
  description: 'The iHYPE founding charter — our locked commitments to artists, venues, promoters, and fans.',
};

const CHARTER_SECTIONS = [
  {
    id: 'mission',
    eyebrow: 'ARTICLE I',
    title: 'Mission',
    body: 'iHYPE exists to build and maintain infrastructure for independent music. Our mission is to give artists, venues, promoters, and fans a platform that takes nothing — no ticket fees, no streaming royalties, no advertising revenue from listening data.',
  },
  {
    id: 'split',
    eyebrow: 'ARTICLE II',
    title: 'Revenue split — locked',
    body: null,
    custom: true,
  },
  {
    id: 'governance',
    eyebrow: 'ARTICLE III',
    title: 'Governance',
    body: 'iHYPE is governed by its community. Major product decisions — features, pricing changes, policy updates — require a community vote. Venue operators, artists, and promoters each hold a seat on the governance council. iHYPE staff may not hold a majority.',
  },
  {
    id: 'platform',
    eyebrow: 'ARTICLE IV',
    title: 'Platform commitments',
    body: null,
    list: [
      'No platform fee on ticket sales. Ever.',
      'No advertising targeted at listening data.',
      'No video hosting. iHYPE is audio-only.',
      'No algorithmic pay-to-play or promoted placement.',
      'No venture capital. No acquisition without community vote.',
      'Financial reports published quarterly on the transparency page.',
    ],
  },
  {
    id: 'audio',
    eyebrow: 'ARTICLE V',
    title: 'Audio-only commitment',
    body: 'iHYPE does not host video, live video streams, or recorded video of any kind. The platform is audio-only. DJs may broadcast live audio-only radio shows; those shows auto-save for on-demand replay as audio. This is a founding commitment and may not be changed without a supermajority community vote.',
  },
  {
    id: 'contact',
    eyebrow: 'ARTICLE VI',
    title: 'Contact & accountability',
    body: 'Questions about governance or charter compliance: admin@ihype.org. The charter is version-controlled and any amendment is logged publicly with the date, the change, and the community vote result.',
  },
];

export default function CharterPage() {
  return (
    <main className="lp-wrap">
      <section className="lp-hero" style={{ paddingBottom: 20 }}>
        <p className="lp-hype-eyebrow">PORTLAND, ME · FOUNDED 2026</p>
        <h1 className="lp-hero-h" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
          Community Charter
        </h1>
        <p className="lp-hero-sub">
          The iHYPE founding charter sets out our locked commitments to artists, venues, promoters, and fans.
          These principles cannot be changed without a supermajority community vote.
        </p>
      </section>

      {CHARTER_SECTIONS.map((s) => (
        <section key={s.id} className="lp-hype-explainer" id={s.id}>
          <p className="lp-hype-eyebrow">{s.eyebrow}</p>
          <h2 className="lp-section-head">{s.title}</h2>

          {s.body && <p className="lp-hype-body">{s.body}</p>}

          {s.custom && (
            <div style={{ marginTop: 24 }}>
              <p className="lp-hype-body" style={{ marginBottom: 20 }}>
                Every ticket sale on iHYPE is split as follows. iHYPE takes nothing.
                These percentages are defaults; artists and venues may negotiate
                custom splits per show, but iHYPE&apos;s share is always 0%.
              </p>
              <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden', height: 48 }}>
                <div style={{ flex: 45, background: 'var(--role-artist)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.06em', color: '#0a0805' }}>
                  ARTIST 45%
                </div>
                <div style={{ flex: 45, background: 'var(--role-venue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.06em', color: '#0a0805' }}>
                  VENUE 45%
                </div>
                <div style={{ flex: 10, background: 'var(--role-promoter)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', color: '#0a0805' }}>
                  10%
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                {[
                  { label: 'Artist', pct: '45%', color: 'var(--role-artist)', note: 'Goes directly to the headlining artist.' },
                  { label: 'Venue', pct: '45%', color: 'var(--role-venue)', note: 'Goes directly to the hosting venue.' },
                  { label: 'Promoter pool', pct: '10%', color: 'var(--role-promoter)', note: 'Split among affiliate promoters.' },
                  { label: 'iHYPE', pct: '0%', color: 'var(--ink-3)', note: 'We take nothing.' },
                ].map((r) => (
                  <div key={r.label} style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: r.color, marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>{r.pct}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.4 }}>{r.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {s.list && (
            <ul style={{ marginTop: 16, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.list.map((item) => (
                <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>◆</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="lp-footer-cta">
        <h2 className="lp-section-head" style={{ marginBottom: 8 }}>Read the transparency report</h2>
        <p className="lp-hype-body" style={{ textAlign: 'center', marginBottom: 24 }}>
          We publish full financial summaries quarterly. Nothing is hidden.
        </p>
        <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/transparency" className="lp-btn-primary">Transparency report</Link>
          <Link href="/about" className="lp-btn-ghost">About iHYPE →</Link>
        </div>
      </section>
    </main>
  );
}
