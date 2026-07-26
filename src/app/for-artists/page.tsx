import type { Metadata } from 'next';
import { RecruitingKitPage, type RecruitingKitConfig } from '@/components/RecruitingKitPage';
import { getCityHeatForRole } from '@/lib/recruiting-kit';

export const metadata: Metadata = {
  title: 'For Artists · iHYPE',
  description: '70% of every ticket, your fans’ contact info, and tools to run your own shows.',
};

const config: RecruitingKitConfig = {
  role: 'ARTIST',
  tint: 'var(--accent)',
  glow: 'var(--accent)',
  navCta: 'Apply as artist →',
  eyebrow: 'For Artists',
  headline: <>Your music.<br />Your gate.<br /><span style={{ color: 'var(--accent)' }}>Your fans.</span></>,
  heroBody: (
    <>iHYPE gives you <strong>70% of every ticket</strong>, your fans&rsquo; contact info, and tools to run your own shows &mdash; no agent, no Ticketmaster, no platform that owns the relationship.</>
  ),
  applyHeading: 'Apply as an artist',
  applySub: 'Set up your artist page and start selling tickets on your own terms.',
  applyCta: 'Get started as an artist →',
  applyFinePrint: 'No spam. 0% platform fee, always.',
  stats: [
    { value: '70%', label: 'Your gate · locked' },
    { value: '$0', label: 'Platform fee on tickets' },
    { value: '100%', label: 'Fan data ownership' },
    { value: '24h', label: 'Payout turnaround' },
  ],
  heatLabel: 'Where fan demand is hottest right now',
  quote: <>A charter that can&rsquo;t be <span>unwritten</span> after the first ticket sells.</>,
  checklist: [
    'Set your price and split before publish',
    'Once a ticket sells, the split is sealed',
    'Your 70% hits your account night of show',
    'Full fan email list after every event',
    'No agent or manager needed to list',
  ],
  featuresEyebrow: 'What you get',
  featuresHeadline: 'Tools built for touring artists.',
  features: [
    { emoji: '🎟️', title: 'Direct ticketing', body: 'List a show in minutes. Fans buy direct — no Ticketmaster. QR wallets handled.' },
    { emoji: '📊', title: 'Fan data dashboard', body: "See who came, who bought first, who's hyping you. Export your list after every show." },
    { emoji: '🔴', title: 'Live show hosting', body: 'Go live directly from iHYPE — listener count, hype pulse, live chat.' },
    { emoji: '📻', title: 'Radio-eligible tracks', body: "Opt each track into the DJ crate pool at upload to reach new listeners through radio shows — or opt out if you're not ready." },
    { emoji: '🗺️', title: 'Tour creator', body: 'Build a tour, set dates across cities, manage all events from one dashboard.' },
    { emoji: '✓', title: 'Verification badge', body: 'Apply for a verified artist badge. Appears on your profile, events, and all iHYPE surfaces.' },
  ],
  fanFitBody: (
    <>None of this works without fans in the room. iHYPE&rsquo;s whole job is getting the ones who already believe in you to hype, buy, and bring a friend &mdash; <a href="/for-fans">see how fans fit in →</a></>
  ),
};

export default async function ForArtistsPage() {
  const cityHeat = await getCityHeatForRole(['ARTIST']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
