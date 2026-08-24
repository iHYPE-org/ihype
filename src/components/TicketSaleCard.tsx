'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShareButton } from '@/components/ShareButton';
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/TurnstileWidget';
import { useI18n } from '@/components/I18nProvider';
import {
  calculateTicketOrderFinancials,
  formatCurrencyFromCents,
  formatPercent
} from '@/lib/ticketing';

type TicketSaleCardProps = {
  showId: string;
  showSlug: string;
  title: string;
  ticketPriceCents: number;
  ticketCapacity: number | null;
  ticketsSoldCount: number;
  venuePayoutPercent: number;
  artistPayoutPercent: number;
  promoterPayoutPercent: number;
  venueName: string;
  artistName: string;
  promoterName: string | null;
  ticketingOpen: boolean;
  ticketingOpensAtLabel?: string | null;
  affiliatePromoterProfileId?: string | null;
  affiliatePromoterName?: string | null;
  currentFan?: {
    name: string | null;
    email: string;
    hasStoredPaymentToken: boolean;
    storedPaymentTokenBrand?: string | null;
    storedPaymentTokenLast4?: string | null;
  } | null;
  viewerLocation?: {
    city?: string | null;
    stateRegion?: string | null;
    country?: string | null;
    postalCode?: string | null;
  } | null;
  venueLocation?: {
    stateRegion?: string | null;
    country?: string | null;
    postalCode?: string | null;
  } | null;
};

type IssuedTicket = {
  id: string;
  serializedId: string;
  status: string;
  verificationUrl: string;
  qrCodeDataUrl: string;
  label: string;
};

