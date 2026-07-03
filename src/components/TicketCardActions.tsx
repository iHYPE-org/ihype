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
}: {
  orderId: string;
  tickets: TicketRef[];
}) {
  const [showQr, setShowQr] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const router = useRouter();

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
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(240,235,229,.4)', letterSpacing: '.04em' }}>
                {t.serializedId}
              </span>
            </div>
          ))}
        </div>
      )}

      {transferOpen && (
        <div
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && closeTransfer()}
          role="dialog"
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: 'var(--bg2, #100d09)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%' }}>
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
    </>
  );
}
