'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

const toCents = (dollars: string) => Math.round(parseFloat(dollars || '0') * 100);

async function readFailure(res: Response): Promise<string | null> {
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return typeof data.error === 'string' ? data.error : 'error';
}

/** The venue's show-level lines: admission sold elsewhere, chargebacks lost (Split Agreement 6.2, 7.2). */
export function StatementVenueLines({ showId, offPlatformCents, offPlatformNote, chargebacksLostCents, chargebacksNote }: {
  showId: string; offPlatformCents: number; offPlatformNote: string | null; chargebacksLostCents: number; chargebacksNote: string | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [off, setOff] = useState((offPlatformCents / 100).toFixed(2));
  const [offNote, setOffNote] = useState(offPlatformNote ?? '');
  const [cb, setCb] = useState((chargebacksLostCents / 100).toFixed(2));
  const [cbNote, setCbNote] = useState(chargebacksNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    let failure: string | null;
    try {
      const res = await fetch(`/api/shows/${showId}/settlement`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offPlatformCents: toCents(off), offPlatformNote: offNote.trim() || null,
          chargebacksLostCents: toCents(cb), chargebacksNote: cbNote.trim() || null,
        }),
      });
      failure = await readFailure(res);
    } catch {
      failure = 'network';
    }
    setBusy(false);
    if (failure) { setError(failure === 'network' ? t('settlementActions.networkError', 'Network error — try again.') : failure); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="sa-form">
      <div className="sa-grid">
        <label>
          <span>{t('settlementActions.offPlatformLabel', 'Admission sold outside iHYPE ($, before tax)')}</span>
          <input inputMode="decimal" onChange={(e) => setOff(e.target.value.replace(/[^\d.]/g, ''))} value={off} />
        </label>
        <label>
          <span>{t('settlementActions.offPlatformNoteLabel', 'How it was sold (door, other channels)')}</span>
          <input maxLength={500} onChange={(e) => setOffNote(e.target.value)} value={offNote} />
        </label>
        <label>
          <span>{t('settlementActions.chargebacksLabel', 'Chargebacks you fought and lost ($)')}</span>
          <input inputMode="decimal" onChange={(e) => setCb(e.target.value.replace(/[^\d.]/g, ''))} value={cb} />
        </label>
        <label>
          <span>{t('settlementActions.chargebacksNoteLabel', 'Dispute references')}</span>
          <input maxLength={500} onChange={(e) => setCbNote(e.target.value)} value={cbNote} />
        </label>
      </div>
      <button className="sa-btn" disabled={busy} onClick={save} type="button">{busy ? t('settlementActions.saving', 'Saving…') : t('settlementActions.saveLines', 'Save these lines')}</button>
      <span aria-live="polite" className="sa-status">{saved ? t('settlementActions.saved', 'Saved.') : error}</span>
    </div>
  );
}

/** The payment record for one act: the venue's half or the act's half. */
export function StatementPaymentActions({ agreementId, role, deductionCapCents, deductionsAppliedCents, suggestedCents, canReport, confirmed }: {
  agreementId: string;
  role: 'venue' | 'artist';
  deductionCapCents: number;
  deductionsAppliedCents: number;
  suggestedCents: number;
  canReport: boolean;
  confirmed: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [deductions, setDeductions] = useState((deductionsAppliedCents / 100).toFixed(2));
  const [amount, setAmount] = useState((suggestedCents / 100).toFixed(2));
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(body: unknown) {
    setBusy(true); setError(null);
    let failure: string | null;
    try {
      const res = await fetch(`/api/split-agreements/${agreementId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      failure = await readFailure(res);
    } catch {
      failure = 'network';
    }
    setBusy(false);
    if (failure) { setError(failure === 'network' ? t('settlementActions.networkError', 'Network error — try again.') : failure); return; }
    router.refresh();
  }

  if (confirmed) return null;

  if (role === 'venue') {
    return (
      <div className="sa-form">
        {deductionCapCents > 0 && (
          <div className="sa-row">
            <label>
              <span>{t('settlementActions.deductionsLabel', 'Approved deductions applied ($)')}</span>
              <input inputMode="decimal" onChange={(e) => setDeductions(e.target.value.replace(/[^\d.]/g, ''))} value={deductions} />
            </label>
            <button className="sa-btn sa-btn-ghost" disabled={busy} onClick={() => act({ action: 'deductions', amountCents: toCents(deductions) })} type="button">
              {t('settlementActions.applyDeductions', 'Apply')}
            </button>
          </div>
        )}
        <div className="sa-grid">
          <label>
            <span>{t('settlementActions.amountLabel', 'Amount paid ($)')}</span>
            <input inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} value={amount} />
          </label>
          <label>
            <span>{t('settlementActions.paidOnLabel', 'Date paid')}</span>
            <input onChange={(e) => setPaidOn(e.target.value)} type="date" value={paidOn} />
          </label>
          <label>
            <span>{t('settlementActions.methodLabel', 'Method')}</span>
            <input maxLength={80} onChange={(e) => setMethod(e.target.value)} placeholder={t('settlementActions.methodPlaceholder', 'e.g. Bank transfer')} value={method} />
          </label>
          <label>
            <span>{t('settlementActions.referenceLabel', 'Reference')}</span>
            <input maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder={t('settlementActions.referencePlaceholder', 'Transfer ID or check number')} value={reference} />
          </label>
        </div>
        <button
          className="sa-btn"
          disabled={busy || toCents(amount) <= 0 || method.trim().length < 2 || !reference.trim()}
          onClick={() => act({ action: 'mark_paid', amountCents: toCents(amount), paidOn, method: method.trim(), reference: reference.trim() })}
          type="button"
        >
          {t('settlementActions.markPaid', 'Mark as paid')}
        </button>
        {error && <p className="sa-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="sa-form">
      <button className="sa-btn" disabled={busy} onClick={() => act({ action: 'confirm' })} type="button">
        {t('settlementActions.confirmReceived', 'I received this payment')}
      </button>
      {canReport && (
        <>
          <label className="sa-wide">
            <span>{t('settlementActions.reportLabel', 'Not paid, or paid the wrong amount? Say what happened.')}</span>
            <textarea maxLength={1000} onChange={(e) => setNote(e.target.value)} value={note} />
          </label>
          <button className="sa-btn sa-btn-ghost" disabled={busy || note.trim().length < 5} onClick={() => act({ action: 'report', note: note.trim() })} type="button">
            {t('settlementActions.reportNonPayment', 'Report non-payment')}
          </button>
        </>
      )}
      {error && <p className="sa-error">{error}</p>}
    </div>
  );
}
