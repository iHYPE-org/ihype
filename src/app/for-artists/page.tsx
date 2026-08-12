import type { Metadata } from 'next';
import { RecruitingKitPage, type RecruitingKitConfig } from '@/components/RecruitingKitPage';
import { getCityHeatForRole } from '@/lib/recruiting-kit';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'For Artists · iHYPE',
  description: '70% of every ticket, your fans’ contact info, and tools to run your own shows.',
};

function buildConfig(t: Awaited<ReturnType<typeof getServerT>>): RecruitingKitConfig {
  return {
  role: 'ARTIST',
  tint: 'var(--accent)',
  glow: 'var(--accent)',
  navCta: t('forArtistsPage.navCta', 'Apply as artist →'),
  eyebrow: t('forArtistsPage.eyebrow', 'For Artists'),
  headline: <>{t('forArtistsPage.headlineLine1', 'Your music.')}<br />{t('forArtistsPage.headlineLine2', 'Your gate.')}<br /><span style={{ color: 'var(--accent)' }}>{t('forArtistsPage.headlineLine3', 'Your fans.')}</span></>,
  heroBody: (
    <>{t('forArtistsPage.heroBodyLead', 'iHYPE gives you')} <strong>{t('forArtistsPage.heroBodyStrong', '70% of every ticket')}</strong>{t('forArtistsPage.heroBodyRest', ', your fans’ contact info, and tools to run your own shows — no agent, no Ticketmaster, no platform that owns the relationship.')}</>
  ),
  applyHeading: t('forArtistsPage.applyHeading', 'Apply as an artist'),
  applySub: t('forArtistsPage.applySub', 'Set up your artist page and start selling tickets on your own terms.'),
  applyCta: t('forArtistsPage.applyCta', 'Get started as an artist →'),
  applyFinePrint: t('forArtistsPage.applyFinePrint', 'No spam. 0% platform fee, always.'),
  stats: [
    { value: '70%', label: t('forArtistsPage.stat1Label', 'Your gate · locked') },
    { value: '$0', label: t('forArtistsPage.stat2Label', 'Platform fee on tickets') },
    { value: '100%', label: t('forArtistsPage.stat3Label', 'Fan data ownership') },
    { value: '24h', label: t('forArtistsPage.stat4Label', 'Payout turnaround') },
  ],
  heatLabel: t('forArtistsPage.heatLabel', 'Where fan demand is hottest right now'),
  quote: <>{t('forArtistsPage.quoteLead', 'A charter that can’t be')} <span>{t('forArtistsPage.quoteEmphasis', 'unwritten')}</span>{t('forArtistsPage.quoteRest', ' after the first ticket sells.')}</>,
  checklist: [
    t('forArtistsPage.checklist1', 'Set your price and split before publish'),
    t('forArtistsPage.checklist2', 'Once a ticket sells, the split is sealed'),
    t('forArtistsPage.checklist3', 'Your 70% hits your account night of show'),
    t('forArtistsPage.checklist4', 'Full fan email list after every event'),
    t('forArtistsPage.checklist5', 'No agent or manager needed to list'),
  ],
  featuresEyebrow: t('forArtistsPage.featuresEyebrow', 'What you get'),
  featuresHeadline: t('forArtistsPage.featuresHeadline', 'Tools built for touring artists.'),
  features: [
    { title: t('forArtistsPage.feature1Title', 'Direct ticketing'), body: t('forArtistsPage.feature1Body', 'List a show in minutes. Fans buy direct — no Ticketmaster. QR wallets handled.') },
    { title: t('forArtistsPage.feature2Title', 'Fan data dashboard'), body: t('forArtistsPage.feature2Body', "See who came, who bought first, who's hyping you. Export your list after every show.") },
    { title: t('forArtistsPage.feature3Title', 'Live show hosting'), body: t('forArtistsPage.feature3Body', 'Go live directly from iHYPE — listener count, hype pulse, live chat.') },
    { title: t('forArtistsPage.feature4Title', 'Radio-eligible tracks'), body: t('forArtistsPage.feature4Body', "Opt each track into the DJ crate pool at upload to reach new listeners through radio shows — or opt out if you're not ready.") },
    { title: t('forArtistsPage.feature5Title', 'Tour creator'), body: t('forArtistsPage.feature5Body', 'Build a tour, set dates across cities, manage all events from one dashboard.') },
    { title: t('forArtistsPage.feature6Title', 'Verification badge'), body: t('forArtistsPage.feature6Body', 'Apply for a verified artist badge. Appears on your profile, events, and all iHYPE surfaces.') },
  ],
  fanFitBody: (
    <>{t('forArtistsPage.fanFitLead', 'None of this works without fans in the room. iHYPE’s whole job is getting the ones who already believe in you to hype, buy, and bring a friend —')} <a href="/for-fans">{t('forArtistsPage.fanFitLink', 'see how fans fit in →')}</a></>
  ),
  };
}

export default async function ForArtistsPage() {
  const t = await getServerT();
  const config = buildConfig(t);
  const cityHeat = await getCityHeatForRole(['ARTIST']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
