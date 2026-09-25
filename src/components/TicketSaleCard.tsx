'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShareButton } from '@/components/ShareButton';
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/TurnstileWidget';
import { useI18n } from '@/components/I18nProvider';
import {
  ARTIST_SHARE_PERCENT,
  VENUE_SHARE_PERCENT,
  calculateTicketOrderFinancials,
  formatCurrencyFromCents,
  formatPercent
} from '@/lib/ticketing';
import { openExternalUrl } from '@/lib/open-external';

type TicketSaleCardProps = {
  showId: string;
  showSlug: string;
  title: string;
  /** What the card's own heading says. Defaults to the show title; the shell's
   *  show pane already carries that as its h1, so it passes a section name and
   *  the document stops announcing the same heading twice. */
  heading?: string;
  ticketPriceCents: number;
  ticketCapacity: number | null;
  ticketsSoldCount: number;
  venueName: string;
  artistName: string;
  ticketingOpen: boolean;
  ticketingOpensAtLabel?: string | null;
  /** Whether the venue can be the merchant on a sale — its Connect account
   *  finished onboarding. No sale happens until it has (2026-09-25). */
  venuePaymentReady: boolean;
  /** Whose HYPE link brought the buyer here: recorded on the order as the
   *  referral, and earning nothing since the promoter share ended. */
  affiliatePromoterProfileId?: string | null;
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
  heading,
  ticketPriceCents,
  ticketCapacity,
  ticketsSoldCount,
  venueName,
  artistName,
  ticketingOpen,
  ticketingOpensAtLabel,
  venuePaymentReady,
  affiliatePromoterProfileId,
  currentFan,
  viewerLocation,
  venueLocation
}: TicketSaleCardProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [quantity, setQuantity] = useState('1');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
        /* The charter split, the same constants the purchase route passes —
           never the show's stored percentages, which a show created under
           70/20/10 still carries. */
        venuePayoutPercent: VENUE_SHARE_PERCENT,
        artistPayoutPercent: ARTIST_SHARE_PERCENT,
        buyerLocation: viewerLocation,
        venueLocation
      }),
    [quantityForPreview, ticketPriceCents, venueLocation, viewerLocation]
  );

  /* One share per row, each percentage read back off the amount the SAME
     helper the purchase route calls produced for this order. The show's own
     percentages are the input to that helper, never the label. */
  const splitRows = useMemo(() => {
    const base = preview.subtotalCents;
    const pct = (cents: number) => (base > 0 ? Math.round((cents / base) * 1000) / 10 : 0);
    /* Stripe's card fee is a row of its own and comes FIRST: it is taken off
       the face value before the 75/25, so the artist's and venue's lines are
       shares of what is left, and the three rows sum to the face value. */
    return [
      { key: 'var(--ink-3)', name: t('ticketSaleCard.stripeFeeRow', 'Card processing (Stripe)'), cents: preview.stripeFeeCents, percent: pct(preview.stripeFeeCents) },
      { key: 'var(--accent)', name: artistName, cents: preview.artistPayoutCents, percent: pct(preview.artistPayoutCents) },
      { key: 'var(--role-venue)', name: venueName, cents: preview.venuePayoutCents, percent: pct(preview.venuePayoutCents) },
    ];
  }, [artistName, preview, t, venueName]);

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
        /* In-app browser on native, a plain navigation on the web — see
           `openExternalUrl`. The refresh is the return leg: Stripe's webhook
           has finalised the order by the time the member closes the tab. */
        await openExternalUrl(data.checkoutUrl, { onReturn: () => router.refresh() });
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
      setEmailUnverified(data.code === 'EMAIL_NOT_VERIFIED');
      setMessage(
        data.code === 'PAYMENTS_UNAVAILABLE'
          ? t('ticketSaleCard.paymentsUnavailable', 'Card payments are unavailable right now. Nothing was charged and your seats were released — please try again in a few minutes.')
          : (data.error ?? t('ticketSaleCard.ticketRequestErrorFallback', 'Could not complete the ticket request.')),
      );
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
          <h2>{heading ?? title}</h2>
          <p className="kicker">
            {t(
              'ticketSaleCard.kickerVenueSeller',
              'The venue sells these tickets through Stripe. The artist’s share is paid out to them after the show.'
            )}
          </p>
        </div>
        <div className="ticket-price-badge">
          <strong>{formatCurrencyFromCents(ticketPriceCents, locale)}</strong>
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
        {/* "Charge state" described a reserve-then-capture model the purchase
            path does not implement: every sale goes through Stripe Checkout and
            is captured on `payment_intent.succeeded`. What this figure can
            honestly say is whether tickets are ON SALE — which is what
            `isTicketingOpen()` actually decides, and what `showRowTrail()`
            already says on every row that links here. */}
        <div className="stat">
          <strong>{ticketingOpen ? t('ticketSaleCard.onSaleNowLabel', 'On sale now') : t('ticketSaleCard.notOnSaleYetLabel', 'Not yet')}</strong>
          {t('ticketSaleCard.saleStateLabel', 'Ticket sales')}
        </div>
      </div>

