'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MmmMeTicket } from '@/lib/mmm-me';
import { TicketClaimForm } from '@/components/TicketTransferPanel';

const DEMO_QR = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="white"/><g fill="#07101f"><path d="M8 8h36v36H8zm8 8v20h20V16zM76 8h36v36H76zm8 8v20h20V16zM8 76h36v36H8zm8 8v20h20V84zM54 8h12v12H54zm0 22h12v24H54zm22 24h12v12H76zm22 0h14v14H98zM54 76h12v36H54zm22 0h12v12H76zm12 12h24v24H88zM76 100h12v12H76z"/></g></svg>')}`;

const DEMO_TICKETS: MmmMeTicket[] = [
  { serializedId: 'DEMO-7F3A-2026', title: 'Harbor Lights', where: 'Signal Hall · Portland', startsAt: '2026-10-09T19:30:00-04:00', faceValue: '$18', processingFee: '$0.82', scannedAt: null, qrDataUrl: DEMO_QR },
  { serializedId: 'DEMO-2C91-2026', title: 'Static Bloom', where: 'The Foundry · Biddeford', startsAt: '2026-06-14T20:00:00-04:00', faceValue: '$14', processingFee: '$0.70', scannedAt: '2026-06-14T19:42:00-04:00', qrDataUrl: DEMO_QR },
];

/**
 * My Tickets, inside ME.
 *
 * This surface used to be two links out to `/tickets` and `/shows`, which
 * dropped the member into the legacy shell — a different header, a different
 * player, no way back into MMM for the rest of the session. The tickets are
 * now here, and the ticket itself opens as a sheet over the shell.
 *
 * Every figure comes from the member's own rows, including "Stripe processing,
 * paid by the buyer" — which is now a real charge rather than a design mock:
 * iHYPE is a nonprofit, takes $0, and does not absorb Stripe's cost of moving
 * the money either. It is shown per TICKET (an order of three carries one fee),
 * and omitted entirely on orders placed before the fee existed.
 */

function dayParts(iso: string) {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString('en-US', { day: '2-digit' }),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    full: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase(),
  };
}

