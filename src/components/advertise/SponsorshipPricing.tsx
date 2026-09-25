'use client';

import { useI18n } from '@/components/I18nProvider';
import {
  AD_SCOPES,
  AD_SCOPE_LABELS,
  SPONSORSHIP_MONTHLY_USD,
  SPONSORSHIP_TERMS_MONTHS,
} from '@/lib/ad-pricing';
import { REFUND_WINDOW_BUSINESS_DAYS } from '@/lib/ad-settlement-plan';
import { formatUsd, intlTag } from '@/lib/format-locale';
import { adScopeLabel } from '@/lib/i18n-enum-labels';
import { SCOPE_WEIGHTS } from '@/lib/ad-scope-mix';

/**
 * The price list, read straight from `ad-pricing.ts` so it can never quote a
 * number the builder does not charge (row 514).
 *
 * Before this the landing page described the model — "choose your reach, pick
 * a term and see the full price before checkout" — and never showed a price;
 * the only place a figure appeared was the builder, which the iOS and Android
 * apps may no longer show. Pricing is information, and the owner asked for the
 * apps to keep it ("let them sign up and learn about pricing"), so it lives
 * here, on the web and in the apps alike, and the builder stays the one place
 * that turns it into a checkout.
 */
export function SponsorshipPricing() {
  const { locale, t } = useI18n();
  const terms = formatTermList(locale, SPONSORSHIP_TERMS_MONTHS.map((months) => String(months)));

  return (
    <div className="mmm-ad-pricing">
      <table className="mmm-ad-pricing-table">
        <caption className="sr-only">{t('sponsorshipPricing.caption', 'Monthly price for each reach')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('sponsorshipPricing.reachColumn', 'Reach')}</th>
            <th scope="col">{t('sponsorshipPricing.priceColumn', 'Per month')}</th>
          </tr>
        </thead>
        <tbody>
          {AD_SCOPES.map((scope) => (
            <tr key={scope}>
              <th scope="row">{adScopeLabel(t, AD_SCOPE_LABELS[scope])}</th>
              <td className="mmm-ad-pricing-price">{formatUsd(locale, SPONSORSHIP_MONTHLY_USD[scope] * 100, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mmm-ad-pricing-notes">
        <li>{t('sponsorshipPricing.terms', 'Terms of {terms} months, paid in full at checkout.').replace('{terms}', terms)}</li>
        {/* What the station really does (src/lib/ad-scope-mix.ts): every break
            mixes the four reaches, weighted local-most, and sponsors in one
            reach share its slots. Nothing targets a listener by place — every
            listener hears the same station — so this list names no audience.
            The ratio is read from the weights, so the sentence cannot drift. */}
        <li>{t('sponsorshipPricing.breakMix', 'Every ad break mixes all four reaches, weighted toward local: about {ratio} local slots for every global one. Sponsors in the same reach share its slots equally.').replace('{ratio}', String(SCOPE_WEIGHTS.local / SCOPE_WEIGHTS.global))}</li>
        <li>{t('sponsorshipPricing.neverDark', 'You are never billed per play, so a spot never goes dark part-way through its term.')}</li>
        <li>{t('sponsorshipPricing.refund', 'Cancel early and the days you have not used are refunded to your card, usually within {days} business days.').replace('{days}', String(REFUND_WINDOW_BUSINESS_DAYS))}</li>
        <li>{t('sponsorshipPricing.screening', 'Nothing is charged until your spot passes screening. iHYPE absorbs the card-processing fee.')}</li>
      </ul>
    </div>
  );
}

/** "1, 3, 6 or 12" in the reader's language, falling back to commas where Intl cannot. */
function formatTermList(locale: string, items: string[]): string {
  try {
    return new Intl.ListFormat(intlTag(locale), { type: 'disjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}
