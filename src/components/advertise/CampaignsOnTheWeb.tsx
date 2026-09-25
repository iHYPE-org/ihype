'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { SponsorshipPricing } from '@/components/advertise/SponsorshipPricing';
import { openOnWeb } from '@/components/advertise/openOnWeb';
import { WEB_CAMPAIGN_PATH } from '@/lib/native-app';

/**
 * What the iOS and Android apps show in place of the campaign builder (row 514).
 *
 * The apps may sign an advertiser up and show them pricing and their own
 * campaigns; building and paying for one happens on the web — Apple's
 * guidelines require in-app purchase for ads that play inside the same app,
 * and a Stripe checkout inside the app is exactly that. So this page says
 * where to go, shows the price list the builder would have quoted, and opens
 * the builder in a browser tab.
 */
export function CampaignsOnTheWeb() {
  const { t } = useI18n();
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    try {
      await openOnWeb(WEB_CAMPAIGN_PATH, { onReturn: () => router.push('/app/me/advertising') });
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="mmm-advertiser mmm-ad-web-only" data-web-only="campaigns">
      {/* No back link of its own: the ME layout's backstop (MmmMeRouteBack)
          already draws one on this route, and two stacked back links is the
          defect row 397 fixed on the notifications page. */}
      <p className="mmm-eyebrow mmm-eyebrow-accent">{t('advertisePage.heroEyebrow', 'Advertise on iHYPE')}</p>
      <h1>{t('campaignsOnTheWeb.title', 'Build your campaign on the web')}</h1>
      <p className="mmm-ad-web-only-lede">
        {t('campaignsOnTheWeb.lede', 'Campaigns are built and paid for on the iHYPE website, not in the app. The button below opens it in your browser; if it asks you to sign in, use this same account. Your campaign shows up here as soon as it is set up.')}
      </p>
      <div className="mmm-ad-web-only-actions">
        <button className="mmm-btn-primary" disabled={opening} onClick={() => void open()} type="button">
          {opening ? t('campaignsOnTheWeb.opening', 'Opening…') : t('campaignsOnTheWeb.open', 'Open ihype.org')}
        </button>
      </div>
      <p className="mmm-ad-web-only-hint">{t('campaignsOnTheWeb.computerHint', 'On a computer? Go to ihype.org/advertise and sign in.')}</p>
      <h2 className="mmm-section-label">{t('campaignsOnTheWeb.pricingTitle', 'Pricing')}</h2>
      <SponsorshipPricing />
    </div>
  );
}
