import type { Metadata } from 'next';
import { RecruitingKitPage, type RecruitingKitConfig } from '@/components/RecruitingKitPage';
import { getCityHeatForRole } from '@/lib/recruiting-kit';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'For Venues · iHYPE',
  description: '20% of every gate, real demand data on who your city wants to see, and one booking inbox.',
};

function buildConfig(t: Awaited<ReturnType<typeof getServerT>>): RecruitingKitConfig {
  return {
  role: 'VENUE',
  tint: 'var(--role-venue)',
  glow: 'var(--role-venue)',
  navCta: t('forVenuesPage.navCta', 'Apply as a venue →'),
  eyebrow: t('forVenuesPage.eyebrow', 'For Venues'),
  headline: <>{t('forVenuesPage.headlineLine1', 'Your room.')}<br />{t('forVenuesPage.headlineLine2', 'Your booking.')}<br /><span style={{ color: 'var(--role-venue)' }}>{t('forVenuesPage.headlineLine3', 'Your data.')}</span></>,
  heroBody: (
    <>{t('forVenuesPage.heroBodyLead', 'iHYPE guarantees you')} <strong>{t('forVenuesPage.heroBodyStrong', '20% of every gate')}</strong>{t('forVenuesPage.heroBodyRest', ', real demand data on who your city wants to see, and a booking inbox that keeps every offer in one place.')}</>
  ),
  applyHeading: t('forVenuesPage.applyHeading', 'Apply as a venue'),
  applySub: t('forVenuesPage.applySub', 'Set up your venue page and start booking shows on your own terms.'),
  applyCta: t('forVenuesPage.applyCta', 'Get started as a venue →'),
  applyFinePrint: t('forVenuesPage.applyFinePrint', 'No spam. 0% platform fee, always.'),
  stats: [
    { value: '20%', label: t('forVenuesPage.stat1Label', 'Your gate · guaranteed') },
    { value: '$0', label: t('forVenuesPage.stat2Label', 'Platform fee to list') },
    { value: 'Live', label: t('forVenuesPage.stat3Label', 'Demand radar by city') },
    { value: '24h', label: t('forVenuesPage.stat4Label', 'Settlement turnaround') },
  ],
  heatLabel: t('forVenuesPage.heatLabel', 'Where fans are asking for shows'),
  quote: <>{t('forVenuesPage.quoteLead', 'Book who your city is')} <span>{t('forVenuesPage.quoteEmphasis', 'actually hyping')}</span>{t('forVenuesPage.quoteRest', ' — not a guess.')}</>,
  checklist: [
    t('forVenuesPage.checklist1', 'See real hype and streaming demand before you book'),
    t('forVenuesPage.checklist2', 'Manage every booking offer in one inbox'),
    t('forVenuesPage.checklist3', 'Your 20% locks the moment the show publishes'),
    t('forVenuesPage.checklist4', 'QR check-in at the door — no separate scanner app'),
    t('forVenuesPage.checklist5', 'No booking agent required to list a room'),
  ],
  featuresEyebrow: t('forVenuesPage.featuresEyebrow', 'What you get'),
  featuresHeadline: t('forVenuesPage.featuresHeadline', 'Tools built for booking rooms.'),
  features: [
    { title: t('forVenuesPage.feature1Title', 'Demand radar'), body: t('forVenuesPage.feature1Body', 'See which artists your city is hyping before you commit a date.') },
    { title: t('forVenuesPage.feature2Title', 'Booking inbox'), body: t('forVenuesPage.feature2Body', 'Every artist and promoter request lands in one Pending/Accepted/Declined view.') },
    /* The door line undersold a capability that had since been built, and the
       last two overstated ones that had not (2026-09-11). "AI page, built for
       you — the AI Page Creator drafts your venue page in one pass" names a
       generator deleted on 2026-08-11 and finished off on 2026-09-01 by owner
       instruction; only `/api/page-builder/ad-recs` survives, so a venue
       following that sentence finds a plain form. "Sellout pace" and
       "settlement history per show" overstate a dashboard that reports
       tickets sold against capacity, this month's earnings and the next
       payout — so the claim is trimmed to what it really shows. */
    { title: t('forVenuesPage.featureDoorTitle', 'A door that works with no signal'), body: t('forVenuesPage.featureDoorBody', "Scan tickets with the camera on a phone — no hardware, no app. Download the night's guest list first and it keeps admitting people when the basement has no bars, then syncs when it comes back.") },
    { title: t('forVenuesPage.featureFillTitle', 'Fill and takings per show'), body: t('forVenuesPage.featureFillBody', 'Tickets sold against capacity on every date, what you have earned this month, and when the next payout lands.') },
    { title: t('forVenuesPage.feature5Title', 'Event creator'), body: t('forVenuesPage.feature5Body', 'Publish a show with price, capacity, and lineup split in minutes.') },
    { title: t('forVenuesPage.featureAsksTitle', 'Fans asking for acts by name'), body: t('forVenuesPage.featureAsksBody', 'Fans request the artists they want in your room. Each ask is weighed by how recent it is, how many separate people made it and how close they live — including acts you have never heard of.') },
  ],
  fanFitBody: (
    <>{t('forVenuesPage.fanFitLead', 'None of this works without fans walking through the door. iHYPE’s whole job is getting the ones who already hype your shows to actually show up and buy —')} <a href="/for-fans">{t('forVenuesPage.fanFitLink', 'see how fans fit in →')}</a></>
  ),
  };
}

export default async function ForVenuesPage() {
  const t = await getServerT();
  const config = buildConfig(t);
  const cityHeat = await getCityHeatForRole(['VENUE']);
  return <RecruitingKitPage config={config} cityHeat={cityHeat} />;
}
