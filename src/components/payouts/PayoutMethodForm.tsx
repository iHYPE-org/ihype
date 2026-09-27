'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

type Kind = 'BANK_TRANSFER' | 'CHECK' | 'PAYMENT_APP' | 'OTHER';

/**
 * "Where you get paid" — an artist's payment method, which every venue it
 * signs a split agreement with pays into (Split Agreement 5.2). An artist
 * needs no Stripe account since 2026-09-27: the venue pays the act directly.
 */
export function PayoutMethodForm({
  profileId,
  initialKind,
  initialDetails,
}: {
  profileId: string;
  initialKind: string | null;
  initialDetails: string | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>((initialKind as Kind) ?? 'PAYMENT_APP');
  const [details, setDetails] = useState(initialDetails ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const placeholder = kind === 'BANK_TRANSFER'
    ? t('payoutMethodForm.placeholderBank', 'Account holder name and how to reach you for bank details')
    : kind === 'CHECK'
      ? t('payoutMethodForm.placeholderCheck', 'Payee name and mailing address')
      : kind === 'PAYMENT_APP'
        ? t('payoutMethodForm.placeholderApp', 'App and handle, e.g. Venmo @yourband')
        : t('payoutMethodForm.placeholderOther', 'How the venue should pay you');

  async function save() {
    setState('saving');
    setError(null);
    try {
      const res = await fetch('/api/profile/payout-method', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, kind, details: details.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('payoutMethodForm.error', 'Could not save. Try again.'));
        setState('error');
        return;
      }
      setState('saved');
      router.refresh();
    } catch {
      setError(t('payoutMethodForm.networkError', 'Network error — try again.'));
      setState('error');
    }
  }

  return (
    <div className="pmf">
      <div className="pmf-label" id={`pmf-${profileId}`}>{t('payoutMethodForm.title', 'Where you get paid')}</div>
      <p className="pmf-hint">{t('payoutMethodForm.hint', 'Venues pay you here within 7 days of each show, under the agreement you sign. Only a venue you have signed with can see it. Changes take effect for payments due at least 3 days later.')}</p>
      <div className="pmf-row" role="group" aria-labelledby={`pmf-${profileId}`}>
        <select aria-label={t('payoutMethodForm.kindLabel', 'Payment method')} onChange={(e) => { setKind(e.target.value as Kind); setState('idle'); }} value={kind}>
          <option value="BANK_TRANSFER">{t('payoutMethodForm.kindBank', 'Bank transfer')}</option>
          <option value="CHECK">{t('payoutMethodForm.kindCheck', 'Check')}</option>
          <option value="PAYMENT_APP">{t('payoutMethodForm.kindApp', 'Payment app')}</option>
          <option value="OTHER">{t('payoutMethodForm.kindOther', 'Other')}</option>
        </select>
        <input
          aria-label={t('payoutMethodForm.detailsLabel', 'Payment details')}
          maxLength={300}
          onChange={(e) => { setDetails(e.target.value); setState('idle'); }}
          placeholder={placeholder}
          value={details}
        />
      </div>
      <p className="pmf-warn">{t('payoutMethodForm.warn', 'Do not type full bank account or card numbers here. Share those with the venue directly if you choose bank transfer.')}</p>
      <button className="pmf-btn" disabled={state === 'saving' || details.trim().length < 3} onClick={save} type="button">
        {state === 'saving' ? t('payoutMethodForm.saving', 'Saving…') : t('payoutMethodForm.save', 'Save')}
      </button>
      <span aria-live="polite" className="pmf-status">
        {state === 'saved' ? t('payoutMethodForm.saved', 'Saved.') : error}
      </span>
      <style>{`
        .pmf { padding-top: 14px; border-top: 1px solid var(--line); }
        .pmf-label { font-size: 0.9375rem; font-weight: 600; color: var(--ink); }
        .pmf-hint, .pmf-warn { font-size: 0.9375rem; color: var(--ink-a65); line-height: 1.55; margin: 6px 0 10px; }
        .pmf-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .pmf-row select, .pmf-row input { background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 9px 12px; color: var(--ink); font-size: 1rem; min-height: 44px; }
        .pmf-row input { flex: 1; min-width: 200px; }
        .pmf-btn { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .06em; padding: 10px 18px; border-radius: var(--radius-pill); border: none; cursor: pointer; background: var(--accent); color: var(--ink-on-accent); min-height: 44px; }
        .pmf-btn:disabled { opacity: .6; cursor: default; }
        .pmf-status { margin-left: 12px; font-size: 0.9375rem; color: var(--ink-a65); }
      `}</style>
    </div>
  );
}
