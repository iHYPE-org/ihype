'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  calculateTicketOrderPayouts,
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
  promoterName
}: TicketSaleCardProps) {
  const router = useRouter();
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [issuedTickets, setIssuedTickets] = useState<IssuedTicket[]>([]);

  const remainingTickets = ticketCapacity === null ? null : Math.max(ticketCapacity - ticketsSoldCount, 0);
  const requestedQuantity = Math.max(1, Number(quantity || 1));
  const quantityForPreview = remainingTickets === null ? requestedQuantity : Math.min(requestedQuantity, Math.max(remainingTickets, 1));

  const preview = useMemo(
    () =>
      calculateTicketOrderPayouts({
        ticketPriceCents,
        quantity: quantityForPreview,
        venuePayoutPercent,
        artistPayoutPercent,
        promoterPayoutPercent
      }),
    [artistPayoutPercent, promoterPayoutPercent, quantityForPreview, ticketPriceCents, venuePayoutPercent]
  );

  const soldSummary = useMemo(
    () =>
      ticketsSoldCount > 0
        ? calculateTicketOrderPayouts({
            ticketPriceCents,
            quantity: ticketsSoldCount,
            venuePayoutPercent,
            artistPayoutPercent,
            promoterPayoutPercent
          })
        : {
            subtotalCents: 0,
            venuePayoutCents: 0,
            artistPayoutCents: 0,
            promoterPayoutCents: 0,
            platformCommissionCents: 0
          },
    [artistPayoutPercent, promoterPayoutPercent, ticketPriceCents, ticketsSoldCount, venuePayoutPercent]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/shows/${showId}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        quantity: requestedQuantity
      })
    });

    const data = await response.json();

    if (response.ok) {
      setBuyerName('');
      setBuyerEmail('');
      setQuantity('1');
      setIssuedTickets((data.tickets ?? []) as IssuedTicket[]);
      setMessage(`Order ${data.order.confirmationCode} confirmed. ${data.message}`);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not complete the ticket order.');
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
            Secure ticket portal over SSL/TLS. Every ticket gets a serialized token and venue-verification QR code, with no platform commission taken from the split.
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
          Tickets sold
        </div>
        <div className="stat">
          <strong>{remainingTickets === null ? 'Open' : remainingTickets}</strong>
          Remaining
        </div>
        <div className="stat">
          <strong>{formatCurrencyFromCents(ticketPriceCents * ticketsSoldCount)}</strong>
          Gross ticket sales
        </div>
      </div>

      <div className="ticketing-split-grid">
        <div className="signal-card">
          <strong>{venueName}</strong>
          <span>{formatPercent(venuePayoutPercent)} share</span>
          <span>{formatCurrencyFromCents(soldSummary.venuePayoutCents)} from sold tickets</span>
        </div>
        <div className="signal-card">
          <strong>{artistName}</strong>
          <span>{formatPercent(artistPayoutPercent)} share</span>
          <span>{formatCurrencyFromCents(soldSummary.artistPayoutCents)} from sold tickets</span>
        </div>
        <div className="signal-card">
          <strong>{promoterName ?? 'Promoter pool'}</strong>
          <span>{formatPercent(promoterPayoutPercent)} fixed promoter share</span>
          <span>{formatCurrencyFromCents(soldSummary.promoterPayoutCents)} from sold tickets</span>
        </div>
      </div>

      {remainingTickets === 0 ? (
        <div className="empty">This ticket allocation is sold out.</div>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <div className="grid grid-2">
            <label className="field">
              <span>Your name</span>
              <input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="Night Owl" required />
            </label>

            <label className="field">
              <span>Email</span>
              <input type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} placeholder="fan@ihype.org" required />
            </label>
          </div>

          <div className="grid grid-2">
            <label className="field">
              <span>Quantity</span>
              <input
                inputMode="numeric"
                max={remainingTickets === null ? 8 : Math.max(remainingTickets, 1)}
                min="1"
                step="1"
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </label>

            <div className="ticketing-split-preview">
              <div className="meta">Order preview</div>
              <div className="ticketing-order-summary">
                <div><span>Total</span><strong>{formatCurrencyFromCents(preview.subtotalCents)}</strong></div>
                <div><span>{venueName}</span><strong>{formatCurrencyFromCents(preview.venuePayoutCents)}</strong></div>
                <div><span>{artistName}</span><strong>{formatCurrencyFromCents(preview.artistPayoutCents)}</strong></div>
                <div><span>{promoterName ?? 'Promoter pool'}</span><strong>{formatCurrencyFromCents(preview.promoterPayoutCents)}</strong></div>
              </div>
            </div>
          </div>

          <div className="cta-row">
            <button className="button" disabled={pending} type="submit">
              {pending ? 'Processing...' : 'Buy tickets'}
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
