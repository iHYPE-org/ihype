import type { Metadata } from 'next';
import { RecruitingKitPage, type RecruitingKitConfig } from '@/components/RecruitingKitPage';
import { getCityHeatForRole } from '@/lib/recruiting-kit';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'For DJs · iHYPE',
  description: 'A free radio studio, an opt-in crate, and a referral cut every time a fan you drove buys a ticket.',
};

function buildConfig(t: Awaited<ReturnType<typeof getServerT>>): RecruitingKitConfig {
  return {
  role: 'DJ',
  tint: 'var(--role-dj, #ff3e9a)',
  glow: '#ff3e9a',
  navCta: t('forDjsPage.navCta', 'Apply as a DJ →'),
  eyebrow: t('forDjsPage.eyebrow', 'For DJs'),
  headline: <>{t('forDjsPage.headlineLine1', 'Your crate.')}<br />{t('forDjsPage.headlineLine2', 'Your show.')}<br /><span style={{ color: 'var(--role-dj, #ff3e9a)' }}>{t('forDjsPage.headlineLine3', 'Your cut.')}</span></>,
  heroBody: (
    <>{t('forDjsPage.heroBodyLead', 'iHYPE gives you a')} <strong>{t('forDjsPage.heroBodyStrong', 'free radio studio')}</strong>{t('forDjsPage.heroBodyRest', ', a crate of tracks artists have opted into radio play, and a referral link that pays you every time a fan you drove buys a ticket.')}</>
  ),
  applyHeading: t('forDjsPage.applyHeading', 'Apply as a DJ'),
  applySub: t('forDjsPage.applySub', 'Set up your DJ page and start hosting radio shows.'),
  applyCta: t('forDjsPage.applyCta', 'Get started as a DJ →'),
  applyFinePrint: t('forDjsPage.applyFinePrint', 'No spam. 0% platform fee, always.'),
  stats: [
    { value: '$0', label: t('forDjsPage.stat1Label', 'Studio & hosting cost') },
    { value: '10%', label: t('forDjsPage.stat2Label', 'Promoter pool share') },
    { value: '100%', label: t('forDjsPage.stat3Label', 'Artist opt-in library') },
    { value: '24h', label: t('forDjsPage.stat4Label', 'Referral payout turnaround') },
  ],
  heatLabel: t('forDjsPage.heatLabel', 'Where listeners are hottest right now'),
  quote: <>{t('forDjsPage.quoteLead', 'Radio that')} <span>{t('forDjsPage.quoteEmphasis', 'pays the DJ')}</span>{t('forDjsPage.quoteRest', ' — imagine that.')}</>,
  checklist: [
    t('forDjsPage.checklist1', 'Build a live or recorded show from your phone'),
    t('forDjsPage.checklist2', 'Crate tracks artists have opted into radio play — no clearance calls'),
    t('forDjsPage.checklist3', 'Share a HYPE Link and earn your share of the 10% promoter pool'),
    t('forDjsPage.checklist4', "Earnings settle automatically — never the artist's 70%"),
    t('forDjsPage.checklist5', 'No agent or label needed to go live'),
  ],
  featuresEyebrow: t('forDjsPage.featuresEyebrow', 'What you get'),
  featuresHeadline: t('forDjsPage.featuresHeadline', 'Tools built for working DJs.'),
  features: [
    { emoji: '📻', title: t('forDjsPage.feature1Title', 'Radio studio'), body: t('forDjsPage.feature1Body', 'Record or go live straight from iHYPE — no separate streaming setup.') },
    { emoji: '🎚️', title: t('forDjsPage.feature2Title', 'Opt-in crate'), body: t('forDjsPage.feature2Body', 'A growing library of tracks artists have opted into radio play, cleared for on-platform spins.') },
    { emoji: '🔗', title: t('forDjsPage.feature3Title', 'HYPE Link earnings'), body: t('forDjsPage.feature3Body', 'Share any show. Earn your proportional cut of the 10% promoter pool.') },
    { emoji: '📊', title: t('forDjsPage.feature4Title', 'Listener analytics'), body: t('forDjsPage.feature4Body', 'See peak listeners, top shows, and referral earnings in one dashboard.') },
    { emoji: '🗓️', title: t('forDjsPage.feature5Title', 'Show scheduler'), body: t('forDjsPage.feature5Body', 'Set a weekly slot or one-off session — fans get a reminder when you go live.') },
    { emoji: '✓', title: t('forDjsPage.feature6Title', 'AI page, built for you'), body: t('forDjsPage.feature6Body', 'Paste a bio and a set link — the AI Page Creator drafts your public profile in one pass.') },
  ],
  fanFitBody: (
    <>{t('forDjsPage.fanFitLead', 'None of this works without listeners tuning in. iHYPE’s whole job is getting the fans who already like your sound to hype your show, click your link, and come back next week —')} <a href="/for-fans">{t('forDjsPage.fanFitLink', 'see how fans fit in →')}</a></>
  ),
  };
}

export default async function ForDjsPage() {
  const t = await getServerT();
  const config = buildConfig(t);
  const cityHeat = await getCityHeatForRole(['DJ']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
