'use client';

import { useState } from 'react';

/**
 * Real "Connect"/"Reconnect" action for a profile's Stripe Connect payout
 * account — POSTs to /api/stripe/connect/onboard (the real Stripe Connect
 * Express plumbing in src/lib/stripe.ts) and redirects the browser to the
 * real returned onboardingUrl. No client-side fabrication of connection
 * state: this only ever navigates to Stripe's own hosted flow.
 */
export function PayoutConnectButton({ profileId, label }: { profileId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.onboardingUrl) {
        setError(data.error ?? 'Something went wrong — try again.');
        setBusy(false);
        return;
      }
      window.location.href = data.onboardingUrl;
    } catch {
      setError('Network error — try again.');
      setBusy(false);
    }
  }

  return (
    <div className="pcb">
      <button className="pcb-btn" disabled={busy} onClick={connect} type="button">
        {busy ? 'Connecting…' : label}
      </button>
      {error && <p className="pcb-error">{error}</p>}

      <style>{`
        .pcb-btn { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; padding: 10px 18px; border-radius: var(--radius-pill); border: none; cursor: pointer; background: var(--role-venue, #22e5d4); color: #06110f; white-space: nowrap; }
        .pcb-btn:disabled { opacity: 0.6; cursor: default; }
        .pcb-error { color: var(--accent, #ff5029); font-size: 12px; margin: 8px 0 0; }
      `}</style>
    </div>
  );
}
