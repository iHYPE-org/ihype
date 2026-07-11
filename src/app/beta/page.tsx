import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Beta · iHYPE',
  description: 'iHYPE closed beta — real shows, real artists, zero platform fees. Join the waitlist or enter your invite code.',
  robots: { index: false, follow: false },
};

export default function BetaPage() {
  return (
    <div className="lp-wrap">
      <section className="lp-hero" style={{ textAlign: 'center', alignItems: 'center' }}>
        <p className="lp-hype-eyebrow" style={{ justifyContent: 'center' }}>
          <span className="lp-live-dot" style={{ background: '#ff5029', boxShadow: '0 0 6px #ff5029' }} />
          CLOSED BETA · PORTLAND, ME · 2026
        </p>
        <h1 className="lp-hero-h" style={{ textAlign: 'center' }}>
          Music's missing{' '}
          <span className="lp-hero-gradient">middle layer</span>
        </h1>
        <p className="lp-hero-sub" style={{ textAlign: 'center', maxWidth: 560 }}>
          iHYPE connects fans directly to independent artists and venues.
          Zero platform fees. Every dollar goes to the people making the music.
        </p>
        <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/register" className="lp-btn-primary">
            Join with invite code
          </Link>
          <Link href="/charter" className="lp-btn-ghost">
            Read the charter
          </Link>
        </div>
      </section>

      {/* Split bar */}
      <section>
        <p className="lp-hype-eyebrow" style={{ marginBottom: 16 }}>THE SPLIT — LOCKED IN THE CHARTER</p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1, borderRadius: 12, overflow: 'hidden',
          background: 'rgba(255,255,255,.07)',
          border: '1px solid rgba(255,255,255,.07)',
        }}>
          {[
            { pct: '45%', role: 'Artist', color: '#ff5029' },
            { pct: '45%', role: 'Venue', color: '#22e5d4' },
            { pct: '10%', role: 'Promoter', color: '#ff3e9a' },
            { pct: '0%', role: 'iHYPE', color: 'var(--ink-a30)' },
          ].map(s => (
            <div key={s.role} style={{
              padding: '24px 20px',
              background: 'rgba(255,255,255,.025)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.02em', color: s.color }}>{s.pct}</span>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-a50)' }}>{s.role}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-a35)', fontFamily: 'var(--font-mono)' }}>
          Platform fee: $0.00 · Split enforced on every transaction, forever.
        </p>
      </section>

      {/* What you get */}
      <section>
        <p className="lp-hype-eyebrow" style={{ marginBottom: 20 }}>WHAT&apos;S IN BETA</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: '🎛️', title: 'iHYPE Radio', body: 'DJs broadcast live audio-only shows. Shows auto-save for on-demand replay.', color: '#ff3e9a' },
            { icon: '🎟️', title: 'Zero-fee tickets', body: 'Real ticketing with Stripe. 0% goes to iHYPE — ever.', color: '#ff5029' },
            { icon: '🔥', title: 'Hype system', body: 'One hype per artist per day. Charts surface real fan demand.', color: '#b983ff' },
            { icon: '📍', title: 'Local discovery', body: 'Shows near you, ranked by community activity — not paid promotion.', color: '#22e5d4' },
          ].map(f => (
            <div key={f.title} style={{
              padding: '20px 22px', border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 10, background: 'var(--bg-2, #100d09)',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, marginBottom: 6, color: f.color }}>{f.title}</div>
              <p style={{ fontSize: 13, color: 'var(--ink-a55)', lineHeight: 1.6, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <p className="lp-hype-eyebrow">HAVE AN INVITE CODE?</p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', letterSpacing: '-.02em', margin: 0 }}>
          Join the beta today
        </h2>
        <Link href="/register" className="lp-btn-primary" style={{ fontSize: 15, padding: '14px 32px' }}>
          Create your account →
        </Link>
        <p style={{ fontSize: 12, color: 'var(--ink-a30)', fontFamily: 'var(--font-mono)' }}>
          Portland, ME · Founded 2026 · admin@ihype.org
        </p>
      </section>
    </div>
  );
}
