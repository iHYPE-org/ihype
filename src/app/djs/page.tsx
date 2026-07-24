import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { KitApplyForm } from '@/components/KitApplyForm';

const ROLE_COLOR = '#ff3e9a';

export const metadata: Metadata = {
  title: 'For DJs | iHYPE.org',
  description: 'A free radio studio, a licensed free-use track library, and a referral link that pays you every time a fan you drove buys a ticket.',
};

const FEATURES = [
  { icon: '📻', head: 'Radio studio', body: 'Record or go live straight from iHYPE — no separate streaming setup.' },
  { icon: '🎚️', head: 'Free-use crate', body: 'A growing library of artist-cleared tracks, licensed for on-platform spins.' },
  { icon: '🔗', head: 'HYPE Link earnings', body: 'Share any show. Earn your proportional cut of the 10% promoter pool.' },
  { icon: '📊', head: 'Listener analytics', body: 'See peak listeners, top shows, and referral earnings in one dashboard.' },
  { icon: '🗓️', head: 'Show scheduler', body: 'Set a weekly slot or one-off session — fans get a reminder when you go live.' },
  { icon: '✓', head: 'AI page, built for you', body: 'Paste a bio and a set link — the AI Page Creator drafts your public profile in one pass.' },
];

export default async function DjKitPage() {
  const inviteOnly = await isInviteCodeRequiredRuntime();

  return (
    <div className="lp-wrap">
      <section className="lp-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2.5rem', alignItems: 'center', paddingBottom: 0 }}>
        <div>
          <p className="lp-hero-eyebrow" style={{ color: ROLE_COLOR }}>FOR DJS · LIVE 2026</p>
          <h1 className="lp-hero-h">Your crate. Your show. <span style={{ color: ROLE_COLOR }}>Your cut.</span></h1>
          <p className="lp-hero-sub">
            iHYPE gives you a <strong style={{ color: 'var(--text)' }}>free radio studio</strong>, a licensed free-use track library, and a referral link that pays you every time a fan you drove buys a ticket.
          </p>
        </div>
        <KitApplyForm
          role="DJ"
          roleColor={ROLE_COLOR}
          inviteOnly={inviteOnly}
          heading="Apply as a DJ"
          intro="We're onboarding a small founding cohort. Tell us about you."
          fields={[
            { key: 'genre', label: 'Genre / style', placeholder: 'Genre / style', type: 'select', options: ['House', 'Techno', 'Hip-hop', 'Disco', 'Ambient', 'Drum & Bass', 'Lo-fi', 'Other'] },
            { key: 'city', label: 'Home city', placeholder: 'Home city' },
            { key: 'link', label: 'Set link', placeholder: 'Mixcloud, SoundCloud, or set link', type: 'url' },
          ]}
          applyLabel="Request DJ access →"
          successIcon="📻"
          successTitle="Application received."
          successBody="We'll reach out within 48 hours with your invite code and studio walkthrough."
          openLabel="Join as a DJ →"
          openHref="/register?role=DJ"
        />
      </section>

      <section className="lp-stats" style={{ marginTop: '-40px' }}>
        {[
          { val: '$0', label: 'Studio & hosting cost' },
          { val: '10%', label: 'Promoter pool share' },
          { val: '100%', label: 'Licensed free-use library' },
          { val: '24h', label: 'Referral payout turnaround' },
        ].map((s) => (
          <div className="lp-stat" key={s.label}>
            <div className="lp-stat-val" style={{ color: ROLE_COLOR }}>{s.val}</div>
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: ROLE_COLOR }}>THE CHARTER</p>
        <h2 className="lp-section-head">Radio that pays the DJ — imagine that.</h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, margin: '20px 0 0', padding: 0 }}>
          {[
            'Build a live or recorded show from your phone',
            'Crate tracks from the free-use library — no clearance calls',
            'Share a HYPE Link and earn your share of the 10% promoter pool',
            "Earnings settle automatically — never the artist's 70%",
            'No agent or label needed to go live',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: '.95rem', lineHeight: 1.5, color: 'var(--text)' }}>
              <span style={{ color: ROLE_COLOR, fontFamily: 'var(--font-display)', fontWeight: 800, flexShrink: 0 }}>✓</span>{item}
            </li>
          ))}
        </ul>
        <p className="lp-hype-body" style={{ marginTop: 24 }}>
          None of this works without listeners tuning in. iHYPE&apos;s whole job is getting the fans who already like your sound to hype your show, click your link, and come back next week — <Link href="/fans" style={{ color: ROLE_COLOR }}>see how fans fit in →</Link>
        </p>
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: ROLE_COLOR }}>WHAT YOU GET</p>
        <h2 className="lp-section-head">Tools built for working DJs.</h2>
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
    </div>
  );
}
