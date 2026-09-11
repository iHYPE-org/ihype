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
  headline: <>{t('forArtistsPage.headlineLine1', 'Your music.')}<br />{t('forArtistsPage.headlineLine2', 'Your gate.')}<br /><span style={{ color: 'var(--accent-text)' }}>{t('forArtistsPage.headlineLine3', 'Your fans.')}</span></>,
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
    t('forArtistsPage.checklistCalendar', 'Tour dates and open nights on your profile'),
    t('forArtistsPage.checklist5', 'No agent or manager needed to list'),
  ],
  featuresEyebrow: t('forArtistsPage.featuresEyebrow', 'What you get'),
  featuresHeadline: t('forArtistsPage.featuresHeadline', 'Tools built for touring artists.'),
  /* EVERY LINE HERE IS A PROMISE MADE BEFORE ANYONE HAS SIGNED UP, and four
     of the six named things the product cannot do (2026-09-11). "Live show
     hosting — listener count, hype pulse, live chat" was three capabilities
     that have never existed in this codebase; "Tour creator" described a
     multi-city builder where the product has a date list; "Export your list
     after every show" named an endpoint that does not exist; and the fan
     dashboard promised "who came, who bought first", which nothing records.

     Replaced with capabilities that are real and were going unadvertised,
     rather than by shrinking the list — the row-385 rule, that two true
     benefits beat three with an invented one, does not mean a recruiting
     page has to get shorter. KEYS ARE RENAMED because the meanings changed:
     a positional `feature3Body` whose sentence is replaced leaves eleven
     dictionaries translating the retired claim. Semantic names also stop the
     next rewrite from silently reusing a slot. */
  features: [
    { title: t('forArtistsPage.feature1Title', 'Direct ticketing'), body: t('forArtistsPage.feature1Body', 'List a show in minutes. Fans buy direct — no Ticketmaster. QR wallets handled.') },
    { title: t('forArtistsPage.featureStatsTitle', 'Your real numbers'), body: t('forArtistsPage.featureStatsBody', 'Listens, completed listens, follows, hypes, tickets sold and past shows — every figure a count we actually store, and a dash where we have nothing rather than a zero.') },
    { title: t('forArtistsPage.featureReleasesTitle', 'Releases on your schedule'), body: t('forArtistsPage.featureReleasesBody', 'Put out a single or a whole album, now or on a date you set. Artwork per track or one cover for the album — your choice — and you can change or remove any of it later.') },
    { title: t('forArtistsPage.featureCrateTitle', 'Free-use crate, opt in or out'), body: t('forArtistsPage.featureCrateBody', 'Let promoters add a track to their playlists, and take that permission back whenever you want. Every upload is loudness-levelled so it sits right beside everything else.') },
    { title: t('forArtistsPage.featureDemandTitle', 'Where fans want you'), body: t('forArtistsPage.featureDemandBody', 'Fans ask venues to book you. Those asks are weighed by how recent they are, how many separate people made them and how close they live — and they show up in your analytics.') },
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
