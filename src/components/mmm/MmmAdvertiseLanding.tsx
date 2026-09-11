import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';
import type { Translate } from '@/lib/mmm-shell-labels';

/* The eligible categories, declared once in English and translated at the
   draw — the `mmm-shell-labels.ts` rule, because `extract-i18n-keys.mjs`
   reads only a literal `t('key', 'English')` and could never see
   `t(entry.key, entry.label)`. */
const ELIGIBLE = ['Artists and labels', 'Venues and promoters', 'Gear and instruments', 'Ticketing and merch', 'Tour and production services'];

function eligibleLabel(t: Translate, label: string): string {
  switch (label) {
    case 'Artists and labels': return t('mmmAdvertiseLanding.eligibleLabels', 'Artists and labels');
    case 'Venues and promoters': return t('mmmAdvertiseLanding.eligibleVenues', 'Venues and promoters');
    case 'Gear and instruments': return t('mmmAdvertiseLanding.eligibleGear', 'Gear and instruments');
    case 'Ticketing and merch': return t('mmmAdvertiseLanding.eligibleTicketing', 'Ticketing and merch');
    case 'Tour and production services': return t('mmmAdvertiseLanding.eligibleTour', 'Tour and production services');
    default: return label;
  }
}

export async function MmmAdvertiseLanding() {
  const t = await getServerT();
  return (
    <main className="mmm-ad-landing">
      <section className="mmm-ad-hero">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{t('mmmAdvertiseLanding.eyebrow', 'Advertise on iHYPE')}</p>
        <h1>{t('mmmAdvertiseLanding.headlineOne', 'Reach music people.')}<br />{t('mmmAdvertiseLanding.headlineTwo', 'Skip the noise.')}</h1>
        {/* This lede read "schedule your spots" and step 01 read "set spots
            per day" — the RETIRED pricing model. Advertising moved to a flat
            monthly sponsorship on 2026-09-10 (DESIGN_SYNC row 384) and the
            builder this page leads to sells a reach tier and a term in
            months, so the storefront's own front page was quoting a model the
            product had stopped selling. Keep this copy and `ad-pricing.ts`
            saying the same thing. */}
        <p className="mmm-ad-lead">{t('mmmAdvertiseLanding.lead', 'Self-serve audio sponsorships for the music industry. Choose your reach, pick a term and see the full price before checkout.')}</p>
        <div className="mmm-ad-actions">
          <Link className="mmm-btn-primary" href="/advertise/register">{t('mmmAdvertiseLanding.createAccount', 'Create advertiser account')}</Link>
          <Link className="mmm-btn-ghost" href="/login?callbackUrl=/app/me/advertising">{t('mmmAdvertiseLanding.signIn', 'Sign in')}</Link>
        </div>
      </section>

      <section aria-labelledby="ad-how" className="mmm-ad-section">
        <p className="mmm-eyebrow">{t('mmmAdvertiseLanding.howEyebrow', 'How it works')}</p>
        <h2 id="ad-how">{t('mmmAdvertiseLanding.howTitle', 'Build, screen, run.')}</h2>
        <div className="mmm-ad-steps">
          <article><span>01</span><h3>{t('mmmAdvertiseLanding.step1Title', 'Choose the audience')}</h3><p>{t('mmmAdvertiseLanding.step1Body', 'Target local, regional, national or worldwide listeners, and pick a term of one to twelve months.')}</p></article>
          <article><span>02</span><h3>{t('mmmAdvertiseLanding.step2Title', 'Upload the audio')}</h3><p>{t('mmmAdvertiseLanding.step2Body', 'Add a radio-style audio spot and destination link. iHYPE does not host video.')}</p></article>
          <article><span>03</span><h3>{t('mmmAdvertiseLanding.step3Title', 'Clear screening')}</h3><p>{t('mmmAdvertiseLanding.step3Body', 'Eligibility, relevance, safety, copyright and claims are checked before payment.')}</p></article>
        </div>
      </section>

      <section aria-labelledby="ad-who" className="mmm-ad-section mmm-ad-eligibility">
        <div>
          <p className="mmm-eyebrow">{t('mmmAdvertiseLanding.whoEyebrow', 'Music industry only')}</p>
          <h2 id="ad-who">{t('mmmAdvertiseLanding.whoTitle', 'Who can advertise')}</h2>
          <p>{t('mmmAdvertiseLanding.whoBody', 'Campaigns must directly serve artists, venues, shows or music listeners. General retail, financial products and unrelated services are rejected.')}</p>
        </div>
        <ul>{ELIGIBLE.map((item) => <li key={item}>{eligibleLabel(t, item)}</li>)}</ul>
      </section>

      <section className="mmm-ad-final">
        <h2>{t('mmmAdvertiseLanding.finalTitle', 'Ready to build your first campaign?')}</h2>
        <p>{t('mmmAdvertiseLanding.finalBody', 'No sales call and no contract. Create an account, verify the business and review pricing in the builder.')}</p>
        <Link className="mmm-btn-primary" href="/advertise/register">{t('mmmAdvertiseLanding.getStarted', 'Get started')}</Link>
      </section>
    </main>
  );
}
