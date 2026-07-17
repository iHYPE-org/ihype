'use client';

import { useState } from 'react';

/**
 * Send side of the BookingRequest flow — sits on a venue's "demand radar"
 * (/me/booking) recommended-artist card. POSTs to /api/booking-requests with
 * { toProfileId, message }. The route 409s if a pending request to this
 * profile already exists, which we surface as an already-sent state.
 */
export function SendBookingRequestButton({ toProfileId, defaultMessage }: { toProfileId: string; defaultMessage: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<'idle' | 'sent' | 'already' | 'error'>('idle');

  async function submit() {
    if (!message.trim()) return;
    setPending(true);
    try {
      const res = await fetch('/api/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toProfileId, message: message.trim() }),
      });
      if (res.ok) {
        setState('sent');
        setOpen(false);
      } else if (res.status === 409) {
        setState('already');
        setOpen(false);
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    } finally {
      setPending(false);
    }
  }

  if (state === 'sent') {
    return <span className="send-booking-done">Request sent</span>;
  }
  if (state === 'already') {
    return <span className="send-booking-done">Already pending</span>;
  }

  return (
    <div className="send-booking-wrap">
      {!open ? (
        <button type="button" className="send-booking-btn" onClick={() => setOpen(true)}>
          Send booking request
        </button>
      ) : (
        <div className="send-booking-panel">
          <textarea
            className="send-booking-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
          />
          {state === 'error' && <p className="send-booking-error">Couldn&apos;t send that — try again.</p>}
          <div className="send-booking-actions">
            <button type="button" className="send-booking-btn" disabled={pending} onClick={submit}>
              {pending ? 'Sending…' : 'Send'}
            </button>
            <button type="button" className="send-booking-cancel" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        .send-booking-wrap { margin-top: 10px; }
        .send-booking-btn { font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 12px; color: #fff; background: linear-gradient(135deg, #ff5029, #ff3e6e); border: none; border-radius: 9999px; padding: 8px 14px; cursor: pointer; }
        .send-booking-btn:disabled { opacity: 0.6; cursor: default; }
        .send-booking-cancel { font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 12px; color: var(--ink-a55); background: transparent; border: 1px solid var(--line); border-radius: 9999px; padding: 8px 14px; cursor: pointer; }
        .send-booking-panel { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
        .send-booking-textarea { width: 100%; box-sizing: border-box; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--ink); background: var(--bg2, #0a0805); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; resize: vertical; }
        .send-booking-actions { display: flex; gap: 8px; }
        .send-booking-done { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #22e5d4; }
        .send-booking-error { font-size: 12px; color: #ff5029; margin: 0; }
      `}</style>
    </div>
  );
}
