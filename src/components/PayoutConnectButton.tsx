'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

/**
 * Real "Connect"/"Reconnect" action for a profile's Stripe Connect payout
 * account — POSTs to /api/stripe/connect/onboard (the real Stripe Connect
 * Express plumbing in src/lib/stripe.ts) and redirects the browser to the
 * real returned onboardingUrl. No client-side fabrication of connection
 * state: this only ever navigates to Stripe's own hosted flow.
 */
type ConnectState = 'connect' | 'reconnect' | 'finish-setup';

const STATE_KEY: Record<ConnectState, string> = {
  connect: 'poConnect',
  reconnect: 'poReconnect',
  'finish-setup': 'poFinishSetup',
};

export function PayoutConnectButton({ profileId, state }: { profileId: string; state: ConnectState }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = t(STATE_KEY[state]);

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
        setError(data.error ?? t('poConnectFailed', 'Connection failed — try again.'));
        setBusy(false);
        return;
      }
      window.location.href = data.onboardingUrl;
    } catch {
      setError(t('poConnectFailed', 'Connection failed — try again.'));
      setBusy(false);
    }
  }

  return (
    <div className="pcb">
      <button className="pcb-btn" disabled={busy} onClick={connect} type="button">
        {busy ? t('poConnecting', 'Connecting…') : label}
      </button>
      {error && <p className="pcb-error">{error}</p>}

      <style>{`
        .pcb-btn { font-family: var(--font-mono); font-size: 0.7813rem; text-transform: uppercase; letter-spacing: .08em; padding: 10px 18px; border-radius: var(--radius-pill); border: none; cursor: pointer; background: var(--role-venue); color: #06110f; white-space: nowrap; }
        .pcb-btn:disabled { opacity: 0.6; cursor: default; }
        .pcb-error { color: var(--accent); font-size: 0.7813rem; margin: 8px 0 0; }
      `}</style>
    </div>
  );
}
