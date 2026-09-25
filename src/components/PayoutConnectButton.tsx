'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { useRouter } from 'next/navigation';
import { openExternalUrl } from '@/lib/open-external';
import { MoneyTermsDisclosure } from '@/components/MoneyTermsDisclosure';
import { MONEY_TERMS_VERSION, isMoneyTermsRole } from '@/lib/money-terms';

/**
 * Real "Connect"/"Reconnect" action for a profile's Stripe Connect payout
 * account — POSTs to /api/stripe/connect/onboard (the real Stripe Connect
 * Express plumbing in src/lib/stripe.ts) and redirects the browser to the
 * real returned onboardingUrl. No client-side fabrication of connection
 * state: this only ever navigates to Stripe's own hosted flow.
 */
type ConnectState = 'connect' | 'reconnect' | 'finish-setup';

/* Key AND fallback, because the key alone shipped: these three keys were
   never added to the dictionaries, and `t()` returns the key when it misses —
   so the live button read "POCONNECT" (the key, uppercased by this
   component's own CSS) on the page where a venue agrees to be seller of
   record. A t() call without a fallback fails like that silently; the two
   calls below this one always had fallbacks and never broke. */
const STATE_LABEL: Record<ConnectState, [string, string]> = {
  connect: ['poConnect', 'Connect'],
  reconnect: ['poReconnect', 'Reconnect'],
  'finish-setup': ['poFinishSetup', 'Finish setup'],
};

export function PayoutConnectButton({ profileId, profileType, state }: { profileId: string; profileType: string; state: ConnectState }) {
  /* An artist or venue reads the money terms and ticks the box before the
     button works; the route refuses without it (MONEY_TERMS_REQUIRED). A fan
     profile holding a payable from the old split sells nothing and is not
     asked. */
  const needsTerms = isMoneyTermsRole(profileType);
  const [acknowledged, setAcknowledged] = useState(false);
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = t(...STATE_LABEL[state]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, ...(needsTerms ? { acceptedMoneyTermsVersion: MONEY_TERMS_VERSION } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.onboardingUrl) {
        setError(data.error ?? t('poConnectFailed', 'Connection failed — try again.'));
        setBusy(false);
        return;
      }
      await openExternalUrl(data.onboardingUrl, { onReturn: () => router.refresh() });
    } catch {
      setError(t('poConnectFailed', 'Connection failed — try again.'));
      setBusy(false);
    }
  }

  return (
    /* No class on the wrapper: `.pcb-btn` and `.pcb-error` below carry the
       whole control, and the `pcb` hook they sat inside answered to nothing. */
    <div className="pcb-stack">
      {needsTerms && isMoneyTermsRole(profileType) ? (
        <MoneyTermsDisclosure acknowledged={acknowledged} onAcknowledgeChange={setAcknowledged} role={profileType} />
      ) : null}
      <button className="pcb-btn" disabled={busy || (needsTerms && !acknowledged)} onClick={connect} type="button">
        {busy ? t('poConnecting', 'Connecting…') : label}
      </button>
      {error && <p className="pcb-error">{error}</p>}

      <style>{`
        .pcb-btn { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .08em; padding: 10px 18px; border-radius: var(--radius-pill); border: none; cursor: pointer; background: var(--role-venue); color: var(--ink-on-accent); white-space: nowrap; }
        .pcb-stack { display: grid; gap: 12px; justify-items: start; flex: 1 1 100%; }
        .pcb-btn:disabled { opacity: 0.6; cursor: default; }
        .pcb-error { color: var(--accent-text); font-size: 0.9375rem; margin: 8px 0 0; }
      `}</style>
    </div>
  );
}