{/* S4's split card (reference/s4-checkout.html): the keyed bar over one
          row per share, real names and this order's real amounts — replacing
          three separate stat cards saying the same thing without the bar.
          The percentages used to be read off the show's configured split;
          they are DERIVED from this order's own amounts now — see below. */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-panel)', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          {t('ticketSaleCard.whereItGoes', 'Where the face value goes')}
        </div>
        {/* Every share is DERIVED from the amount beside it, never from the
            configured percentage — or a redistributed promoter tenth reads as
            a payment nobody receives while the artist's real 77.78% is
            labelled 70%. A zero share draws no segment rather than a hairline
            claiming one. */}
        <div style={{ display: 'flex', height: 12, borderRadius: 2, overflow: 'hidden', gap: 2 }}>
          {splitRows.filter((row) => row.cents > 0).map((row) => (
            <div key={row.key} style={{ flex: Math.max(row.percent, 1), background: row.key }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {splitRows.map((row) => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: row.key, flex: '0 0 auto' }} />
              <span style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>{row.name} · {formatPercent(row.percent)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem' }}>{formatCurrencyFromCents(row.cents, locale)}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.4 }}>
          {t('ticketSaleCard.splitNote', 'Stripe’s card fee comes off the top; what is left is split {artist}% to the artist and {venue}% to the venue. iHYPE takes nothing.')
            .replace('{artist}', String(ARTIST_SHARE_PERCENT))
            .replace('{venue}', String(VENUE_SHARE_PERCENT))}
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
      ) : !venuePaymentReady ? (
        /* The venue is the merchant on every sale, and the purchase route
           refuses one until its payments are set up (409
           VENUE_NOT_PAYMENT_READY). Saying so here keeps a buyer from filling
           in a form the server will refuse. */
        <div className="empty">
          {t('ticketSaleCard.venueNotPaymentReady', 'Tickets go on sale once the venue finishes setting up payments. Follow the venue to hear when they do.')}
        </div>
      ) : !ticketingOpen ? (
        /* Tickets that are not on sale cannot be bought, and the card used to
           offer the whole purchase form anyway with a sentence promising the
           charge would come later. It would not: `POST /api/shows/[showId]/
           tickets` opens a Stripe Checkout session and the card is charged
           there and then. The route now refuses a closed sale with the same
           reason, so the two cannot disagree. */
        <div className="empty">
          {ticketingOpensAtLabel
            ? t('ticketSaleCard.notOnSaleWithDate', 'Tickets are not on sale yet. The organiser opens sales on {date}.').replace('{date}', ticketingOpensAtLabel)
            : t('ticketSaleCard.notOnSale', 'Tickets are not on sale yet. The organiser opens sales for this event; check back, or follow the venue to hear when they do.')}
        </div>
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
                  /* The wrapping <label> names only its FIRST control, the minus
                     button — so this field had no accessible name at all. */
                  aria-label={t('ticketSaleCard.quantityLabel', 'Quantity')}
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
                  { label: t('ticketSaleCard.ihypeFeeLabel', 'iHYPE fee'), cents: 0, zero: true },
                ].map((line) => (
                  <div key={line.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>{line.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: line.zero ? 600 : 400, color: line.zero ? 'var(--accent-text)' : 'var(--ink)' }}>
                      {formatCurrencyFromCents(line.cents, locale)}
                    </span>
                  </div>
                ))}
                <div style={{ height: 1, background: 'var(--line-2)' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: '1.3125rem' }}>{t('ticketSaleCard.totalChargeLabel', 'Total charge')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3125rem', fontWeight: 600 }}>{formatCurrencyFromCents(preview.totalChargeCents, locale)}</span>
                </div>
                {/* Plain language, under the number it explains, because a
                    ledger line without a sentence is only half a disclosure.
                    Says where the money goes AND what it is not: the two
                    questions a reader of "Refund & dispute protection"
                    actually has. Deliberately not a tooltip — a fee someone
                    has to hover to understand is not disclosed. */}
                {/* 15px, not the 13px this first shipped as: an explanation of
                    a charge is CONTENT, and DS8's floor applies. Shrinking the
                    sentence that justifies a fee is precisely the wrong thing
                    to shrink — caught by `npm run lint`, not by review. */}
                <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.55, color: 'var(--ink-2)' }}>
                  {t('ticketSaleCard.feeExplainerNet', 'You pay the ticket price and its tax, and nothing more. Stripe’s card fee comes out of the ticket price, and what is left is split {artist}% to the artist and {venue}% to the venue, who is the seller on this sale. iHYPE takes nothing.')
                    .replace('{artist}', String(ARTIST_SHARE_PERCENT))
                    .replace('{venue}', String(VENUE_SHARE_PERCENT))}
                </p>
              </div>
            </div>
          </div>

          {/* One sentence, no branch. The three it replaces described a
              reserve-then-charge-later flow that no code path implements —
              two of them are now unreachable anyway, since the form only
              renders once sales are open. */}
          <div className="empty">
            {t('ticketSaleCard.checkoutNotice', 'Checkout is handled by Stripe. Your card is charged when you complete it, and your QR tickets are emailed as soon as the payment settles.')}
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
                buyer never approves a figure they have not seen. There is no
                longer a second, "Continue to Stripe" verb for a closed sale —
                a closed sale renders no form at all. */}
            <button
              className="button"
              disabled={pending || awaitingTurnstile}
              style={{ minHeight: 50, borderRadius: 'var(--radius-pill)', fontSize: '1rem', fontWeight: 600 }}
              type="submit"
            >
              {pending
                ? t('ticketSaleCard.chargingButton', 'Charging...')
                : `${t('ticketSaleCard.payButton', 'Pay')} ${formatCurrencyFromCents(preview.totalChargeCents, locale)}`}
            </button>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              {t('ticketSaleCard.stripeCaption', 'Stripe · split frozen at publish')}
            </div>
            {message ? (
              <span className="meta">
                {message}
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
