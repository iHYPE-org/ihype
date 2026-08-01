'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  profileId: string;
  connected: boolean;
  hasStarted: boolean;
}

/**
 * Owner-only control that starts (or resumes) Stripe Connect Express
 * onboarding for an artist/venue/DJ profile. Stripe hosts the actual
 * identity/bank-account steps — this just kicks off createConnectOnboardingUrl()
 * (POST /api/stripe/connect/onboard) and redirects the browser there.
 */
export function ConnectPayoutButton({ profileId, connected, hasStarted }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (!res.ok || !data.onboardingUrl) {
        setError(data.error ?? t('connectPayoutButton.startError', 'Could not start payout onboarding.'));
        setLoading(false);
        return;
      }
      window.location.href = data.onboardingUrl;
    } catch {
      setError(t('connectPayoutButton.networkError', 'Could not reach the payments server.'));
      setLoading(false);
    }
  }

  if (connected) {
    return (
      <div className="connect-payout-badge connect-payout-badge-ok">
        <span className="connect-payout-dot" />
        {t('connectPayoutButton.connectedLabel', 'Payout account connected')}
      </div>
    );
  }

  return (
    <div className="connect-payout-panel">
      <div>
        <div className="connect-payout-badge connect-payout-badge-pending">
          <span className="connect-payout-dot" />
          {hasStarted ? t('connectPayoutButton.incompleteLabel', 'Payout onboarding incomplete') : t('connectPayoutButton.notConnectedLabel', 'No payout account connected')}
        </div>
        <p className="connect-payout-copy">
          {t('connectPayoutButton.description', 'Connect a Stripe payout account to receive your share of ticket sales. This is handled entirely by Stripe — iHYPE never sees your bank details.')}
        </p>
      </div>
      <button type="button" className="connect-payout-btn" onClick={handleClick} disabled={loading}>
        {loading ? t('connectPayoutButton.redirecting', 'Redirecting…') : hasStarted ? t('connectPayoutButton.finishSetup', 'Finish payout setup') : t('connectPayoutButton.connectButton', 'Connect payout account')}
      </button>
      {error ? <p className="connect-payout-error">{error}</p> : null}

      <style>{`
        .connect-payout-panel { padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--hair-30, rgba(255,255,255,.02)); display: flex; flex-direction: column; gap: 10px; }
        .connect-payout-badge { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; }
        .connect-payout-badge-ok { color: var(--success, var(--role-venue)); }
        .connect-payout-badge-pending { color: var(--warning, var(--role-promoter)); }
        .connect-payout-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .connect-payout-copy { font-size: .85rem; color: var(--ink-2); line-height: 1.5; margin: 8px 0 0; }
        .connect-payout-btn { align-self: flex-start; background: var(--accent); color: var(--ink-on-accent); border: none; border-radius: 8px; padding: 10px 20px; font-family: var(--font-display); font-weight: 700; font-size: .85rem; cursor: pointer; }
        .connect-payout-btn:disabled { opacity: .6; cursor: default; }
        .connect-payout-error { font-size: .78rem; color: var(--accent); margin: 0; }
      `}</style>
    </div>
  );
}
