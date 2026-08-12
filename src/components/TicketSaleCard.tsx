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

      <div className="ticketing-split-grid">
        <div className="signal-card">
          <strong>{venueName}</strong>
          <span>{formatPercent(venuePayoutPercent)} {t('ticketSaleCard.shareLabel', 'share')}</span>
          <span>{formatCurrencyFromCents(preview.venuePayoutCents)} {t('ticketSaleCard.forThisOrderLabel', 'for this order')}</span>
        </div>
        <div className="signal-card">
          <strong>{artistName}</strong>
          <span>{formatPercent(artistPayoutPercent)} {t('ticketSaleCard.shareLabel', 'share')}</span>
          <span>{formatCurrencyFromCents(preview.artistPayoutCents)} {t('ticketSaleCard.forThisOrderLabel', 'for this order')}</span>
        </div>
        <div className="signal-card">
          <strong>{affiliatePromoterName ?? promoterName ?? t('ticketSaleCard.promoterAffiliatePoolFallback', 'Promoter affiliate pool')}</strong>
          <span>{formatPercent(promoterPayoutPercent)} {t('ticketSaleCard.affiliateShareLabel', 'affiliate share')}</span>
          <span>{formatCurrencyFromCents(preview.promoterPayoutCents)} {t('ticketSaleCard.forThisOrderLabel', 'for this order')}</span>
        </div>
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
          {t('ticketSaleCard.signInPrompt', 'Sign in with a fan account to reserve tickets against your stored payment token.')}
          <div className="cta-row">
            <Link className="button small secondary" href="/login">
              {t('ticketSaleCard.signInButton', 'Sign in')}
            </Link>
          </div>
        </div>
      ) : !currentFan.hasStoredPaymentToken ? (
        <div className="empty">
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>{t('ticketSaleCard.paymentMethodRequiredTitle', 'Payment method required')}</strong>
          {/* The previous copy here promised two things nothing backs: a
              delivery date ("being finalised for beta launch") and a
              notification ("your account will be notified when it opens") that
              no code path sends. Saying less is the honest option until the
              flow exists.

              What it needs: POST /api/stripe/setup-intent is written and
              correct, but it returns a clientSecret for Stripe.js, and there
              is deliberately no Stripe.js or Elements anywhere in this
              codebase. The route to finish this is the one ad billing already
              took — a hosted Stripe Checkout session in mode: 'setup' (see
              createAdCampaignCheckoutSession in src/lib/stripe.ts), plus a
              checkout.session.completed branch in the Stripe webhook to store
              the resulting payment method on User.storedPaymentTokenRef. That
              needs no new client dependency. It is deliberately not built yet:
              the Stripe integration has never executed against Stripe at all
              (live mode holds zero PaymentIntents and zero connected
              accounts), so scripts/stripe-payout-rehearsal.mjs should run
              first. */}
          {t(
            'ticketSaleCard.paymentMethodRequiredBody',
            'Saving a payment method is not open yet, so tickets cannot be reserved from this account. Nothing is charged and nothing is held in the meantime.'
          )}
          <div className="cta-row" style={{ marginTop: '1rem' }}>
            <Link className="button small secondary" href="/tickets">
              {t('ticketSaleCard.ticketingEngineButton', 'Ticketing Engine')}
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
                  <span>{fanPaymentLabel ?? t('ticketSaleCard.storedTokenOnFile', 'Stored payment token on file.')}</span>
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
              <strong>{fanPaymentLabel ?? t('ticketSaleCard.storedTokenOnFileShort', 'Stored token on file')}</strong>
              {t('ticketSaleCard.paymentSourceLabel', 'Payment source')}
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
                  style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 12px', border: '1px solid var(--line, #333)', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: '1.2em', lineHeight: 1 }}
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
                  style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 12px', border: '1px solid var(--line, #333)', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: '1.2em', lineHeight: 1 }}
                >
                  +
                </button>
              </div>
            </label>

            <div className="ticketing-split-preview">
              <div className="meta">{t('ticketSaleCard.orderPreviewLabel', 'Order preview')}</div>
              <div className="ticketing-order-summary">
                <div><span>{t('ticketSaleCard.subtotalLabel', 'Subtotal')}</span><strong>{formatCurrencyFromCents(preview.subtotalCents)}</strong></div>
                <div><span>{t('ticketSaleCard.localTaxLabel', 'Local tax')}</span><strong>{formatCurrencyFromCents(preview.localCents)}</strong></div>
                <div><span>{t('ticketSaleCard.stateTaxLabel', 'State / province tax')}</span><strong>{formatCurrencyFromCents(preview.stateCents)}</strong></div>
                <div><span>{t('ticketSaleCard.countryTaxLabel', 'Country tax')}</span><strong>{formatCurrencyFromCents(preview.countryCents)}</strong></div>
                <div><span>{t('ticketSaleCard.internationalTaxLabel', 'International tax')}</span><strong>{formatCurrencyFromCents(preview.internationalCents)}</strong></div>
                <div><span>{t('ticketSaleCard.totalTaxLabel', 'Total tax')}</span><strong>{formatCurrencyFromCents(preview.totalTaxCents)}</strong></div>
                {/* Disclosed before payment, as its own line and in the buyer's
                    favour: iHYPE is a nonprofit, takes $0, and does not absorb
                    Stripe's cost of moving the money either. Naming Stripe is
                    the point — this is not an iHYPE fee. */}
                <div><span>{t('ticketSaleCard.processingFeeLabel', 'Stripe processing, paid by the buyer')}</span><strong>{formatCurrencyFromCents(preview.processingFeeCents)}</strong></div>
                <div><span>{t('ticketSaleCard.ihypeFeeLabel', 'iHYPE fee')}</span><strong>{formatCurrencyFromCents(0)}</strong></div>
                <div><span>{t('ticketSaleCard.totalChargeLabel', 'Total charge')}</span><strong>{formatCurrencyFromCents(preview.totalChargeCents)}</strong></div>
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

          <div className="cta-row">
            <button className="button" disabled={pending || awaitingTurnstile} type="submit">
              {pending
                ? ticketingOpen
                  ? t('ticketSaleCard.chargingButton', 'Charging...')
                  : t('ticketSaleCard.reservingButton', 'Reserving...')
                : ticketingOpen
                  ? t('ticketSaleCard.chargeStoredTokenButton', 'Charge stored token now')
                  : t('ticketSaleCard.reserveTicketsButton', 'Reserve tickets')}
            </button>
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
