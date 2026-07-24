import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { KitApplyForm } from '@/components/KitApplyForm';

const ROLE_COLOR = '#ff5029';

export const metadata: Metadata = {
  title: 'For Artists | iHYPE.org',
  description: '70% of every ticket, locked in the charter before a single ticket sells. Direct ticketing, fan data, and a free radio studio — no agent required.',
};

const FEATURES = [
  { icon: '🎟️', head: 'Direct ticketing', body: 'List a show in minutes. Fans buy direct — no Ticketmaster. QR wallets handled.' },
  { icon: '📊', head: 'Fan data dashboard', body: "See who came, who bought first, who's hyping you. Export your list after every show." },
  { icon: '🔴', head: 'Live show hosting', body: 'Go live directly from iHYPE — listener count, hype pulse, live chat.' },
  { icon: '📻', head: 'Free-use library', body: 'Opt your tracks into the DJ pool and reach new audiences without losing rights.' },
  { icon: '🗺️', head: 'Tour creator', body: 'Build a tour, set dates across cities, manage all events from one dashboard.' },
  { icon: '✓', head: 'Verification badge', body: 'Apply for a verified artist badge. Appears on your profile, events, and all iHYPE surfaces.' },
];

export default async function ArtistKitPage() {
  const inviteOnly = await isInviteCodeRequiredRuntime();

  return (
    <div className="lp-wrap">
      <section className="lp-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2.5rem', alignItems: 'center', paddingBottom: 0 }}>
        <div>
          <p className="lp-hero-eyebrow" style={{ color: ROLE_COLOR }}>FOR ARTISTS · LIVE 2026</p>
          <h1 className="lp-hero-h">Your music. Your gate. <span style={{ color: ROLE_COLOR }}>Your fans.</span></h1>
          <p className="lp-hero-sub">
            iHYPE gives you <strong style={{ color: 'var(--text)' }}>70% of every ticket</strong>, your fans&apos; contact info, and tools to run your own shows — no agent, no Ticketmaster, no platform that owns the relationship.
          </p>
        </div>
        <KitApplyForm
          role="ARTIST"
          roleColor={ROLE_COLOR}
          inviteOnly={inviteOnly}
          heading="Apply as an artist"
          intro="We're onboarding a small founding cohort. Tell us about you."
          fields={[
            { key: 'genre', label: 'Genre / style', placeholder: 'Genre / style', type: 'select', options: ['Dream-pop', 'Shoegaze', 'R&B', 'Jazz', 'Hip-hop', 'Electronic', 'Punk / Indie rock', 'Folk', 'Other'] },
            { key: 'city', label: 'Home city', placeholder: 'Home city' },
            { key: 'link', label: 'Music link', placeholder: 'Spotify, Bandcamp, or SoundCloud', type: 'url' },
          ]}
          applyLabel="Request artist access →"
          successIcon="🔥"
          successTitle="Application received."
          successBody="We'll reach out within 48 hours with your invite code and onboarding guide."
          openLabel="Join as an artist →"
          openHref="/register?role=ARTIST"
        />
      </section>

      <section className="lp-stats" style={{ marginTop: '-40px' }}>
        {[
          { val: '70%', label: 'Your gate · locked' },
          { val: '$0', label: 'Platform fee on tickets' },
          { val: '100%', label: 'Fan data ownership' },
          { val: '24h', label: 'Payout turnaround' },
        ].map((s) => (
          <div className="lp-stat" key={s.label} style={{ '--text': ROLE_COLOR } as React.CSSProperties}>
            <div className="lp-stat-val" style={{ color: ROLE_COLOR }}>{s.val}</div>
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: ROLE_COLOR }}>THE CHARTER</p>
        <h2 className="lp-section-head">A split that can&apos;t be unwritten after the first ticket sells.</h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, margin: '20px 0 0', padding: 0 }}>
          {[
            'Set your price and split before publish',
            'Once a ticket sells, the split is sealed',
            'Your 70% hits your account night of show',
            'Full fan email list after every event',
            'No agent or manager needed to list',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: '.95rem', lineHeight: 1.5, color: 'var(--text)' }}>
              <span style={{ color: ROLE_COLOR, fontFamily: 'var(--font-display)', fontWeight: 800, flexShrink: 0 }}>✓</span>{item}
            </li>
          ))}
        </ul>
        <p className="lp-hype-body" style={{ marginTop: 24 }}>
          None of this works without fans in the room. iHYPE&apos;s whole job is getting the ones who already believe in you to hype, buy, and bring a friend — <Link href="/fans" style={{ color: ROLE_COLOR }}>see how fans fit in →</Link>
        </p>
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: ROLE_COLOR }}>WHAT YOU GET</p>
        <h2 className="lp-section-head">Tools built for touring artists.</h2>
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
