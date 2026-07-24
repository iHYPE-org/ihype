import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { KitApplyForm } from '@/components/KitApplyForm';

const ROLE_COLOR = '#b983ff';

export const metadata: Metadata = {
  title: 'For Fans | iHYPE.org',
  description: 'Hype the artists you love before anyone else catches on, buy tickets at face value with zero platform fee, and earn a real cut every time someone buys through your link.',
};

const FEATURES = [
  { icon: '🔥', head: 'HYPE mechanic', body: 'A weekly flame budget — back the artists you believe in before anyone else does.' },
  { icon: '🎟️', head: 'Direct ticketing', body: 'Face value, QR wallet, zero scalper markup — buy straight from the artist.' },
  { icon: '🔗', head: 'Promoter earnings', body: 'Share any show. Earn your proportional cut of the 10% promoter pool.' },
  { icon: '📻', head: 'Live radio', body: "Tune into any DJ's live or recorded show, free — no paywall, ever." },
  { icon: '🌱', head: 'Seeds discovery', body: 'A taste-matched swipe deck that surfaces artists before they blow up.' },
  { icon: '✓', head: 'Your own page', body: 'Fan-promoters get an AI-built page too — show off what you\'ve discovered.' },
];

export default async function FanKitPage() {
  const inviteOnly = await isInviteCodeRequiredRuntime();

  return (
    <div className="lp-wrap">
      <section className="lp-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2.5rem', alignItems: 'center', paddingBottom: 0 }}>
        <div>
          <p className="lp-hero-eyebrow" style={{ color: ROLE_COLOR }}>FOR FANS · LIVE 2026</p>
          <h1 className="lp-hero-h">Your taste. Your voice. <span style={{ color: ROLE_COLOR }}>Your cut.</span></h1>
          <p className="lp-hero-sub">
            Hype the artists you love before anyone else catches on, buy tickets <strong style={{ color: 'var(--text)' }}>at face value with zero platform fee</strong>, and earn a real cut every time someone buys through your link.
          </p>
        </div>
        <KitApplyForm
          role="FAN"
          roleColor={ROLE_COLOR}
          inviteOnly={inviteOnly}
          heading="Join as a fan"
          intro="Free, always. Tell us what you're into and we'll seed your first recommendations."
          fields={[
            { key: 'genre', label: 'Favorite genre', placeholder: 'Favorite genre', type: 'select', options: ['Dream-pop', 'Indie', 'Shoegaze', 'Electronic', 'Hip-hop', 'Jazz', 'Punk', 'Other'] },
            { key: 'city', label: 'Home city', placeholder: 'Home city' },
          ]}
          applyLabel="Create free account →"
          successIcon="🔥"
          successTitle="You're in."
          successBody="We'll reach out within 48 hours with your invite code and your first set of Seeds."
          openLabel="Join free →"
          openHref="/register?role=FAN"
        />
      </section>

      <section className="lp-stats" style={{ marginTop: '-40px' }}>
        {[
          { val: '$0', label: 'iHYPE fee, ever' },
          { val: '10%', label: 'Max promoter share' },
          { val: 'Free', label: 'Radio, always' },
          { val: '1', label: 'Vote, one member' },
        ].map((s) => (
          <div className="lp-stat" key={s.label}>
            <div className="lp-stat-val" style={{ color: ROLE_COLOR }}>{s.val}</div>
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: ROLE_COLOR }}>THE CHARTER</p>
        <h2 className="lp-section-head">Your HYPE is a real vote — not a like button.</h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, margin: '20px 0 0', padding: 0 }}>
          {[
            'Every hype is a real demand signal artists and venues see',
            'Buy tickets direct — face value, no service fees',
            'Share a HYPE Link and earn from the 10% promoter pool',
            "Free radio — every DJ's show, no subscription",
            'One member, one vote — spend never buys more influence',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: '.95rem', lineHeight: 1.5, color: 'var(--text)' }}>
              <span style={{ color: ROLE_COLOR, fontFamily: 'var(--font-display)', fontWeight: 800, flexShrink: 0 }}>✓</span>{item}
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: ROLE_COLOR }}>WHAT YOU GET</p>
        <h2 className="lp-section-head">Everything a fan actually wants.</h2>
        <div className="lp-reason-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 20 }}>
          {FEATURES.map((f) => (
            <div key={f.head} className="lp-reason-card">
              <div className="lp-reason-icon">{f.icon}</div>
              <h3 className="lp-reason-head">{f.head}</h3>
              <p className="lp-reason-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-footer-cta">
        <h2 className="lp-section-head" style={{ marginBottom: 8 }}>Build your page</h2>
        <p className="lp-hype-body" style={{ textAlign: 'center', marginBottom: 24 }}>
          Fan-promoters get an AI-built page too — show off what you&apos;ve discovered.
        </p>
        <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/pages?tab=creator" className="lp-btn-ghost">Build your page →</Link>
        </div>
      </section>
    </div>
  );
}
