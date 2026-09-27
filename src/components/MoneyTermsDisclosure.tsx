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
 * on every control that sets up how money is received. Since 2026-09-27 the
 * venue keeps every sale and pays each act under the signed Show Revenue
 * Split Agreement (DESIGN_SYNC row 528). It is shown open, never
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
      .replace('{artistPercent}', String(example.artistPercent))
      .replace('{stripePercent}', String(MONEY_TERMS_FACTS.stripePercent))
      .replace('{stripeFixed}', money(MONEY_TERMS_FACTS.stripeFixedCents))
      .replace('{days}', String(MONEY_TERMS_FACTS.settlementDays))
      .replace('{confirmDays}', String(MONEY_TERMS_FACTS.autoConfirmDays))
      .replace('{pauseDays}', String(MONEY_TERMS_FACTS.pauseDays));

  return (
    <section className="money-terms" aria-labelledby="money-terms-title">
      <h3 className="money-terms-title" id="money-terms-title">
        {t('moneyTerms.title', 'Where the money goes, and who handles it')}
      </h3>
      <p className="money-terms-lead">
        {t('moneyTerms.leadAgreement', 'iHYPE takes 0% and never holds ticket money. The venue sells every ticket through its own Stripe account and pays each act directly, under a Show Revenue Split Agreement that both of them sign in the app before tickets go on sale. Read this before you sell or play a show.')}
      </p>

      <div className="money-terms-example" role="group" aria-label={t('moneyTerms.exampleLabel', 'Example: one ticket')}>
        <div className="money-terms-example-head">
          {fill(t('moneyTerms.exampleHeadAgreement', 'One {face} ticket, with an offer of {artistPercent}% to the act').replace('{face}', money(example.faceValueCents)))}
        </div>
        <div className="money-terms-row"><span>{t('moneyTerms.rowVenueReceives', 'The venue receives')}</span><b>{money(example.faceValueCents)}</b></div>
        <div className="money-terms-row"><span>{t('moneyTerms.rowFeeVenue', 'Stripe card fee, paid by the venue')}</span><b>{money(example.fee)}</b></div>
        <div className="money-terms-row"><span>{fill(t('moneyTerms.rowArtistOwed', 'The venue pays the act · {artistPercent}% of the ticket price'))}</span><b>{money(example.artist)}</b></div>
        <div className="money-terms-row"><span>{t('moneyTerms.rowVenueKeeps', 'The venue keeps')}</span><b>{money(example.venue)}</b></div>
        <div className="money-terms-row"><span>{t('moneyTerms.rowIhype', 'iHYPE')}</span><b>{money(0)}</b></div>
        <p className="money-terms-note">{t('moneyTerms.exampleNoteAgreement', 'The act’s percentage is whatever the venue offers and the act signs; 70% is only an example. The buyer pays the ticket price plus tax, nothing else. Tax is not shared.')}</p>
      </div>

      <h4 className="money-terms-subtitle">{t('moneyTerms.agreementTitle', 'The split agreement')}</h4>
      <ul className="money-terms-list">
        <li>{t('moneyTerms.agreementOffer', 'For each ticketed show the venue sends every act a lineup offer: a percentage of the ticket receipts, and optionally a guarantee and capped deductions. Sending it is the venue’s signature; accepting it is the act’s. Tickets go on sale only when every act has signed.')}</li>
        <li>{t('moneyTerms.agreementNet', 'The act’s share is its percentage of the ticket receipts after sales tax, refunds and chargebacks the venue lost — and after nothing else unless the offer lists it with a cap. Tickets sold at the door count too.')}</li>
        <li>{t('moneyTerms.agreementTrust', 'The act’s share is held by the venue in trust for the act, and the venue cannot subtract other amounts it says the act owes it.')}</li>
        <li>{t('moneyTerms.agreementPdf', 'Both sides get the signed agreement as a PDF by email and can download it again at any time.')}</li>
      </ul>

      <h4 className="money-terms-subtitle">{t('moneyTerms.feesTitle', 'Fees')}</h4>
      <ul className="money-terms-list">
        <li>{fill(t('moneyTerms.feeStripeVenue', 'Stripe charges the venue {stripePercent}% + {stripeFixed} per order on a standard US card, more on American Express and international cards. Card fees are the venue’s cost and do not reduce the act’s share.'))}</li>
        <li>{t('moneyTerms.feeIhype', 'iHYPE takes 0%: no platform fee, no subscription, no cut of tickets.')}</li>
        <li>{t('moneyTerms.feeStripeAccount', 'Stripe may charge its own account or payout fees. Those appear in your Stripe dashboard, not on iHYPE.')}</li>
      </ul>

      <h4 className="money-terms-subtitle">{t('moneyTerms.refundsTitle', 'Refunds, cancellations and chargebacks')}</h4>
      <ul className="money-terms-list">
        <li>{t('moneyTerms.refundFinal', 'Ticket sales are final. A buyer is refunded only if the show is cancelled.')}</li>
        <li>{t('moneyTerms.refundCancelVenue', 'Cancelling a show refunds every buyer in full, except tickets already scanned at the door, from the venue’s Stripe account. Stripe does not return its card fee on a refund.')}</li>
        <li>{t('moneyTerms.refundCancelArtistOwed', 'If the venue cancels for a reason within its control, it still owes each act the greater of any guarantee and half the share the tickets sold so far would have earned. If the act cancels, nothing is owed either way.')}</li>
        <li>{t('moneyTerms.refundChargebackVenue', 'If a buyer disputes a charge with their bank, Stripe takes the disputed amount plus its dispute fee from the venue’s Stripe account. The venue answers the dispute in its own Stripe dashboard.')}</li>
      </ul>

      <h4 className="money-terms-subtitle">{t('moneyTerms.taxTitle', 'Taxes')}</h4>
      <ul className="money-terms-list">
        <li>{t('moneyTerms.taxVenue', 'The venue is the seller of record. It collects the sales or admission tax on each ticket and is responsible for filing and paying it to its tax authority.')}</li>
        <li>{t('moneyTerms.taxEstimateVenueRate', 'The tax iHYPE adds at checkout uses the rate the venue sets in its profile. Until the venue sets one, it is an estimate: the venue’s state sales tax rate plus that state’s average local rate, from the Tax Foundation’s published 2026 table. Many places tax admissions differently, so the venue is responsible for setting the correct rate for its area.')}</li>
        <li>{t('moneyTerms.taxPayerVenue', 'The venue pays the act, so the venue handles any tax reporting on those payments, such as collecting a W-9 and issuing a 1099 where the law requires. Each act reports and pays its own income tax. iHYPE does not file taxes for anyone.')}</li>
      </ul>

      <h4 className="money-terms-subtitle">{t('moneyTerms.payoutTitle', 'When money arrives')}</h4>
      <ul className="money-terms-list">
        {role === 'VENUE' ? (
          <>
            <li>{t('moneyTerms.payoutVenueKeepsAll', 'Each sale is a charge on your own Stripe account, under your business name, and all of it stays in your account; Stripe pays you out on the schedule you set with Stripe.')}</li>
            <li>{fill(t('moneyTerms.payoutVenuePays', 'You pay each act its share within {days} days of the show, to the payment method the act recorded, and mark the payment in the app with its amount, date and a reference. Late payment carries interest and a late fee under the agreement.'))}</li>
            <li>{fill(t('moneyTerms.payoutVenuePause', 'If an act reports it was not paid and the report is still unresolved {pauseDays} days after the payment was due, iHYPE may pause your ticket sales and lineup offers until it is resolved.'))}</li>
            <li>{t('moneyTerms.payoutVenueGate', 'Tickets for your shows cannot go on sale until your Stripe account can take payments.')}</li>
          </>
        ) : (
          <>
            <li>{t('moneyTerms.payoutArtistNoStripe', 'You do not need a Stripe account. Record where you get paid — bank transfer, check or a payment app — before you sign an offer.')}</li>
            <li>{fill(t('moneyTerms.payoutArtistDue', 'The venue pays you within {days} days of the show. The settlement statement in the app shows what the show took and what you are owed. Confirm the payment when it arrives; it also counts as complete {confirmDays} days after the venue marks it paid if you report nothing.'))}</li>
            <li>{t('moneyTerms.payoutArtistReport', 'If you are not paid, report it in the app. You can take the claim to small claims court where the show took place, and the agreement lets you recover your legal and collection costs if you win.')}</li>
          </>
        )}
        <li>{t('moneyTerms.payoutSupportAgreement', 'Money questions go to the venue (your share, refunds, tax) or to Stripe (card payments, disputes). iHYPE has no staff to handle them and is not a party to the payment.')}</li>
      </ul>

      {onAcknowledgeChange ? (
        <label className="money-terms-ack">
          <input
            checked={Boolean(acknowledged)}
            onChange={(event) => onAcknowledgeChange(event.target.checked)}
            type="checkbox"
          />
          <span>{t('moneyTerms.acknowledgeAgreement', 'I understand these terms: the venue collects all ticket money and pays each act under the signed split agreement, and refunds, disputes and taxes are the responsibility of the venue, the act and Stripe — not iHYPE.')}</span>
        </label>
      ) : null}
    </section>
  );
}
