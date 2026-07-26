import type { Metadata } from 'next';
import { RecruitingKitPage, type RecruitingKitConfig } from '@/components/RecruitingKitPage';
import { getCityHeatForRole } from '@/lib/recruiting-kit';

export const metadata: Metadata = {
  title: 'For DJs · iHYPE',
  description: 'A free radio studio, an opt-in crate, and a referral cut every time a fan you drove buys a ticket.',
};

const config: RecruitingKitConfig = {
  role: 'DJ',
  tint: 'var(--role-dj, #ff3e9a)',
  glow: '#ff3e9a',
  navCta: 'Apply as a DJ →',
  eyebrow: 'For DJs',
  headline: <>Your crate.<br />Your show.<br /><span style={{ color: 'var(--role-dj, #ff3e9a)' }}>Your cut.</span></>,
  heroBody: (
    <>iHYPE gives you a <strong>free radio studio</strong>, a crate of tracks artists have opted into radio play, and a referral link that pays you every time a fan you drove buys a ticket.</>
  ),
  applyHeading: 'Apply as a DJ',
  applySub: 'Set up your DJ page and start hosting radio shows.',
  applyCta: 'Get started as a DJ →',
  applyFinePrint: 'No spam. 0% platform fee, always.',
  stats: [
    { value: '$0', label: 'Studio & hosting cost' },
    { value: '10%', label: 'Promoter pool share' },
    { value: '100%', label: 'Artist opt-in library' },
    { value: '24h', label: 'Referral payout turnaround' },
  ],
  heatLabel: 'Where listeners are hottest right now',
  quote: <>Radio that <span>pays the DJ</span> — imagine that.</>,
  checklist: [
    'Build a live or recorded show from your phone',
    'Crate tracks artists have opted into radio play — no clearance calls',
    'Share a HYPE Link and earn your share of the 10% promoter pool',
    "Earnings settle automatically — never the artist's 70%",
    'No agent or label needed to go live',
  ],
  featuresEyebrow: 'What you get',
  featuresHeadline: 'Tools built for working DJs.',
  features: [
    { emoji: '📻', title: 'Radio studio', body: 'Record or go live straight from iHYPE — no separate streaming setup.' },
    { emoji: '🎚️', title: 'Opt-in crate', body: 'A growing library of tracks artists have opted into radio play, cleared for on-platform spins.' },
    { emoji: '🔗', title: 'HYPE Link earnings', body: 'Share any show. Earn your proportional cut of the 10% promoter pool.' },
    { emoji: '📊', title: 'Listener analytics', body: 'See peak listeners, top shows, and referral earnings in one dashboard.' },
    { emoji: '🗓️', title: 'Show scheduler', body: 'Set a weekly slot or one-off session — fans get a reminder when you go live.' },
    { emoji: '✓', title: 'AI page, built for you', body: 'Paste a bio and a set link — the AI Page Creator drafts your public profile in one pass.' },
  ],
  fanFitBody: (
    <>None of this works without listeners tuning in. iHYPE&rsquo;s whole job is getting the fans who already like your sound to hype your show, click your link, and come back next week &mdash; <a href="/for-fans">see how fans fit in →</a></>
  ),
};

export default async function ForDjsPage() {
  const cityHeat = await getCityHeatForRole(['DJ']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