export function TicketSaleCard({
  showId,
  showSlug,
  title,
  ticketPriceCents,
  ticketCapacity,
  ticketsSoldCount,
  venuePayoutPercent,
  artistPayoutPercent,
  promoterPayoutPercent,
  venueName,
  artistName,
  promoterName,
  ticketingOpen,
  ticketingOpensAtLabel,
  affiliatePromoterProfileId,
  affiliatePromoterName,
  currentFan,
  viewerLocation,
  venueLocation
}: TicketSaleCardProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [quantity, setQuantity] = useState('1');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ageGated, setAgeGated] = useState(false);
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  // TurnstileWidget renders nothing without a site key, so gating the button on
  // a token would deadlock checkout in any environment that has not configured
  // one — the same guard AuthRegister uses. The server still fails closed in
  // production, which is where it matters.
  const turnstileConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const awaitingTurnstile = turnstileConfigured && !turnstileToken;
  const [issuedTickets, setIssuedTickets] = useState<IssuedTicket[]>([]);

  const remainingTickets = ticketCapacity === null ? null : Math.max(ticketCapacity - ticketsSoldCount, 0);
  const requestedQuantity = Math.max(1, Number(quantity || 1));
  const quantityForPreview =
    remainingTickets === null ? requestedQuantity : Math.min(requestedQuantity, Math.max(remainingTickets, 1));

  const preview = useMemo(
    () =>
      calculateTicketOrderFinancials({
        ticketPriceCents,
        quantity: quantityForPreview,
        venuePayoutPercent,
        artistPayoutPercent,
        promoterPayoutPercent,
        buyerLocation: viewerLocation,
        venueLocation
      }),
    [
      artistPayoutPercent,
      promoterPayoutPercent,
      quantityForPreview,
      ticketPriceCents,
      venueLocation,
      venuePayoutPercent,
      viewerLocation
    ]
  );

  const fanPaymentLabel =
    currentFan?.storedPaymentTokenBrand && currentFan?.storedPaymentTokenLast4
      ? `${currentFan.storedPaymentTokenBrand} **** ${currentFan.storedPaymentTokenLast4}`
      : currentFan?.hasStoredPaymentToken
        ? t('ticketSaleCard.storedPaymentTokenLabel', 'Stored payment token')
        : null;
  const viewerTaxRegion =
    [
      viewerLocation?.postalCode,
      viewerLocation?.city,
      viewerLocation?.stateRegion ?? viewerLocation?.country
    ]
      .filter(Boolean)
      .join(' | ') || null;
  const venueTaxRegion =
    [venueLocation?.postalCode, venueLocation?.stateRegion ?? venueLocation?.country].filter(Boolean).join(' | ') || null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setAgeGated(false);
    setEmailUnverified(false);

    const response = await fetch(`/api/shows/${showId}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: requestedQuantity,
        affiliatePromoterProfileId: affiliatePromoterProfileId || undefined,
        turnstileToken: turnstileToken || undefined
      })
    });

    const data = await response.json();

    if (response.ok) {
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setQuantity('1');
      setIssuedTickets((data.tickets ?? []) as IssuedTicket[]);
      setMessage(
        data.message ??
          (data.captureMode === 'captured'
            ? t('ticketSaleCard.ticketsIssuedFallback', 'Tickets issued.')
            : t('ticketSaleCard.ticketsReservedFallback', 'Tickets reserved.'))
      );
      router.refresh();
    } else {
      setAgeGated(data.code === 'AGE_18_REQUIRED');
      setEmailUnverified(data.code === 'EMAIL_NOT_VERIFIED');
      setMessage(data.error ?? t('ticketSaleCard.ticketRequestErrorFallback', 'Could not complete the ticket request.'));
    }

    // Turnstile tokens are single-use — without this, a buyer who hits the
    // per-show cap or a declined card cannot retry, because the second submit
    // would replay a spent token and be refused as a bot.
    setTurnstileToken('');
    turnstileRef.current?.reset();
    setPending(false);
  }

  return (
    <section className="panel ticketing-panel">
      <div className="ticketing-panel-header">
        <div>
          <div className="badge">{t('ticketSaleCard.badge', 'Ticket Sales')}</div>
          <h2>{title}</h2>
          <p className="kicker">
            {t(
              'ticketSaleCard.kicker',
              'Reserved tickets are tied to fan payment tokens and route venue, artist, affiliate promoter, and tax amounts into a clean accounts-payable trail.'
            )}
          </p>
        </div>
        <div className="ticket-price-badge">
          <strong>{formatCurrencyFromCents(ticketPriceCents)}</strong>
          <span>{t('ticketSaleCard.perTicket', 'per ticket')}</span>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="stat">
          <strong>{ticketsSoldCount}</strong>
          {t('ticketSaleCard.reservedSoldLabel', 'Reserved + sold')}
        </div>
        <div className="stat">
          <strong>{remainingTickets === null ? t('ticketSaleCard.openLabel', 'Open') : remainingTickets}</strong>
          {t('ticketSaleCard.remainingLabel', 'Remaining')}
        </div>
        <div className="stat">
          <strong>{ticketingOpen ? t('ticketSaleCard.openNowLabel', 'Open now') : ticketingOpensAtLabel ?? t('ticketSaleCard.waitingForVenueOpenLabel', 'Waiting for venue open')}</strong>
          {t('ticketSaleCard.chargeStateLabel', 'Charge state')}
        </div>
      </div>

      {/* S4's split card (reference/s4-checkout.html): the keyed bar over one
          row per share, real names and this order's real amounts — replacing
          three separate stat cards saying the same thing without the bar. The
          percentages are the show's own, never the constant. */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-panel)', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          {t('ticketSaleCard.whereItGoes', 'Where the face value goes')}
        </div>
        <div style={{ display: 'flex', height: 12, borderRadius: 2, overflow: 'hidden', gap: 2 }}>
          <div style={{ flex: Math.max(artistPayoutPercent, 1), background: 'var(--accent)' }} />
          <div style={{ flex: Math.max(venuePayoutPercent, 1), background: 'var(--role-venue)' }} />
          <div style={{ flex: Math.max(promoterPayoutPercent, 1), background: 'var(--role-promoter)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {[
            { key: 'var(--accent)', name: artistName, percent: artistPayoutPercent, cents: preview.artistPayoutCents },
            { key: 'var(--role-venue)', name: venueName, percent: venuePayoutPercent, cents: preview.venuePayoutCents },
            { key: 'var(--role-promoter)', name: affiliatePromoterName ?? promoterName ?? t('ticketSaleCard.promoterAffiliatePoolFallback', 'Promoter affiliate pool'), percent: promoterPayoutPercent, cents: preview.promoterPayoutCents },
          ].map((row) => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: row.key, flex: '0 0 auto' }} />
              <span style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>{row.name} · {formatPercent(row.percent)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem' }}>{formatCurrencyFromCents(row.cents)}</span>
            </div>
          ))}
        </div>
        {affiliatePromoterName ? (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>{t('ticketSaleCard.creditedTo', 'Credited to')}</span>
            <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--role-promoter-text)' }}>{affiliatePromoterName}</span>
          </div>
        ) : null}
      </div>

      {/* ALL SALES ARE FINAL — rendered for EVERY state of this card, not just
          the one that shows the pay button.

          It used to live inside the purchase form, which only renders once a
          fan already has a stored payment token. Every other state skipped it
          entirely: sold out, signed out, and "payment method required" — and
          that last one is the state every member is in today, because there is
          deliberately no Stripe.js or Elements in this codebase yet, so nobody
          can reach the branch that carried the disclosure. The one notice the
          product promises would be shown "in HUGE print when purchasing" was
          therefore visible to no one.

          It belongs above the branch for a second reason: a buyer decides to
          sign in or to add a card BEFORE they see the button, and "no refunds"
          is something they should know at that point, not after. */}
      <div className="ticket-final-notice" role="note">
        <strong className="ticket-final-headline">
          {t('ticketSaleCard.allSalesFinal', 'All ticket sales are final')}
        </strong>
        <span className="ticket-final-detail">
          {t(
            'ticketSaleCard.allSalesFinalDetail',
            'No refunds once a ticket is issued. You can transfer a ticket to someone else instead — any processing fee on a transfer is the responsibility of whoever receives it. iHYPE is a nonprofit and absorbs no fees of any kind.',
          )}
        </span>
      </div>

      {remainingTickets === 0 ? (
        <div className="empty">{t('ticketSaleCard.soldOut', 'This ticket allocation is sold out.')}</div>
      ) : !currentFan ? (
        <div className="empty">
          {t('ticketSaleCard.signInPrompt', 'Sign in with a fan account to buy tickets securely through Stripe.')}
          <div className="cta-row">
            <Link className="button small secondary" href="/login">
              {t('ticketSaleCard.signInButton', 'Sign in')}
            </Link>
          </div>
        </div>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          {currentFan || viewerTaxRegion || venueTaxRegion ? (
            <div className="ticketing-context-grid">
              {currentFan ? (
                <div className="signal-card">
                  <strong>{currentFan.name ?? t('ticketSaleCard.signedInFanFallback', 'Signed-in fan')}</strong>
                  <span>{currentFan.email}</span>
                  <span>{fanPaymentLabel ?? t('ticketSaleCard.secureStripeCheckout', 'Payment collected securely by Stripe Checkout.')}</span>
                </div>
              ) : null}
              {viewerTaxRegion ? (
                <div className="signal-card">
                  <strong>{t('ticketSaleCard.buyerTaxRegionLabel', 'Buyer tax region')}</strong>
                  <span>{viewerTaxRegion}</span>
                  <span>{t('ticketSaleCard.buyerTaxRegionNote', 'Tax is calculated from request location at purchase time.')}</span>
                </div>
              ) : null}
              {venueTaxRegion ? (
                <div className="signal-card">
                  <strong>{t('ticketSaleCard.venueTaxRegionLabel', 'Venue tax region')}</strong>
                  <span>{venueTaxRegion}</span>
                  <span>{t('ticketSaleCard.venueTaxRegionNote', 'Used for payout and payable reconciliation.')}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-2">
            <div className="stat">
              <strong>{currentFan.name || currentFan.email}</strong>
              {t('ticketSaleCard.fanAccountLabel', 'Fan account')}
            </div>
            <div className="stat">
              <strong>{fanPaymentLabel ?? t('ticketSaleCard.stripeCheckoutLabel', 'Stripe Checkout')}</strong>
              {t('ticketSaleCard.paymentSourceLabel', 'Secure payment')}
            </div>
          </div>

          <div className="grid grid-2">
            <label className="field">
              <span>{t('ticketSaleCard.quantityLabel', 'Quantity')}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  aria-label={t('ticketSaleCard.decreaseQuantityAriaLabel', 'Decrease quantity')}
                  onClick={() => setQuantity((q) => String(Math.max(1, Number(q || 1) - 1)))}
                  style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 12px', border: '1px solid var(--line)', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: '1.2em', lineHeight: 1 }}
                >
                  −
                </button>
                <input
                  inputMode="numeric"
                  max={remainingTickets === null ? 8 : Math.max(remainingTickets, 1)}
                  min="1"
                  step="1"
                  type="number"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                  style={{ textAlign: 'center', flex: 1, maxWidth: 80 }}
                />
                <button
                  type="button"
                  aria-label={t('ticketSaleCard.increaseQuantityAriaLabel', 'Increase quantity')}
                  onClick={() => {
                    const cap = remainingTickets === null ? 8 : Math.max(remainingTickets, 1);
                    setQuantity((q) => String(Math.min(cap, Number(q || 1) + 1)));
                  }}
                  style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 12px', border: '1px solid var(--line)', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: '1.2em', lineHeight: 1 }}
                >
                  +
                </button>
              </div>
            </label>

            <div className="ticketing-split-preview">
              <div className="meta">{t('ticketSaleCard.orderPreviewLabel', 'Order preview')}</div>
              {/* S4's order ledger. Every line the old summary carried
                  survives — the reference shows four rows because its sample
                  order has one implicit tax line; a real order can have five,
                  and hiding any re-opens the unexplained-money gap the ledger
                  exists to close. iHYPE's $0 is the accent-text line, exactly
                  as the reference draws it. */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-panel)', padding: 14, background: 'var(--bg-raised)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: t('ticketSaleCard.subtotalLabel', 'Subtotal'), cents: preview.subtotalCents },
                  { label: t('ticketSaleCard.localTaxLabel', 'Local tax'), cents: preview.localCents },
                  { label: t('ticketSaleCard.stateTaxLabel', 'State / province tax'), cents: preview.stateCents },
                  { label: t('ticketSaleCard.countryTaxLabel', 'Country tax'), cents: preview.countryCents },
                  { label: t('ticketSaleCard.internationalTaxLabel', 'International tax'), cents: preview.internationalCents },
                  { label: t('ticketSaleCard.totalTaxLabel', 'Total tax'), cents: preview.totalTaxCents },
                  /* Disclosed before payment, as its own line and in the
                     buyer's favour: iHYPE is a nonprofit, takes $0, and does
                     not absorb Stripe's cost of moving the money either.
                     Naming Stripe is the point — this is not an iHYPE fee. */
                  { label: t('ticketSaleCard.processingFeeLabel', 'Stripe processing, paid by the buyer'), cents: preview.processingFeeCents },
                  { label: t('ticketSaleCard.ihypeFeeLabel', 'iHYPE fee'), cents: 0, zero: true },
                ].map((line) => (
                  <div key={line.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>{line.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: line.zero ? 600 : 400, color: line.zero ? 'var(--accent-text)' : 'var(--ink)' }}>
                      {formatCurrencyFromCents(line.cents)}
                    </span>
                  </div>
                ))}
                <div style={{ height: 1, background: 'var(--line-2)' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: '1.3125rem' }}>{t('ticketSaleCard.totalChargeLabel', 'Total charge')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3125rem', fontWeight: 600 }}>{formatCurrencyFromCents(preview.totalChargeCents)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="empty">
            {ticketingOpen
              ? t('ticketSaleCard.openNotice', 'This event is officially open. Your stored payment token will be charged now and QR tickets will be emailed immediately.')
              : ticketingOpensAtLabel
                ? t('ticketSaleCard.notOpenYetWithDateNotice', 'This event is not open yet. Your quantity will be reserved now, then charged to your stored token when the venue opens the event ({date}).').replace('{date}', ticketingOpensAtLabel)
                : t('ticketSaleCard.notOpenYetNotice', 'This event is not open yet. Your quantity will be reserved now, then charged to your stored token when the venue opens the event.')}
          </div>

          {/* Bot check. Usually invisible — Turnstile only shows an interactive
              challenge when it is unsure — and renders nothing at all when no
              site key is configured. */}
          <TurnstileWidget
            onExpire={() => setTurnstileToken('')}
            onToken={setTurnstileToken}
            ref={turnstileRef}
          />

          <div className="cta-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            {/* The reference's CTA carries the amount ("Pay $18.82"): the
                number on the button is the number Stripe will charge, so a
                buyer never approves a figure they have not seen. Reserve mode
                keeps its own verb — a reservation charges later, and "Pay"
                on it would claim something that is not yet true. */}
            <button
              className="button"
              disabled={pending || awaitingTurnstile}
              style={{ minHeight: 50, borderRadius: 'var(--radius-pill)', fontSize: '1rem', fontWeight: 600 }}
              type="submit"
            >
              {pending
                ? ticketingOpen
                  ? t('ticketSaleCard.chargingButton', 'Charging...')
                  : t('ticketSaleCard.reservingButton', 'Reserving...')
                : ticketingOpen
                  ? `${t('ticketSaleCard.payButton', 'Pay')} ${formatCurrencyFromCents(preview.totalChargeCents)}`
                  : t('ticketSaleCard.continueToStripeButton', 'Continue to Stripe')}
            </button>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              {t('ticketSaleCard.stripeCaption', 'Stripe · split frozen at publish')}
            </div>
            {message ? (
              <span className="meta">
                {message}
                {ageGated ? (
                  <>
                    {' '}
                    <Link href="/me/settings">{t('ticketSaleCard.confirmAgeLink', 'Confirm your age in Settings →')}</Link>
                  </>
                ) : null}
                {emailUnverified ? (
                  <>
                    {' '}
                    <Link href="/verify-email">{t('ticketSaleCard.verifyEmailLink', 'Verify your email →')}</Link>
                  </>
                ) : null}
              </span>
            ) : null}
          </div>
        </form>
      )}

      {issuedTickets.length ? (
        <div className="ticket-issued-grid">
          <div className="cta-row" style={{ marginBottom: 12 }}>
            <strong className="meta">{t('ticketSaleCard.youreGoing', "You're going!")}</strong>
            <ShareButton path={`/shows/${showSlug}`} title={`I'm going to ${title}`} label={t('ticketSaleCard.inviteFriendsLabel', 'Invite friends')} />
          </div>
          {issuedTickets.map((ticket) => (
            <article className="ticket-issued-card" key={ticket.id}>
              <img alt={`${ticket.label} QR`} className="ticket-issued-qr" loading="lazy" src={ticket.qrCodeDataUrl} />
              <div className="ticket-issued-copy">
                <strong>{ticket.label}</strong>
                <span>{ticket.serializedId}</span>
                <span>{ticket.status}</span>
                <a className="button small secondary" href={ticket.verificationUrl} target="_blank" rel="noreferrer">
                  {t('ticketSaleCard.openVerificationLink', 'Open verification')}
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
