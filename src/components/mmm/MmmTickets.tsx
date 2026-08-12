'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MmmMeTicket } from '@/lib/mmm-me';

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

  if (tickets.length === 0) {
    return (
      <p className="mmm-me-note">
        No tickets yet. When you buy one it lives here — and it opens with no signal,
        so a basement with no bars is not a problem at the door.
      </p>
    );
  }

  return (
    <>
      <div className="mmm-ticket-list">
        {tickets.map((ticket) => {
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

      {open && <TicketSheet onClose={() => setOpen(null)} ticket={open} />}
    </>
  );
}

function TicketSheet({ onClose, ticket }: { onClose: () => void; ticket: MmmMeTicket }) {
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
          {ticket.scannedAt ? 'Attended' : 'Upcoming'} · {when.full}
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

        {/* Transfer is a real endpoint that reissues every ticket in the order
            with a new serializedId, so the old QR dies on transfer. It lives on
            the legacy ticket page for now; this links there rather than
            pretending to do it here. */}
        <a className="mmm-ticket-transfer" href={`/tickets/${ticket.serializedId}`}>
          Transfer this ticket
        </a>
      </div>
    </div>
  );
}
