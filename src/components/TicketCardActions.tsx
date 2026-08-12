'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

interface TicketRef {
  id: string;
  serializedId: string;
  status?: string;
}

export function TicketCardActions({
  orderId,
  orderStatus,
  tickets,
  showsAt,
  showCancel,
}: {
  orderId: string;
  orderStatus?: string;
  tickets: TicketRef[];
  showsAt?: string;
  showCancel?: boolean;
}) {
  const [showQr, setShowQr] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelDone, setCancelDone] = useState<string | null>(null);
  const [resaleOpen, setResaleOpen] = useState(false);
  const [resalePrice, setResalePrice] = useState('');
  const [resaleSubmitting, setResaleSubmitting] = useState(false);
  const [resaleError, setResaleError] = useState<string | null>(null);
  const [resaleDone, setResaleDone] = useState<string | null>(null);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendDone, setResendDone] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  // list-resale acts on a single ticket (not the whole order) — mirror the
  // existing share() precedent of treating the first ticket as the
  // representative one. A ticket that's already been scanned for entry is
  // not eligible (the API 400s on this), so pick the first VALID one and
  // hide/redirect the flow when none exists, the same way the cancel modal
  // swaps to an explanatory message instead of a form when it's too late.
  const resaleTicket = tickets.find((t) => t.status === 'VALID') ?? (tickets.some((t) => t.status) ? undefined : tickets[0]);

  const hoursUntilShow = showsAt ? (new Date(showsAt).getTime() - Date.now()) / 3_600_000 : null;
  const tooLateToCancel = hoursUntilShow !== null && hoursUntilShow < 48;

  async function requestCancellation() {
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/tickets/${orderId}/refund`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error ?? t('ticketCardActions.cancelRequestErrorFallback', 'Could not submit cancellation request.'));
        return;
      }
      setCancelDone(t('ticketCardActions.cancelDoneMessage', 'Cancelled — your refund has been issued and should appear in a few business days.'));
      router.refresh();
    } catch {
      setCancelError(t('ticketCardActions.networkError', 'Network error'));
    } finally {
      setCancelSubmitting(false);
    }
  }

  function closeCancel() {
    setCancelOpen(false);
    setCancelError(null);
    setCancelDone(null);
  }

  async function transfer() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${orderId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('ticketCardActions.transferErrorFallback', 'Transfer failed'));
        return;
      }
      setDone(t('ticketCardActions.transferDoneMessage', 'Transferred. The recipient has been emailed their tickets.'));
      router.refresh();
    } catch {
      setError(t('ticketCardActions.networkError', 'Network error'));
    } finally {
      setSubmitting(false);
    }
  }

  async function share() {
    const first = tickets[0];
    if (!first) return;
    const url = `${window.location.origin}/tickets/${first.serializedId}`;
    if (navigator.share) {
      await navigator.share({ title: t('ticketCardActions.shareTitle', 'My iHYPE ticket'), url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      alert(t('ticketCardActions.shareCopiedAlert', 'Ticket link copied to clipboard.'));
    }
  }

  function closeTransfer() {
    setTransferOpen(false);
    setEmail('');
    setError(null);
    setDone(null);
  }

  async function listForResale() {
    if (!resaleTicket) return;
    setResaleSubmitting(true);
    setResaleError(null);
    try {
      const priceCents = Math.round(parseFloat(resalePrice) * 100);
      const res = await fetch(`/api/tickets/${resaleTicket.serializedId}/list-resale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resalePriceCents: priceCents }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResaleError(data.error ?? t('ticketCardActions.resaleErrorFallback', 'Could not list ticket for resale.'));
        return;
      }
      setResaleDone(data.message ?? t('ticketCardActions.resaleDoneFallback', 'Ticket listed for resale.'));
      router.refresh();
    } catch {
      setResaleError(t('ticketCardActions.networkError', 'Network error'));
    } finally {
      setResaleSubmitting(false);
    }
  }

  function closeResale() {
    setResaleOpen(false);
    setResalePrice('');
    setResaleError(null);
    setResaleDone(null);
  }

  async function resendConfirmation() {
    setResendSubmitting(true);
    setResendError(null);
    setResendDone(null);
    try {
      const res = await fetch('/api/tickets/resend-confirmation', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setResendError(data.error ?? t('ticketCardActions.resendErrorFallback', 'Could not resend confirmation email.'));
        return;
      }
      setResendDone(t('ticketCardActions.resendDoneMessage', 'Confirmation email sent.'));
    } catch {
      setResendError(t('ticketCardActions.networkError', 'Network error'));
    } finally {
      setResendSubmitting(false);
    }
  }

  return (
    <>
      <div className="ticket-actions">
        <button className="btn btn-primary" onClick={() => setShowQr((v) => !v)} type="button">
          {showQr ? t('ticketCardActions.hideQrButton', 'Hide QR Code') : t('ticketCardActions.showQrButton', 'Show QR Code')}
        </button>
        <button className="btn" onClick={() => setTransferOpen(true)} type="button">{t('ticketCardActions.transferButton', 'Transfer')}</button>
        <button className="btn" onClick={share} type="button">{t('ticketCardActions.shareButton', 'Share')}</button>
        {resaleTicket && (
          <button className="btn" onClick={() => setResaleOpen(true)} type="button">{t('ticketCardActions.listForResaleButton', 'List for resale')}</button>
        )}
        {(orderStatus === undefined || orderStatus === 'CAPTURED') && (
          <button className="btn" disabled={resendSubmitting} onClick={resendConfirmation} type="button">
            {resendSubmitting ? t('ticketCardActions.sendingButton', 'Sending…') : t('ticketCardActions.resendConfirmationButton', 'Resend confirmation')}
          </button>
        )}
        {showCancel && (
          <button className="btn" onClick={() => setCancelOpen(true)} style={{ color: 'var(--accent)' }} type="button">{t('ticketCardActions.cancelTicketButton', 'Cancel ticket')}</button>
        )}
      </div>
      {(resendDone || resendError) && (
        <p style={{ fontSize: '0.75rem', marginTop: 8, color: resendError ? 'var(--accent)' : 'var(--role-venue)' }}>{resendError ?? resendDone}</p>
      )}

      {showQr && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
          {tickets.map((ticket) => (
            <div key={ticket.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${t('ticketCardActions.qrCodeAlt', 'QR code for ticket')} ${ticket.serializedId}`}
                height={120}
                src={`/api/tickets/${ticket.serializedId}/qr`}
                style={{ borderRadius: 8, background: 'var(--ink)' }}
                width={120}
              />
              <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-a50)', letterSpacing: '.04em' }}>
                {ticket.serializedId}
              </span>
            </div>
          ))}
        </div>
      )}

      {transferOpen && (
        <div
          aria-modal="true"
          className="ihype-sheet-overlay"
          onClick={(e) => e.target === e.currentTarget && closeTransfer()}
          role="dialog"
        >
          <div className="ihype-sheet-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>{t('ticketCardActions.transferModalTitle', 'Transfer tickets')}</h3>
            {done ? (
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--role-venue)', marginBottom: 16 }}>{done}</p>
                <button className="btn btn-primary" onClick={closeTransfer} style={{ width: '100%' }} type="button">{t('ticketCardActions.closeButton', 'Close')}</button>
              </>
            ) : (
              <>
                <label htmlFor="ticket-transfer-email" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-a50)', marginBottom: 6 }}>{t('ticketCardActions.recipientEmailLabel', "Recipient's email")}</label>
                <input
                  id="ticket-transfer-email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('ticketCardActions.recipientEmailPlaceholder', 'friend@example.com')}
                  style={{ width: '100%', marginBottom: 16, padding: '10px 14px', border: '1px solid var(--hair-100)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)' }}
                  type="email"
                  value={email}
                />
                {error && <p style={{ color: 'var(--accent)', fontSize: '0.75rem', marginBottom: 12 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={closeTransfer} style={{ flex: 1 }} type="button">{t('ticketCardActions.cancelButton', 'Cancel')}</button>
                  <button className="btn btn-primary" disabled={submitting || !email} onClick={transfer} style={{ flex: 1 }} type="button">
                    {submitting ? t('ticketCardActions.transferringButton', 'Transferring…') : t('ticketCardActions.transferButton', 'Transfer')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {resaleOpen && resaleTicket && (
        <div
          aria-modal="true"
          className="ihype-sheet-overlay"
          onClick={(e) => e.target === e.currentTarget && closeResale()}
          role="dialog"
        >
          <div className="ihype-sheet-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>{t('ticketCardActions.resaleModalTitle', 'List for resale')}</h3>
            {resaleDone ? (
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--role-venue)', marginBottom: 16 }}>{resaleDone}</p>
                <button className="btn btn-primary" onClick={closeResale} style={{ width: '100%' }} type="button">{t('ticketCardActions.closeButton', 'Close')}</button>
              </>
            ) : (
              <>
                <label htmlFor="ticket-resale-price" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-a50)', marginBottom: 6 }}>{t('ticketCardActions.resalePriceLabel', 'Resale price (max 110% of face value)')}</label>
                <input
                  id="ticket-resale-price"
                  min="0"
                  onChange={(e) => setResalePrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  style={{ width: '100%', marginBottom: 16, padding: '10px 14px', border: '1px solid var(--hair-100)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)' }}
                  type="number"
                  value={resalePrice}
                />
                {resaleError && <p style={{ color: 'var(--accent)', fontSize: '0.75rem', marginBottom: 12 }}>{resaleError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={closeResale} style={{ flex: 1 }} type="button">{t('ticketCardActions.cancelButton', 'Cancel')}</button>
                  <button className="btn btn-primary" disabled={resaleSubmitting || !resalePrice} onClick={listForResale} style={{ flex: 1 }} type="button">
                    {resaleSubmitting ? t('ticketCardActions.listingButton', 'Listing…') : t('ticketCardActions.listForResaleButton', 'List for resale')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cancelOpen && (
        <div
          aria-modal="true"
          className="ihype-sheet-overlay"
          onClick={(e) => e.target === e.currentTarget && closeCancel()}
          role="dialog"
        >
          <div className="ihype-sheet-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>{t('ticketCardActions.cancelModalTitle', 'Cancel ticket')}</h3>
            {cancelDone ? (
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--role-venue)', marginBottom: 16 }}>{cancelDone}</p>
                <button className="btn btn-primary" onClick={closeCancel} style={{ width: '100%' }} type="button">{t('ticketCardActions.closeButton', 'Close')}</button>
              </>
            ) : tooLateToCancel ? (
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--warning-text)', marginBottom: 16 }}>
                  {t('ticketCardActions.tooLateToCancelMessage', 'Cancellations close 48 hours before the show, so this ticket can no longer be cancelled — you can still transfer it to someone else.')}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={closeCancel} style={{ flex: 1 }} type="button">{t('ticketCardActions.closeButton', 'Close')}</button>
                  <button className="btn btn-primary" onClick={() => { setCancelOpen(false); setTransferOpen(true); }} style={{ flex: 1 }} type="button">{t('ticketCardActions.transferInsteadButton', 'Transfer instead')}</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ink-a60)', marginBottom: 16 }}>
                  {t('ticketCardActions.cancelRefundInfo', 'Your card will be refunded immediately. Cancellation is allowed up to 48 hours before the event.')}
                </p>
                {cancelError && <p style={{ color: 'var(--accent)', fontSize: '0.75rem', marginBottom: 12 }}>{cancelError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={closeCancel} style={{ flex: 1 }} type="button">{t('ticketCardActions.keepTicketButton', 'Keep ticket')}</button>
                  <button className="btn btn-primary" disabled={cancelSubmitting} onClick={requestCancellation} style={{ flex: 1 }} type="button">
                    {cancelSubmitting ? t('ticketCardActions.submittingButton', 'Submitting…') : t('ticketCardActions.cancelRefundButton', 'Cancel & refund')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
