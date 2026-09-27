'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { MAX_APPROVED_DEDUCTIONS } from '@/lib/split-agreement';

type ExistingSlot = {
  profileSlug: string;
  profileName: string;
  splitPercent: number;
  isHeadliner: boolean;
  guaranteeCents: number | null;
  approvedDeductions: { label: string; capCents: number }[];
};

type Deduction = { label: string; cap: string };
type Row = { profileSlug: string; splitPercent: string; isHeadliner: boolean; guarantee: string; deductions: Deduction[] };

export type ComposerShow = { id: string };

type Prepared = { profileId: string; name: string; text: string; hash: string };

const toCents = (dollars: string) => Math.round(parseFloat(dollars || '0') * 100);

/**
 * The venue's Lineup Offer (Show Revenue Split Agreement, DESIGN_SYNC row
 * 528). Two steps, because sending IS signing (Agreement 11.1): first the
 * terms — each act's percentage of Net Ticket Receipts, an optional guarantee
 * and any approved deductions, plus the two optional clauses — then the full
 * text of every act's agreement, rendered by the server (a preview request
 * that signs nothing), a typed signature and "Send offer". The hash of each
 * text shown goes back with the signature, and the server refuses a mismatch.
 */
export function VenueLineupComposer({
  show,
  existingSlots,
  initialGuarantorName,
  initialJuryWaiver,
}: {
  show: ComposerShow;
  existingSlots: ExistingSlot[];
  initialGuarantorName: string | null;
  initialJuryWaiver: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>(
    existingSlots.length > 0
      ? existingSlots.map((s) => ({
        profileSlug: s.profileSlug,
        splitPercent: String(s.splitPercent),
        isHeadliner: s.isHeadliner,
        guarantee: s.guaranteeCents ? (s.guaranteeCents / 100).toFixed(2) : '',
        deductions: s.approvedDeductions.map((d) => ({ label: d.label, cap: (d.capCents / 100).toFixed(2) })),
      }))
      : [{ profileSlug: '', splitPercent: '', isHeadliner: true, guarantee: '', deductions: [] }],
  );
  const [guaranty, setGuaranty] = useState(Boolean(initialGuarantorName));
  const [guarantorName, setGuarantorName] = useState(initialGuarantorName ?? '');
  const [juryWaiver, setJuryWaiver] = useState(initialJuryWaiver);
  const [prepared, setPrepared] = useState<Prepared[] | null>(null);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = rows.reduce((sum, r) => sum + (Number(r.splitPercent) || 0), 0);

  function updateRow(i: number, patch: Partial<Row>) {
    setPrepared(null);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function setHeadliner(i: number) {
    setPrepared(null);
    setRows((prev) => prev.map((r, idx) => ({ ...r, isHeadliner: idx === i })));
  }
  function addRow() {
    setPrepared(null);
    setRows((prev) => [...prev, { profileSlug: '', splitPercent: '', isHeadliner: false, guarantee: '', deductions: [] }]);
  }
  function removeRow(i: number) {
    setPrepared(null);
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (!next.some((r) => r.isHeadliner) && next[0]) next[0] = { ...next[0], isHeadliner: true };
      return next;
    });
  }

  async function resolveProfile(slug: string): Promise<{ id: string; name: string } | null> {
    const res = await fetch(`/api/search?q=${encodeURIComponent(slug)}&type=artist&limit=10`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const match = (data?.profiles ?? []).find((p: { slug: string; type: string }) => p.slug === slug && p.type === 'ARTIST');
    return match ? { id: match.id, name: match.name } : null;
  }

  function offerBody(profileIds: string[]) {
    return {
      slots: rows.map((r, i) => ({
        profileId: profileIds[i],
        splitPercent: Number(r.splitPercent),
        isHeadliner: r.isHeadliner,
        guaranteeCents: r.guarantee.trim() ? toCents(r.guarantee) : null,
        approvedDeductions: r.deductions.filter((d) => d.label.trim()).map((d) => ({ label: d.label.trim(), capCents: toCents(d.cap) })),
      })),
      guarantorName: guaranty ? guarantorName.trim() : null,
      juryWaiver,
    };
  }

  async function review() {
    setError(null);
    if (rows.some((r) => !r.profileSlug.trim() || !r.splitPercent.trim())) {
      setError(t('venueLineupComposer.errorMissingFieldsOffer', 'Every act needs a profile slug and a percentage.'));
      return;
    }
    if (total > 100) {
      setError(t('venueLineupComposer.errorOver100', 'The artists’ percentages can total at most 100%.'));
      return;
    }
    if (rows.filter((r) => r.isHeadliner).length !== 1) {
      setError(t('venueLineupComposer.errorOneHeadliner', 'Exactly one act must be marked as the headliner.'));
      return;
    }
    if (guaranty && !guarantorName.trim()) {
      setError(t('venueLineupComposer.errorGuarantor', 'Type the guarantor’s full name, or turn the personal guaranty off.'));
      return;
    }
    setBusy(true);
    try {
      const resolved = await Promise.all(rows.map((r) => resolveProfile(r.profileSlug.trim())));
      const missing = resolved.findIndex((r) => r === null);
      if (missing !== -1) {
        setError(`${t('venueLineupComposer.errorProfileNotFoundArtist', 'Couldn’t find an artist profile at')} "${rows[missing].profileSlug}".`);
        return;
      }
      const res = await fetch(`/api/shows/${show.id}/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...offerBody(resolved.map((r) => r!.id)), preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('venueLineupComposer.errorCouldNotPrepare', 'Could not prepare the agreements.'));
        return;
      }
      setPrepared(data.agreements as Prepared[]);
    } catch {
      setError(t('venueLineupComposer.errorNetwork', 'Network error — try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shows/${show.id}/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...offerBody(prepared.map((p) => p.profileId)),
          signerName: signerName.trim(),
          agreementHashes: Object.fromEntries(prepared.map((p) => [p.profileId, p.hash])),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('venueLineupComposer.errorCouldNotSend', 'Could not send the offer.'));
        if (data.code === 'AGREEMENT_CHANGED') setPrepared(null);
        return;
      }
      router.refresh();
    } catch {
      setError(t('venueLineupComposer.errorNetwork', 'Network error — try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (prepared) {
    return (
      <div className="vlc">
        <div className="vlc-eyebrow">{t('venueLineupComposer.eyebrowSign', 'Read and sign')}</div>
        <p className="vlc-hint">
          {t('venueLineupComposer.signHint', 'Sending the offer is your signature for the venue on each agreement below. Each act signs its own when it accepts.')}
        </p>
        {prepared.map((p) => (
          <div className="vlc-agreement" key={p.profileId}>
            <div className="vlc-agreement-head">{p.name}</div>
            <pre className="vlc-agreement-text" tabIndex={0}>{p.text}</pre>
          </div>
        ))}
        <div className="vlc-field">
          <label htmlFor="vlc-signer">{t('venueLineupComposer.signerLabel', 'Your full legal name')}</label>
          <input autoComplete="name" className="vlc-input" id="vlc-signer" onChange={(e) => setSignerName(e.target.value)} value={signerName} />
        </div>
        <label className="vlc-check">
          <input checked={agreed} onChange={(e) => setAgreed(e.target.checked)} type="checkbox" />
          <span>{t('venueLineupComposer.signCheck', 'I have read these agreements, I am authorized to bind the venue, and I sign them electronically.')}</span>
        </label>
        {error && <p className="vlc-error">{error}</p>}
        <button className="vlc-btn vlc-btn-solid" disabled={busy || !agreed || signerName.trim().length < 2} onClick={send} type="button">
          {busy ? t('venueLineupComposer.sending', 'Sending…') : t('venueLineupComposer.sendOffer', 'Send offer')}
        </button>
        <button className="vlc-btn vlc-btn-outline vlc-btn-wide" disabled={busy} onClick={() => setPrepared(null)} type="button">
          {t('venueLineupComposer.editTerms', 'Edit the terms')}
        </button>
        <ComposerStyles />
      </div>
    );
  }

  return (
    <div className="vlc">
      <div className="vlc-eyebrow">{existingSlots.length > 0 ? t('venueLineupComposer.eyebrowReviseOffer', 'Revise the lineup offer') : t('venueLineupComposer.eyebrowOffer', 'Lineup offer')}</div>
      <p className="vlc-hint">
        {t('venueLineupComposer.hintAgreement', 'You receive every ticket sale and pay each act its percentage of the Net Ticket Receipts (ticket money after tax and refunds) within 7 days of the show. Card fees are yours. Sending a revision asks every act to sign again.')}
      </p>

      {rows.map((row, i) => (
        <div className="vlc-act" key={i}>
          <div className="vlc-row">
            <input
              aria-label={t('venueLineupComposer.slugLabel', 'Artist profile slug')}
              className="vlc-input vlc-input-slug"
              onChange={(e) => updateRow(i, { profileSlug: e.target.value })}
              placeholder={t('venueLineupComposer.placeholderArtistSlug', 'artist profile slug')}
              value={row.profileSlug}
            />
            <input
              aria-label={t('venueLineupComposer.percentLabel', 'Percentage of Net Ticket Receipts')}
              className="vlc-input vlc-input-pct"
              inputMode="numeric"
              onChange={(e) => updateRow(i, { splitPercent: e.target.value.replace(/\D/g, '') })}
              placeholder="%"
              value={row.splitPercent}
            />
            {rows.length > 1 && (
              <label className="vlc-headliner">
                <input checked={row.isHeadliner} name="headliner" onChange={() => setHeadliner(i)} type="radio" />
                {t('venueLineupComposer.headliner', 'Headliner')}
              </label>
            )}
            {rows.length > 1 && (
              <button className="vlc-remove" onClick={() => removeRow(i)} type="button">
                {t('venueLineupComposer.remove', 'Remove')}
              </button>
            )}
          </div>
          <div className="vlc-row">
            <label className="vlc-inline">
              <span>{t('venueLineupComposer.guaranteeLabel', 'Guarantee ($, optional)')}</span>
              <input className="vlc-input vlc-input-money" inputMode="decimal" onChange={(e) => updateRow(i, { guarantee: e.target.value.replace(/[^\d.]/g, '') })} value={row.guarantee} />
            </label>
          </div>
          {row.deductions.map((d, j) => (
            <div className="vlc-row" key={j}>
              <input
                aria-label={t('venueLineupComposer.deductionLabel', 'Approved deduction')}
                className="vlc-input vlc-input-slug"
                onChange={(e) => updateRow(i, { deductions: row.deductions.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })}
                placeholder={t('venueLineupComposer.deductionPlaceholder', 'e.g. Sound engineer')}
                value={d.label}
              />
              <input
                aria-label={t('venueLineupComposer.deductionCapLabel', 'Maximum ($)')}
                className="vlc-input vlc-input-money"
                inputMode="decimal"
                onChange={(e) => updateRow(i, { deductions: row.deductions.map((x, k) => (k === j ? { ...x, cap: e.target.value.replace(/[^\d.]/g, '') } : x)) })}
                placeholder="$"
                value={d.cap}
              />
              <button className="vlc-remove" onClick={() => updateRow(i, { deductions: row.deductions.filter((_, k) => k !== j) })} type="button">
                {t('venueLineupComposer.remove', 'Remove')}
              </button>
            </div>
          ))}
          {row.deductions.length < MAX_APPROVED_DEDUCTIONS && (
            <button className="vlc-link" onClick={() => updateRow(i, { deductions: [...row.deductions, { label: '', cap: '' }] })} type="button">
              {t('venueLineupComposer.addDeduction', '+ Approved deduction with a cap')}
            </button>
          )}
        </div>
      ))}

      <div className="vlc-actions">
        <button className="vlc-btn vlc-btn-outline" onClick={addRow} type="button">
          {t('venueLineupComposer.addAct', '+ Add act')}
        </button>
        <span className={`vlc-total${total > 100 ? ' vlc-total-off' : ''}`}>
          {total}% {t('venueLineupComposer.toArtists', 'to artists')} · {Math.max(0, 100 - total)}% {t('venueLineupComposer.toVenue', 'to the venue')}
        </span>
      </div>

      <label className="vlc-check">
        <input checked={guaranty} onChange={(e) => { setPrepared(null); setGuaranty(e.target.checked); }} type="checkbox" />
        <span>{t('venueLineupComposer.guarantyCheck', 'Personal guaranty (Section 3.7): I personally guarantee these payments.')}</span>
      </label>
      {guaranty && (
        <div className="vlc-field">
          <label htmlFor="vlc-guarantor">{t('venueLineupComposer.guarantorLabel', 'Guarantor’s full legal name')}</label>
          <input className="vlc-input" id="vlc-guarantor" onChange={(e) => { setPrepared(null); setGuarantorName(e.target.value); }} value={guarantorName} />
        </div>
      )}
      <label className="vlc-check">
        <input checked={juryWaiver} onChange={(e) => { setPrepared(null); setJuryWaiver(e.target.checked); }} type="checkbox" />
        <span>{t('venueLineupComposer.juryCheck', 'Jury waiver (Section 10.6)')}</span>
      </label>

      {error && <p className="vlc-error">{error}</p>}

      <button className="vlc-btn vlc-btn-solid" disabled={busy} onClick={review} type="button">
        {busy ? t('venueLineupComposer.preparing', 'Preparing…') : t('venueLineupComposer.reviewAgreements', 'Review the agreements')}
      </button>
      <ComposerStyles />
    </div>
  );
}

function ComposerStyles() {
  return (
    <style>{`
      .vlc { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); padding: 20px; margin-top: 20px; }
      .vlc-eyebrow { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a65); margin-bottom: 6px; }
      .vlc-hint { font-size: 0.9375rem; color: var(--ink-a65); line-height: 1.6; margin: 0 0 16px; }
      .vlc-act { border-top: 1px solid var(--line); padding: 12px 0 4px; }
      .vlc-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
      .vlc-input { background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 9px 12px; color: var(--ink); font-size: 1rem; min-height: 44px; box-sizing: border-box; }
      .vlc-input-slug { flex: 1; min-width: 140px; }
      .vlc-input-pct { width: 72px; }
      .vlc-input-money { width: 120px; }
      .vlc-inline { display: flex; align-items: center; gap: 8px; font-size: 0.9375rem; color: var(--ink-a65); }
      .vlc-field { margin: 10px 0 14px; display: flex; flex-direction: column; gap: 6px; }
      .vlc-field label { font-size: 0.9375rem; color: var(--ink-a65); }
      .vlc-headliner { display: flex; align-items: center; gap: 6px; font-size: 0.9375rem; color: var(--ink-a65); white-space: nowrap; min-height: 44px; }
      .vlc-remove, .vlc-link { font-size: 0.9375rem; color: var(--ink-a65); background: none; border: none; cursor: pointer; text-decoration: underline; min-height: 44px; }
      .vlc-check { display: flex; gap: 10px; align-items: flex-start; font-size: 0.9375rem; color: var(--ink-2); line-height: 1.5; margin: 12px 0; min-height: 44px; }
      .vlc-actions { display: flex; justify-content: space-between; align-items: center; margin: 10px 0 16px; gap: 12px; flex-wrap: wrap; }
      .vlc-btn { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .06em; padding: 10px 18px; border-radius: var(--radius-pill); border: none; cursor: pointer; min-height: 44px; }
      .vlc-btn-outline { background: transparent; color: var(--ink-a70); border: 1px solid var(--line); }
      .vlc-btn-wide { width: 100%; margin-top: 8px; }
      .vlc-btn-solid { background: var(--accent); color: var(--ink-on-accent); width: 100%; }
      .vlc-btn:disabled { opacity: 0.6; cursor: default; }
      .vlc-total { font-family: var(--font-mono); font-size: 0.9375rem; color: var(--role-venue); }
      .vlc-total-off { color: var(--accent-text); }
      .vlc-error { color: var(--accent-text); font-size: 0.9375rem; margin: 0 0 12px; }
      .vlc-agreement { margin-bottom: 14px; }
      .vlc-agreement-head { font-family: var(--font-display); font-weight: 800; font-size: 1rem; margin-bottom: 6px; color: var(--ink); }
      .vlc-agreement-text { max-height: 320px; overflow: auto; white-space: pre-wrap; font-family: var(--font-body); font-size: 0.9375rem; line-height: 1.55; background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 14px; margin: 0; color: var(--ink-2); }
    `}</style>
  );
}
