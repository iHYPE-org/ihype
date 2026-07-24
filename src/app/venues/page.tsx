import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { KitApplyForm } from '@/components/KitApplyForm';

const ROLE_COLOR = '#22e5d4';

export const metadata: Metadata = {
  title: 'For Venues | iHYPE.org',
  description: 'A guaranteed 20% of every gate, real demand data on who your city wants to see, and a booking inbox that keeps every offer in one place.',
};

const FEATURES = [
  { icon: '📈', head: 'Demand radar', body: 'See which artists your city is hyping before you commit a date.' },
  { icon: '📥', head: 'Booking inbox', body: 'Every artist and promoter request lands in one Pending/Accepted/Declined view.' },
  { icon: '🎫', head: 'QR door check-in', body: 'Scan tickets straight from a phone — no extra hardware or app.' },
  { icon: '📊', head: 'Fill-rate analytics', body: 'Track sellout pace, average fill, and settlement history per show.' },
  { icon: '🗓️', head: 'Event creator', body: 'Publish a show with price, capacity, and lineup split in minutes.' },
  { icon: '✓', head: 'AI page, built for you', body: "Paste your room's details and a few photos — the AI Page Creator drafts your venue page in one pass." },
];

export default async function VenueKitPage() {
  const inviteOnly = await isInviteCodeRequiredRuntime();

  return (
    <div className="lp-wrap">
      <section className="lp-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2.5rem', alignItems: 'center', paddingBottom: 0 }}>
        <div>
          <p className="lp-hero-eyebrow" style={{ color: ROLE_COLOR }}>FOR VENUES · LIVE 2026</p>
          <h1 className="lp-hero-h">Your room. Your booking. <span style={{ color: ROLE_COLOR }}>Your data.</span></h1>
          <p className="lp-hero-sub">
            iHYPE guarantees you <strong style={{ color: 'var(--text)' }}>20% of every gate</strong>, real demand data on who your city wants to see, and a booking inbox that keeps every offer in one place.
          </p>
        </div>
        <KitApplyForm
          role="VENUE"
          roleColor={ROLE_COLOR}
          inviteOnly={inviteOnly}
          heading="Apply as a venue"
          intro="We're onboarding a small founding cohort. Tell us about your room."
          fields={[
            { key: 'type', label: 'Room type', placeholder: 'Room type', type: 'select', options: ['Standing room', 'Seated venue', 'All-ages hall', 'Bar / club', 'Outdoor space', 'Other'] },
            { key: 'capacity', label: 'Capacity', placeholder: 'Capacity' },
            { key: 'city', label: 'City', placeholder: 'City' },
          ]}
          applyLabel="Request venue access →"
          successIcon="🏛️"
          successTitle="Application received."
          successBody="We'll reach out within 48 hours with your invite code and booking-inbox walkthrough."
          openLabel="Join as a venue →"
          openHref="/register?role=VENUE"
        />
      </section>

      <section className="lp-stats" style={{ marginTop: '-40px' }}>
        {[
          { val: '20%', label: 'Your gate · guaranteed' },
          { val: '$0', label: 'Platform fee to list' },
          { val: 'Live', label: 'Demand radar by city' },
          { val: '24h', label: 'Settlement turnaround' },
        ].map((s) => (
          <div className="lp-stat" key={s.label}>
            <div className="lp-stat-val" style={{ color: ROLE_COLOR }}>{s.val}</div>
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: ROLE_COLOR }}>THE CHARTER</p>
        <h2 className="lp-section-head">Book who your city is actually hyping — not a guess.</h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, margin: '20px 0 0', padding: 0 }}>
          {[
            'See real hype and streaming demand before you book',
            'Manage every booking offer in one inbox',
            'Your 20% locks the moment the show publishes',
            'QR check-in at the door — no separate scanner app',
            'No booking agent required to list a room',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: '.95rem', lineHeight: 1.5, color: 'var(--text)' }}>
              <span style={{ color: ROLE_COLOR, fontFamily: 'var(--font-display)', fontWeight: 800, flexShrink: 0 }}>✓</span>{item}
            </li>
          ))}
        </ul>
        <p className="lp-hype-body" style={{ marginTop: 24 }}>
          None of this works without fans walking through the door. iHYPE&apos;s whole job is getting the ones who already hype your shows to actually show up and buy — <Link href="/fans" style={{ color: ROLE_COLOR }}>see how fans fit in →</Link>
        </p>
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: ROLE_COLOR }}>WHAT YOU GET</p>
        <h2 className="lp-section-head">Tools built for booking rooms.</h2>
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
