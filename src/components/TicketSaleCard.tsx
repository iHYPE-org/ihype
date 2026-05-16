'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  calculateTicketOrderFinancials,
  formatCurrencyFromCents,
  formatPercent
} from '@/lib/ticketing';

type TicketSaleCardProps = {
  showId: string;
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
  const router = useRouter();
  const [quantity, setQuantity] = useState('1');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
        ? 'Stored payment token'
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

    const response = await fetch(`/api/shows/${showId}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: requestedQuantity,
        affiliatePromoterProfileId: affiliatePromoterProfileId || undefined
      })
    });

    const data = await response.json();

    if (response.ok) {
      setQuantity('1');
      setIssuedTickets((data.tickets ?? []) as IssuedTicket[]);
      setMessage(data.message ?? (data.captureMode === 'captured' ? 'Tickets issued.' : 'Tickets reserved.'));
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not complete the ticket request.');
    }

    setPending(false);
  }

  return (
    <section className="panel ticketing-panel">
      <div className="ticketing-panel-header">
        <div>
          <div className="badge">Ticket Sales</div>
          <h2>{title}</h2>
          <p className="kicker">
            Reserved tickets are tied to fan payment tokens and route venue, artist, affiliate promoter, and tax amounts
            into a clean accounts-payable trail.
          </p>
        </div>
        <div className="ticket-price-badge">
          <strong>{formatCurrencyFromCents(ticketPriceCents)}</strong>
          <span>per ticket</span>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="stat">
          <strong>{ticketsSoldCount}</strong>
          Reserved + sold
        </div>
        <div className="stat">
          <strong>{remainingTickets === null ? 'Open' : remainingTickets}</strong>
          Remaining
        </div>
        <div className="stat">
          <strong>{ticketingOpen ? 'Open now' : ticketingOpensAtLabel ?? 'Waiting for venue open'}</strong>
          Charge state
        </div>
      </div>

      <div className="ticketing-split-grid">
        <div className="signal-card">
          <strong>{venueName}</strong>
          <span>{formatPercent(venuePayoutPercent)} share</span>
          <span>{formatCurrencyFromCents(preview.venuePayoutCents)} for this order</span>
        </div>
        <div className="signal-card">
          <strong>{artistName}</strong>
          <span>{formatPercent(artistPayoutPercent)} share</span>
          <span>{formatCurrencyFromCents(preview.artistPayoutCents)} for this order</span>
        </div>
        <div className="signal-card">
          <strong>{affiliatePromoterName ?? promoterName ?? 'Promoter affiliate pool'}</strong>
          <span>{formatPercent(promoterPayoutPercent)} affiliate share</span>
          <span>{formatCurrencyFromCents(preview.promoterPayoutCents)} for this order</span>
        </div>
      </div>

      {remainingTickets === 0 ? (
        <div className="empty">This ticket allocation is sold out.</div>
      ) : !currentFan ? (
        <div className="empty">
          Sign in with a fan account to reserve tickets against your stored payment token.
          <div className="cta-row">
            <Link className="button small secondary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      ) : !currentFan.hasStoredPaymentToken ? (
        <div className="empty">
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Payment method required</strong>
          Fan accounts need a saved payment method before reserving tickets. Payment onboarding is being finalised for
          beta launch, and your account will be notified when it opens.
          <div className="cta-row" style={{ marginTop: '1rem' }}>
            <Link className="button small secondary" href="/tickets">
              Ticketing Engine
            </Link>
          </div>
        </div>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          {currentFan || viewerTaxRegion || venueTaxRegion ? (
            <div className="ticketing-context-grid">
              {currentFan ? (
                <div className="signal-card">
                  <strong>{currentFan.name ?? 'Signed-in fan'}</strong>
                  <span>{currentFan.email}</span>
                  <span>{fanPaymentLabel ?? 'Stored payment token on file.'}</span>
                </div>
              ) : null}
              {viewerTaxRegion ? (
                <div className="signal-card">
                  <strong>Buyer tax region</strong>
                  <span>{viewerTaxRegion}</span>
                  <span>Tax is calculated from request location at purchase time.</span>
                </div>
              ) : null}
              {venueTaxRegion ? (
                <div className="signal-card">
                  <strong>Venue tax region</strong>
                  <span>{venueTaxRegion}</span>
                  <span>Used for payout and payable reconciliation.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-2">
            <div className="stat">
              <strong>{currentFan.name || currentFan.email}</strong>
              Fan account
            </div>
            <div className="stat">
              <strong>{fanPaymentLabel ?? 'Stored token on file'}</strong>
              Payment source
            </div>
          </div>

          <div className="grid grid-2">
            <label className="field">
              <span>Quantity</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => String(Math.max(1, Number(q || 1) - 1)))}
                  style={{ padding: '4px 12px', border: '1px solid var(--line, #333)', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: '1.2em', lineHeight: 1 }}
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
                  aria-label="Increase quantity"
                  onClick={() => {
                    const cap = remainingTickets === null ? 8 : Math.max(remainingTickets, 1);
                    setQuantity((q) => String(Math.min(cap, Number(q || 1) + 1)));
                  }}
                  style={{ padding: '4px 12px', border: '1px solid var(--line, #333)', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: '1.2em', lineHeight: 1 }}
                >
                  +
                </button>
              </div>
            </label>

            <div className="ticketing-split-preview">
              <div className="meta">Order preview</div>
              <div className="ticketing-order-summary">
                <div><span>Subtotal</span><strong>{formatCurrencyFromCents(preview.subtotalCents)}</strong></div>
                <div><span>Local tax</span><strong>{formatCurrencyFromCents(preview.localCents)}</strong></div>
                <div><span>State / province tax</span><strong>{formatCurrencyFromCents(preview.stateCents)}</strong></div>
                <div><span>Country tax</span><strong>{formatCurrencyFromCents(preview.countryCents)}</strong></div>
                <div><span>International tax</span><strong>{formatCurrencyFromCents(preview.internationalCents)}</strong></div>
                <div><span>Total tax</span><strong>{formatCurrencyFromCents(preview.totalTaxCents)}</strong></div>
                <div><span>Total charge</span><strong>{formatCurrencyFromCents(preview.totalChargeCents)}</strong></div>
              </div>
            </div>
          </div>

          <div className="empty">
            {ticketingOpen
              ? 'This event is officially open. Your stored payment token will be charged now and QR tickets will be emailed immediately.'
              : `This event is not open yet. Your quantity will be reserved now, then charged to your stored token when the venue opens the event${ticketingOpensAtLabel ? ` (${ticketingOpensAtLabel})` : ''}.`}
          </div>

          <div className="cta-row">
            <button className="button" disabled={pending} type="submit">
              {pending
                ? ticketingOpen
                  ? 'Charging...'
                  : 'Reserving...'
                : ticketingOpen
                  ? 'Charge stored token now'
                  : 'Reserve tickets'}
            </button>
            {message ? <span className="meta">{message}</span> : null}
          </div>
        </form>
      )}

      {issuedTickets.length ? (
        <div className="ticket-issued-grid">
          {issuedTickets.map((ticket) => (
            <article className="ticket-issued-card" key={ticket.id}>
              <img alt={`${ticket.label} QR`} className="ticket-issued-qr" src={ticket.qrCodeDataUrl} />
              <div className="ticket-issued-copy">
                <strong>{ticket.label}</strong>
                <span>{ticket.serializedId}</span>
                <span>{ticket.status}</span>
                <a className="button small secondary" href={ticket.verificationUrl} target="_blank" rel="noreferrer">
                  Open verification
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