export function MmmTickets({ tickets }: { tickets: MmmMeTicket[] }) {
  const [open, setOpen] = useState<MmmMeTicket | null>(null);
  const demo = tickets.length === 0;
  const visibleTickets = demo ? DEMO_TICKETS : tickets;

  return (
    <>
      {/* Claiming sits on the LIST, not on a ticket page: the person redeeming a
          code does not have the ticket yet, so they cannot open its page. Above
          the list because on a first transfer the list below is empty or demo
          content, and a control under an empty state reads as part of it. */}
      <div style={{ padding: '0 2px 14px' }}>
        <TicketClaimForm />
      </div>
      {demo && (
        <div className="mmm-demo-head mmm-ticket-demo-head">
          <span className="mmm-demo-badge">Demo content</span>
          <p>Your real tickets, entry codes and transfer status will appear here.</p>
        </div>
      )}
      <div className="mmm-ticket-list">
        {visibleTickets.map((ticket) => {
          const when = dayParts(ticket.startsAt);
          const attended = Boolean(ticket.scannedAt);
          return (
            <div className="mmm-ticket-row" key={ticket.serializedId}>
              <div aria-hidden="true" className="mmm-ticket-date">
                <span className="mmm-ticket-day">{when.day}</span>
                <span className="mmm-ticket-month">{when.month}</span>
              </div>
              <div className="mmm-ticket-main">
                <div className="mmm-ticket-title">{ticket.title}</div>
                {ticket.where && <div className="mmm-ticket-where">{ticket.where}</div>}
                <div className="mmm-ticket-meta">
                  {ticket.serializedId}
                  {ticket.faceValue ? ` · ${ticket.faceValue}` : ''}
                </div>
              </div>
              <div className="mmm-ticket-actions">
                <span className="mmm-ticket-status" data-attended={attended || undefined}>
                  {attended ? 'Attended' : 'Upcoming'}
                </span>
                {attended ? (
                  <span className="mmm-ticket-checkin">
                    Checked in {dayParts(ticket.scannedAt!).time}
                  </span>
                ) : (
                  <>
                    <span className="mmm-ticket-checkin">Doors {when.time}</span>
                    <button className="mmm-ticket-view" onClick={() => setOpen(ticket)} type="button">
                      View ticket
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {open && <TicketSheet demo={demo} onClose={() => setOpen(null)} ticket={open} />}
    </>
  );
}

function TicketSheet({ demo, onClose, ticket }: { demo?: boolean; onClose: () => void; ticket: MmmMeTicket }) {
  const when = dayParts(ticket.startsAt);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // Focus in, and back where it came from on close — the same contract the
  // shell's drawer and the permission primer keep.
  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => returnTo.current?.focus?.();
  }, []);

  const onKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  return (
    <div className="mmm-ticket-scrim" onPointerDown={onClose} role="presentation">
      <div
        aria-labelledby="mmm-ticket-title"
        aria-modal="true"
        className="mmm-ticket-sheet"
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close ticket" className="mmm-ticket-close" onClick={onClose} ref={closeRef} type="button">
          ✕
        </button>

        <div className="mmm-ticket-eyebrow">
          {demo ? 'Demo ticket · ' : ''}{ticket.scannedAt ? 'Attended' : 'Upcoming'} · {when.full}
        </div>
        <h3 className="mmm-ticket-sheet-title" id="mmm-ticket-title">{ticket.title}</h3>
        {ticket.where && <div className="mmm-ticket-sheet-where">{ticket.where}</div>}

        {/* The QR is an inline SVG data URL generated server-side, so it needs
            no network of its own once this page is cached — which is what makes
            the offline promise hold at the door. */}
        <div className="mmm-ticket-qr">
          <img alt={`Entry code ${ticket.serializedId}`} src={ticket.qrDataUrl} />
        </div>
        <div className="mmm-ticket-code">{ticket.serializedId}</div>
        <div className="mmm-ticket-rule">Doors {when.time} · One scan, one entry</div>

        <div className="mmm-ticket-money">
          <div className="mmm-ticket-money-row">
            <span>Face value</span>
            <strong>{ticket.faceValue ?? '—'}</strong>
          </div>
          {/* Stripe's cost of moving the money, paid by the buyer. iHYPE is a
              nonprofit and absorbs no fee, so it is named and shown rather than
              folded into the price. Absent on orders placed before the fee
              existed — a $0.00 there would read as a fee that was waived. */}
          {ticket.processingFee && (
            <div className="mmm-ticket-money-row">
              <span>Stripe processing, paid by the buyer</span>
              <strong>{ticket.processingFee}</strong>
            </div>
          )}
          <div className="mmm-ticket-money-row">
            <span>iHYPE fee</span>
            <strong className="mmm-ticket-zero">$0.00</strong>
          </div>
        </div>

        {/* Sales are final; transfer is the way out, so the two are stated
            together. Any processing fee on a transfer belongs to whoever
            receives the ticket — iHYPE is a nonprofit and absorbs no fee, and
            saying so here is what makes that fair rather than a surprise. */}
        <p className="mmm-ticket-final">
          All sales are final. Transfer a ticket instead — any processing fee on a
          transfer is the recipient&rsquo;s.
        </p>

        {/* Transfer is a real endpoint that reissues every ticket in the order
            with a new serializedId, so the old QR dies on transfer. It lives on
            the legacy ticket page for now; this links there rather than
            pretending to do it here. */}
        {demo ? (
          <span aria-disabled="true" className="mmm-ticket-transfer">Transfer preview</span>
        ) : (
          <a className="mmm-ticket-transfer" href={`/app/me/tickets/${ticket.serializedId}`}>
            Transfer this ticket
          </a>
        )}
      </div>
    </div>
  );
}
