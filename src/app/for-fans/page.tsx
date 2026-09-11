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
  tint: 'var(--role-fan)',
  glow: 'var(--role-fan)',
  navCta: t('forFansPage.navCta', 'Join free →'),
  eyebrow: t('forFansPage.eyebrow', 'For Fans'),
  headline: <>{t('forFansPage.headlineLine1', 'Your taste.')}<br />{t('forFansPage.headlineLine2', 'Your voice.')}<br /><span style={{ color: 'var(--role-fan)' }}>{t('forFansPage.headlineLine3', 'Your cut.')}</span></>,
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
    t('forFansPage.checklistStation', 'A free station that plays the artists on here, no subscription'),
    t('forFansPage.checklist5', 'One member, one vote — spend never buys more influence'),
  ],
  featuresEyebrow: t('forFansPage.featuresEyebrow', 'What you get'),
  featuresHeadline: t('forFansPage.featuresHeadline', 'Everything a fan actually wants.'),
  /* Three of these six were not true (2026-09-11). "Live radio — any DJ's
     live or recorded show" survives from a product that had a DJ role
     (deleted 2026-08-06) and member broadcasts, removed with it — no such
     show can exist. The
     AI page generator was deleted by owner instruction on 2026-09-01. And
     HYPE is not "a weekly flame budget" — it is a 24-hour window per act
     (`HYPE_WINDOW_MS`), which is a better story anyway: it is what makes one
     member one vote. Keys renamed where the meaning changed. */
  features: [
    { title: t('forFansPage.feature1Title', 'HYPE mechanic'), body: t('forFansPage.featureHypeBodyWindow', 'Back an act and it counts as a real demand signal. One hype per act per day, so the loudest wallet never outvotes the room.') },
    { title: t('forFansPage.feature2Title', 'Direct ticketing'), body: t('forFansPage.feature2Body', 'Face value, QR wallet, zero scalper markup — buy straight from the artist.') },
    { title: t('forFansPage.feature3Title', 'Promoter earnings'), body: t('forFansPage.feature3Body', 'Share any show. Earn your proportional cut of the 10% promoter pool.') },
    { title: t('forFansPage.featureStationTitle', 'A station that never stops'), body: t('forFansPage.featureStationBody', 'Always-on audio drawn from the artists on here, free and with no paywall — ad breaks between songs, never cutting one short.') },
    { title: t('forFansPage.feature5Title', 'Seeds discovery'), body: t('forFansPage.feature5Body', 'A taste-matched swipe deck that surfaces artists before they blow up.') },
    { title: t('forFansPage.featureAskTitle', 'Ask a venue to book them'), body: t('forFansPage.featureAskBody', 'Name an act and a room near you. Enough asks and the venue sees it on their booking radar — and you get told if they book the show.') },
  ],
  };
}

export default async function ForFansPage() {
  const t = await getServerT();
  const config = buildConfig(t);
  const cityHeat = await getCityHeatForRole(['ARTIST', 'VENUE']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
