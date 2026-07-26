import type { Metadata } from 'next';
import { RecruitingKitPage, type RecruitingKitConfig } from '@/components/RecruitingKitPage';
import { getCityHeatForRole } from '@/lib/recruiting-kit';

export const metadata: Metadata = {
  title: 'For Fans · iHYPE',
  description: 'Hype the artists you love, buy tickets at face value with zero platform fee, and earn a cut when you share.',
};

const config: RecruitingKitConfig = {
  role: 'FAN',
  tint: 'var(--role-fan, #b983ff)',
  glow: '#b983ff',
  navCta: 'Join free →',
  eyebrow: 'For Fans',
  headline: <>Your taste.<br />Your voice.<br /><span style={{ color: 'var(--role-fan, #b983ff)' }}>Your cut.</span></>,
  heroBody: (
    <>Hype the artists you love before anyone else catches on, buy tickets <strong>at face value with zero platform fee</strong>, and earn a real cut every time someone buys through your link.</>
  ),
  applyHeading: 'Join as a fan',
  applySub: "Free, always. Follow artists, hype shows, and get your first recommendations.",
  applyCta: 'Create free account →',
  applyFinePrint: 'No spam. iHYPE takes $0 — ever.',
  stats: [
    { value: '$0', label: 'iHYPE fee, ever' },
    { value: '10%', label: 'Max promoter share' },
    { value: 'Free', label: 'Radio, always' },
    { value: '1', label: 'Vote, one member' },
  ],
  heatLabel: 'Where fans are hyping the hardest',
  quote: <>Your HYPE is a <span>real vote</span> — not a like button.</>,
  checklist: [
    'Every hype is a real demand signal artists and venues see',
    'Buy tickets direct — face value, no service fees',
    'Share a HYPE Link and earn from the 10% promoter pool',
    "Free radio — every DJ's show, no subscription",
    'One member, one vote — spend never buys more influence',
  ],
  featuresEyebrow: 'What you get',
  featuresHeadline: 'Everything a fan actually wants.',
  features: [
    { emoji: '🔥', title: 'HYPE mechanic', body: 'A weekly flame budget — back the artists you believe in before anyone else does.' },
    { emoji: '🎟️', title: 'Direct ticketing', body: 'Face value, QR wallet, zero scalper markup — buy straight from the artist.' },
    { emoji: '💸', title: 'Promoter earnings', body: 'Share any show. Earn your proportional cut of the 10% promoter pool.' },
    { emoji: '📻', title: 'Live radio', body: "Tune into any DJ's live or recorded show, free — no paywall, ever." },
    { emoji: '🌱', title: 'Seeds discovery', body: 'A taste-matched swipe deck that surfaces artists before they blow up.' },
    { emoji: '📄', title: 'Your own page', body: 'Fan-promoters get an AI-built page too — show off what you’ve discovered.' },
  ],
};

export default async function ForFansPage() {
  const cityHeat = await getCityHeatForRole(['ARTIST', 'DJ', 'VENUE']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
