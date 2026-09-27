'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

/**
 * The act's side of the Lineup Offer: read the whole Show Revenue Split
 * Agreement the venue signed, then "Accept and sign" (Agreement 11.1) or
 * decline. The text and its hash are rendered on the server from the stored
 * offer; the hash comes back with the signature and the route refuses one
 * that no longer matches, so an offer revised while this page was open cannot
 * be signed.
 *
 * Signing needs a payment method on file (5.2) — the venue pays the act there.
 */
export function LineupSplitResponder({
  showId,
  agreementText,
  agreementHash,
  hasPayoutMethod,
  payoutSettingsHref,
}: {
  showId: string;
  agreementText: string;
  agreementHash: string;
  hasPayoutMethod: boolean;
  payoutSettingsHref: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);

  async function respond(status: 'ACCEPTED' | 'DECLINED') {
    setBusy(status === 'ACCEPTED' ? 'accept' : 'decline');
    setError(null);
    try {
      const res = await fetch(`/api/shows/${showId}/lineup/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status === 'ACCEPTED' ? { status, agreementHash, signerName: signerName.trim() } : { status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('lineupSplitResponder.genericError', 'Something went wrong — try again.'));
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError(t('lineupSplitResponder.networkError', 'Network error — try again.'));
      setBusy(null);
    }
  }

  return (
    <div>
      <pre className="lsr-text" tabIndex={0}>{agreementText}</pre>
      {!hasPayoutMethod ? (
        <p className="lsr-note">
          {t('lineupSplitResponder.needPayoutMethod', 'Before you can sign, add where the venue should pay you.')}{' '}
          <Link href={payoutSettingsHref}>{t('lineupSplitResponder.addPayoutMethod', 'Add where you get paid')}</Link>
        </p>
      ) : (
        <>
          <div className="lsr-field">
            <label htmlFor={`lsr-signer-${showId}`}>{t('lineupSplitResponder.signerLabel', 'Your full legal name')}</label>
            <input autoComplete="name" id={`lsr-signer-${showId}`} onChange={(e) => setSignerName(e.target.value)} value={signerName} />
          </div>
          <label className="lsr-check">
            <input checked={agreed} onChange={(e) => setAgreed(e.target.checked)} type="checkbox" />
            <span>{t('lineupSplitResponder.signCheck', 'I have read this agreement, I am authorized to accept it for the act, and I sign it electronically.')}</span>
          </label>
        </>
      )}
      <div className="lsr-actions">
        <button
          className="lsr-btn lsr-btn-accept"
          disabled={busy !== null || !hasPayoutMethod || !agreed || signerName.trim().length < 2}
          onClick={() => respond('ACCEPTED')}
          type="button"
        >
          {busy === 'accept' ? t('lineupSplitResponder.signing', 'Signing…') : t('lineupSplitResponder.acceptAndSign', 'Accept and sign')}
        </button>
        <button className="lsr-btn lsr-btn-decline" disabled={busy !== null} onClick={() => respond('DECLINED')} type="button">
          {busy === 'decline' ? t('lineupSplitResponder.declining', 'Declining…') : t('lineupSplitResponder.decline', 'Decline')}
        </button>
      </div>
      {error && <p className="lsr-error">{error}</p>}

      <style>{`
        .lsr-text { max-height: 360px; overflow: auto; white-space: pre-wrap; font-family: var(--font-body); font-size: 0.9375rem; line-height: 1.55; background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 14px; margin: 0 0 14px; color: var(--ink-2); }
        .lsr-note { font-size: 0.9375rem; color: var(--ink-2); line-height: 1.5; }
        .lsr-note a { color: var(--accent-text); }
        .lsr-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .lsr-field label { font-size: 0.9375rem; color: var(--ink-a65); }
        .lsr-field input { background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 9px 12px; color: var(--ink); font-size: 1rem; min-height: 44px; }
        .lsr-check { display: flex; gap: 10px; align-items: flex-start; font-size: 0.9375rem; color: var(--ink-2); line-height: 1.5; margin: 6px 0 14px; min-height: 44px; }
        .lsr-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .lsr-btn { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .06em; padding: 11px 20px; border-radius: var(--radius-pill); border: none; cursor: pointer; min-height: 44px; }
        .lsr-btn-accept { background: var(--accent); color: var(--ink-on-accent); }
        .lsr-btn-decline { background: transparent; color: var(--ink-a65); border: 1px solid var(--line); }
        .lsr-btn:disabled { opacity: 0.6; cursor: default; }
        .lsr-error { color: var(--accent-text); font-size: 0.9375rem; margin: 10px 0 0; }
      `}</style>
    </div>
  );
}
