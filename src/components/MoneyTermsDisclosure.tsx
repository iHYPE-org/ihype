'use client';

import { useI18n } from '@/components/I18nProvider';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { MONEY_TERMS_FACTS, moneyTermsExample, type MoneyTermsRole } from '@/lib/money-terms';

/**
 * Every fee, cost and money duty an artist or venue takes on, stated before
 * they can take a sale (DESIGN_SYNC row 521; owner: "TOTAL transparency, no
 * one should be blindsided").
 *
 * Rendered at sign-up for an artist or venue, in both onboarding wizards and
 * on every control that connects Stripe payouts. It is shown open, never
 * behind a disclosure toggle: a term somebody has to click to find is not
 * disclosed. The numbers come from the same constants and arithmetic the
 * purchase route runs, so the example cannot state a split the sale does not
 * make.
 *
 * With `onAcknowledgeChange` it carries the checkbox; the Connect route refuses
 * to start payouts setup without the acknowledgement (MONEY_TERMS_VERSION).
 */
export function MoneyTermsDisclosure({
  role,
  acknowledged,
  onAcknowledgeChange,
}: {
  role: MoneyTermsRole;
  acknowledged?: boolean;
  onAcknowledgeChange?: (value: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const example = moneyTermsExample();
  const money = (cents: number) => formatCurrencyFromCents(cents, locale);
  const fill = (text: string) =>
    text
      .replace('{artist}', String(MONEY_TERMS_FACTS.artistPercent))
      .replace('{venue}', String(MONEY_TERMS_FACTS.venuePercent))
      .replace('{stripePercent}', String(MONEY_TERMS_FACTS.stripePercent))
      .replace('{stripeFixed}', money(MONEY_TERMS_FACTS.stripeFixedCents))
      .replace('{days}', String(MONEY_TERMS_FACTS.payoutHoldDays));

  return (
    <section className="money-terms" aria-labelledby="money-terms-title">
      <h3 className="money-terms-title" id="money-terms-title">
        {t('moneyTerms.title', 'Where the money goes, and who handles it')}
      </h3>
      <p className="money-terms-lead">
        {t('moneyTerms.lead', 'iHYPE takes 0% and has no finance or support staff. Stripe moves every dollar, the venue is the seller, and each of you manages your own money. Read this before you sell a ticket.')}
      </p>

      <div className="money-terms-example" role="group" aria-label={t('moneyTerms.exampleLabel', 'Example: one ticket')}>
        <div className="money-terms-example-head">
          {t('moneyTerms.exampleHead', 'One {face} ticket').replace('{face}', money(example.faceValueCents))}
        </div>
        <div className="money-terms-row"><span>{t('moneyTerms.rowFee', 'Stripe card fee (off the top)')}</span><b>{money(example.fee)}</b></div>
        <div className="money-terms-row"><span>{fill(t('moneyTerms.rowArtist', 'Artist · {artist}% of the rest'))}</span><b>{money(example.artist)}</b></div>
        <div className="money-terms-row"><span>{fill(t('moneyTerms.rowVenue', 'Venue · {venue}% of the rest'))}</span><b>{money(example.venue)}</b></div>
        <div className="money-terms-row"><span>{t('moneyTerms.rowIhype', 'iHYPE')}</span><b>{money(0)}</b></div>
        <p className="money-terms-note">{t('moneyTerms.exampleNote', 'The buyer pays the ticket price plus tax, nothing else. Tax is not part of the split.')}</p>
      </div>

      <h4 className="money-terms-subtitle">{t('moneyTerms.feesTitle', 'Fees')}</h4>
      <ul className="money-terms-list">
        <li>{fill(t('moneyTerms.feeStripe', 'Stripe charges {stripePercent}% + {stripeFixed} per order on a standard US card. It comes off the ticket price before the split, so the artist and venue share it {artist}/{venue}.'))}</li>
        <li>{t('moneyTerms.feeCardTypes', 'American Express and international cards cost more. The split is set at checkout from the standard rate, so on those cards the difference comes out of the venue’s share — usually a few cents a ticket.')}</li>
        <li>{t('moneyTerms.feeIhype', 'iHYPE takes 0%: no platform fee, no subscription, no cut of tickets.')}</li>
        <li>{t('moneyTerms.feeStripeAccount', 'Stripe may charge its own account or payout fees. Those appear in your Stripe dashboard, not on iHYPE.')}</li>
      </ul>

      <h4 className="money-terms-subtitle">{t('moneyTerms.refundsTitle', 'Refunds, cancellations and chargebacks')}</h4>
      <ul className="money-terms-list">
        <li>{t('moneyTerms.refundFinal', 'Ticket sales are final. A buyer is refunded only if the show is cancelled.')}</li>
        <li>{t('moneyTerms.refundCancel', 'Cancelling a show refunds every buyer in full, except tickets already scanned at the door. Stripe does not return its card fee on a refund, so the venue loses that fee on each refunded ticket.')}</li>
        <li>{t('moneyTerms.refundArtistShare', 'On a cancellation the artist’s share is returned from iHYPE to the venue as part of the refund, so the artist is not paid for a cancelled show.')}</li>
        <li>{t('moneyTerms.refundChargeback', 'If a buyer disputes a charge with their bank, Stripe takes the disputed amount plus its dispute fee from the venue’s Stripe account, including after the artist has been paid. The venue answers the dispute in its own Stripe dashboard.')}</li>
      </ul>

      <h4 className="money-terms-subtitle">{t('moneyTerms.taxTitle', 'Taxes')}</h4>
      <ul className="money-terms-list">
        <li>{t('moneyTerms.taxVenue', 'The venue is the seller of record. It collects the sales or admission tax on each ticket and is responsible for filing and paying it to its tax authority.')}</li>
        <li>{t('moneyTerms.taxEstimateVenueRate', 'The tax iHYPE adds at checkout uses the rate the venue sets in its profile. Until the venue sets one, it is an estimate: the venue’s state sales tax rate plus that state’s average local rate, from the Tax Foundation’s published 2026 table. Many places tax admissions differently, so the venue is responsible for setting the correct rate for its area.')}</li>
        <li>{t('moneyTerms.taxIncome', 'Artists and venues each report their own earnings and pay their own income tax. Stripe may send you a tax form, depending on your account and country. iHYPE does not file taxes for anyone.')}</li>
      </ul>

      <h4 className="money-terms-subtitle">{t('moneyTerms.payoutTitle', 'When money arrives')}</h4>
      <ul className="money-terms-list">
        {role === 'VENUE' ? (
          <>
            <li>{t('moneyTerms.payoutVenueSeller', 'Each sale is a charge on your own Stripe account. Your business name appears on the buyer’s statement, and your share and the tax stay in your account; Stripe pays you out on the schedule you set with Stripe.')}</li>
            <li>{t('moneyTerms.payoutVenueGate', 'Tickets for your shows cannot go on sale until your Stripe account can take payments.')}</li>
          </>
        ) : (
          <>
            <li>{fill(t('moneyTerms.payoutArtistHold', 'Your share passes through iHYPE and is sent to your Stripe account {days} days after the show, once it has ended, so a cancellation or dispute can surface first.'))}</li>
            <li>{t('moneyTerms.payoutArtistAccount', 'Your share waits until your Stripe payout account is set up and verified; nothing is lost while it waits. On a shared bill, the artist share is divided by the lineup split every act accepted.')}</li>
          </>
        )}
        <li>{t('moneyTerms.payoutSupport', 'Money questions go to Stripe (payouts, fees, disputes) or to the venue (refunds, tax). iHYPE has no staff to handle them.')}</li>
      </ul>

      {onAcknowledgeChange ? (
        <label className="money-terms-ack">
          <input
            checked={Boolean(acknowledged)}
            onChange={(event) => onAcknowledgeChange(event.target.checked)}
            type="checkbox"
          />
          <span>{t('moneyTerms.acknowledge', 'I understand these fees and that managing refunds, disputes and taxes is the responsibility of the artist, the venue and Stripe — not iHYPE.')}</span>
        </label>
      ) : null}
    </section>
  );
}
