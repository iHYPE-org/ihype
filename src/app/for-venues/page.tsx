import type { Metadata } from 'next';
import { RecruitingKitPage, type RecruitingKitConfig } from '@/components/RecruitingKitPage';
import { getCityHeatForRole } from '@/lib/recruiting-kit';

export const metadata: Metadata = {
  title: 'For Venues · iHYPE',
  description: '20% of every gate, real demand data on who your city wants to see, and one booking inbox.',
};

const config: RecruitingKitConfig = {
  role: 'VENUE',
  tint: 'var(--role-venue, #22e5d4)',
  glow: '#22e5d4',
  navCta: 'Apply as a venue →',
  eyebrow: 'For Venues',
  headline: <>Your room.<br />Your booking.<br /><span style={{ color: 'var(--role-venue, #22e5d4)' }}>Your data.</span></>,
  heroBody: (
    <>iHYPE guarantees you <strong>20% of every gate</strong>, real demand data on who your city wants to see, and a booking inbox that keeps every offer in one place.</>
  ),
  applyHeading: 'Apply as a venue',
  applySub: 'Set up your venue page and start booking shows on your own terms.',
  applyCta: 'Get started as a venue →',
  applyFinePrint: 'No spam. 0% platform fee, always.',
  stats: [
    { value: '20%', label: 'Your gate · guaranteed' },
    { value: '$0', label: 'Platform fee to list' },
    { value: 'Live', label: 'Demand radar by city' },
    { value: '24h', label: 'Settlement turnaround' },
  ],
  heatLabel: 'Where fans are asking for shows',
  quote: <>Book who your city is <span>actually hyping</span> — not a guess.</>,
  checklist: [
    'See real hype and streaming demand before you book',
    'Manage every booking offer in one inbox',
    'Your 20% locks the moment the show publishes',
    'QR check-in at the door — no separate scanner app',
    'No booking agent required to list a room',
  ],
  featuresEyebrow: 'What you get',
  featuresHeadline: 'Tools built for booking rooms.',
  features: [
    { emoji: '📡', title: 'Demand radar', body: 'See which artists your city is hyping before you commit a date.' },
    { emoji: '📥', title: 'Booking inbox', body: 'Every artist and promoter request lands in one Pending/Accepted/Declined view.' },
    { emoji: '📱', title: 'QR door check-in', body: 'Scan tickets straight from a phone — no extra hardware or app.' },
    { emoji: '📈', title: 'Fill-rate analytics', body: 'Track sellout pace, average fill, and settlement history per show.' },
    { emoji: '🗓️', title: 'Event creator', body: 'Publish a show with price, capacity, and lineup split in minutes.' },
    { emoji: '✓', title: 'AI page, built for you', body: "Paste your room's details and a few photos — the AI Page Creator drafts your venue page in one pass." },
  ],
  fanFitBody: (
    <>None of this works without fans walking through the door. iHYPE&rsquo;s whole job is getting the ones who already hype your shows to actually show up and buy &mdash; <a href="/for-fans">see how fans fit in →</a></>
  ),
};

export default async function ForVenuesPage() {
  const cityHeat = await getCityHeatForRole(['VENUE']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
