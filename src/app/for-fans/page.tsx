import type { Metadata } from 'next';
import { RecruitingKitPage, type RecruitingKitConfig } from '@/components/RecruitingKitPage';
import { getCityHeatForRole } from '@/lib/recruiting-kit';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'For Fans · iHYPE',
  description: 'Hype the artists you love, buy tickets at face value with zero platform fee, and earn a cut when you share.',
};

function buildConfig(t: Awaited<ReturnType<typeof getServerT>>): RecruitingKitConfig {
  return {
  role: 'FAN',
  tint: 'var(--role-fan, #b983ff)',
  glow: '#b983ff',
  navCta: t('forFansPage.navCta', 'Join free →'),
  eyebrow: t('forFansPage.eyebrow', 'For Fans'),
  headline: <>{t('forFansPage.headlineLine1', 'Your taste.')}<br />{t('forFansPage.headlineLine2', 'Your voice.')}<br /><span style={{ color: 'var(--role-fan, #b983ff)' }}>{t('forFansPage.headlineLine3', 'Your cut.')}</span></>,
  heroBody: (
    <>{t('forFansPage.heroBodyLead', 'Hype the artists you love before anyone else catches on, buy tickets')} <strong>{t('forFansPage.heroBodyStrong', 'at face value with zero platform fee')}</strong>{t('forFansPage.heroBodyRest', ', and earn a real cut every time someone buys through your link.')}</>
  ),
  applyHeading: t('forFansPage.applyHeading', 'Join as a fan'),
  applySub: t('forFansPage.applySub', 'Free, always. Follow artists, hype shows, and get your first recommendations.'),
  applyCta: t('forFansPage.applyCta', 'Create free account →'),
  applyFinePrint: t('forFansPage.applyFinePrint', 'No spam. iHYPE takes $0 — ever.'),
  stats: [
    { value: '$0', label: t('forFansPage.stat1Label', 'iHYPE fee, ever') },
    { value: '10%', label: t('forFansPage.stat2Label', 'Max promoter share') },
    { value: 'Free', label: t('forFansPage.stat3Label', 'Radio, always') },
    { value: '1', label: t('forFansPage.stat4Label', 'Vote, one member') },
  ],
  heatLabel: t('forFansPage.heatLabel', 'Where fans are hyping the hardest'),
  quote: <>{t('forFansPage.quoteLead', 'Your HYPE is a')} <span>{t('forFansPage.quoteEmphasis', 'real vote')}</span>{t('forFansPage.quoteRest', ' — not a like button.')}</>,
  checklist: [
    t('forFansPage.checklist1', 'Every hype is a real demand signal artists and venues see'),
    t('forFansPage.checklist2', 'Buy tickets direct — face value, no service fees'),
    t('forFansPage.checklist3', 'Share a HYPE Link and earn from the 10% promoter pool'),
    t('forFansPage.checklist4', "Free radio — every DJ's show, no subscription"),
    t('forFansPage.checklist5', 'One member, one vote — spend never buys more influence'),
  ],
  featuresEyebrow: t('forFansPage.featuresEyebrow', 'What you get'),
  featuresHeadline: t('forFansPage.featuresHeadline', 'Everything a fan actually wants.'),
  features: [
    { emoji: '🔥', title: t('forFansPage.feature1Title', 'HYPE mechanic'), body: t('forFansPage.feature1Body', 'A weekly flame budget — back the artists you believe in before anyone else does.') },
    { emoji: '🎟️', title: t('forFansPage.feature2Title', 'Direct ticketing'), body: t('forFansPage.feature2Body', 'Face value, QR wallet, zero scalper markup — buy straight from the artist.') },
    { emoji: '💸', title: t('forFansPage.feature3Title', 'Promoter earnings'), body: t('forFansPage.feature3Body', 'Share any show. Earn your proportional cut of the 10% promoter pool.') },
    { emoji: '📻', title: t('forFansPage.feature4Title', 'Live radio'), body: t('forFansPage.feature4Body', "Tune into any DJ's live or recorded show, free — no paywall, ever.") },
    { emoji: '🌱', title: t('forFansPage.feature5Title', 'Seeds discovery'), body: t('forFansPage.feature5Body', 'A taste-matched swipe deck that surfaces artists before they blow up.') },
    { emoji: '📄', title: t('forFansPage.feature6Title', 'Your own page'), body: t('forFansPage.feature6Body', 'Fan-promoters get an AI-built page too — show off what you’ve discovered.') },
  ],
  };
}

export default async function ForFansPage() {
  const t = await getServerT();
  const config = buildConfig(t);
  const cityHeat = await getCityHeatForRole(['ARTIST', 'DJ', 'VENUE']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
