'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TicketRef {
  id: string;
  serializedId: string;
}

export function TicketCardActions({
  orderId,
  tickets,
  showsAt,
  showCancel,
}: {
  orderId: string;
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
  const router = useRouter();

  const hoursUntilShow = showsAt ? (new Date(showsAt).getTime() - Date.now()) / 3_600_000 : null;
  const tooLateToCancel = hoursUntilShow !== null && hoursUntilShow < 48;

  async function requestCancellation() {
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/tickets/${orderId}/refund`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error ?? 'Could not submit cancellation request.');
        return;
      }
      setCancelDone('Cancellation requested. Our support team will process your refund shortly.');
      router.refresh();
    } catch {
      setCancelError('Network error');
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
        setError(data.error ?? 'Transfer failed');
        return;
      }
      setDone('Transferred. The recipient has been emailed their tickets.');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function share() {
    const first = tickets[0];
    if (!first) return;
    const url = `${window.location.origin}/tickets/${first.serializedId}`;
    if (navigator.share) {
      await navigator.share({ title: 'My iHYPE ticket', url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      alert('Ticket link copied to clipboard.');
    }
  }

  function closeTransfer() {
    setTransferOpen(false);
    setEmail('');
    setError(null);
    setDone(null);
  }

  return (
    <>
      <div className="ticket-actions">
        <button className="btn btn-primary" onClick={() => setShowQr((v) => !v)} type="button">
          {showQr ? 'Hide QR Code' : 'Show QR Code'}
        </button>
        <button className="btn" onClick={() => setTransferOpen(true)} type="button">Transfer</button>
        <button className="btn" onClick={share} type="button">Share</button>
        {showCancel && (
          <button className="btn" onClick={() => setCancelOpen(true)} style={{ color: '#ff5029' }} type="button">Cancel ticket</button>
        )}
      </div>

      {showQr && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
          {tickets.map((t) => (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`QR code for ticket ${t.serializedId}`}
                height={120}
                src={`/api/tickets/${t.serializedId}/qr`}
                style={{ borderRadius: 8, background: '#f0ebe5' }}
                width={120}
              />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(240,235,229,.5)', letterSpacing: '.04em' }}>
                {t.serializedId}
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
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Transfer tickets</h3>
            {done ? (
              <>
                <p style={{ fontSize: 13, color: '#22e5d4', marginBottom: 16 }}>{done}</p>
                <button className="btn btn-primary" onClick={closeTransfer} style={{ width: '100%' }} type="button">Close</button>
              </>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(240,235,229,.5)', marginBottom: 6 }}>Recipient&apos;s email</label>
                <input
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  style={{ width: '100%', marginBottom: 16, padding: '10px 14px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)' }}
                  type="email"
                  value={email}
                />
                {error && <p style={{ color: '#ff5029', fontSize: 12, marginBottom: 12 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={closeTransfer} style={{ flex: 1 }} type="button">Cancel</button>
                  <button className="btn btn-primary" disabled={submitting || !email} onClick={transfer} style={{ flex: 1 }} type="button">
                    {submitting ? 'Transferring…' : 'Transfer'}
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
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Cancel ticket</h3>
            {cancelDone ? (
              <>
                <p style={{ fontSize: 13, color: '#22e5d4', marginBottom: 16 }}>{cancelDone}</p>
                <button className="btn btn-primary" onClick={closeCancel} style={{ width: '100%' }} type="button">Close</button>
              </>
            ) : tooLateToCancel ? (
              <>
                <p style={{ fontSize: 13, color: '#ffb84a', marginBottom: 16 }}>
                  Cancellations close 48 hours before the show, so this ticket can no longer be cancelled — you can still transfer it to someone else.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={closeCancel} style={{ flex: 1 }} type="button">Close</button>
                  <button className="btn btn-primary" onClick={() => { setCancelOpen(false); setTransferOpen(true); }} style={{ flex: 1 }} type="button">Transfer instead</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'rgba(240,235,229,.6)', marginBottom: 16 }}>
                  We&apos;ll route this to our support team to process your refund. Cancellation is allowed up to 48 hours before the event.
                </p>
                {cancelError && <p style={{ color: '#ff5029', fontSize: 12, marginBottom: 12 }}>{cancelError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={closeCancel} style={{ flex: 1 }} type="button">Keep ticket</button>
                  <button className="btn btn-primary" disabled={cancelSubmitting} onClick={requestCancellation} style={{ flex: 1 }} type="button">
                    {cancelSubmitting ? 'Submitting…' : 'Cancel & refund'}
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
