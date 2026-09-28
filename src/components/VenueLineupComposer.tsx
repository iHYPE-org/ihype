'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { MAX_APPROVED_DEDUCTIONS } from '@/lib/split-agreement';
import type { ActPerformanceTerms, EngagementTerms, PaidBy } from '@/lib/performance-agreement';

type ExistingSlot = {
  profileSlug: string;
  profileName: string;
  splitPercent: number;
  isHeadliner: boolean;
  guaranteeCents: number | null;
  approvedDeductions: { label: string; capCents: number }[];
  performance: ActPerformanceTerms | null;
};

type Hosp = { paidBy: PaidBy; details: string };
const HOSP_KEYS = ['travel', 'accommodation', 'meals', 'drinks', 'parking'] as const;
type HospKey = (typeof HOSP_KEYS)[number];
/** Part A per act, as the form holds it (strings until sent). */
type Perf = {
  artistRepresentative: string; loadInTime: string; soundcheckTime: string; setStartTime: string;
  setLengthMinutes: string; numberOfSets: string; billing: ActPerformanceTerms['billing']; billingTypePercent: string;
  backline: PaidBy; guestListCount: string; technicalRider: string; hospitalityRider: string;
} & Record<HospKey, Hosp>;
/** Part A for the whole show. */
type Eng = {
  purchaserLegalName: string; purchaserContact: string; venueCapacity: string; doorsTime: string; ageRestriction: string;
  stageSize: string; merchCommissionPercent: string; insuranceDollars: string; announceNotBefore: string;
  socialClipSeconds: string; setTimeFlexMinutes: string; soundcheckMinutes: string; riderConfirmDays: string;
  dressingRoomHoursAfter: string; promoMaterialsDays: string;
};

const numOrUndefined = (v: string) => (v.trim() === '' ? undefined : Number(v));
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function perfFrom(p: ActPerformanceTerms | null, isHeadliner: boolean): Perf {
  const hosp = (h?: Hosp): Hosp => ({ paidBy: h?.paidBy ?? 'ARTIST', details: h?.details ?? '' });
  return {
    artistRepresentative: p?.artistRepresentative ?? '',
    loadInTime: p?.loadInTime ?? '', soundcheckTime: p?.soundcheckTime ?? '', setStartTime: p?.setStartTime ?? '',
    setLengthMinutes: p ? String(p.setLengthMinutes) : '', numberOfSets: p ? String(p.numberOfSets) : '1',
    billing: p?.billing ?? (isHeadliner ? 'HEADLINER' : 'SUPPORT'),
    billingTypePercent: p?.billingTypePercent ? String(p.billingTypePercent) : '',
    backline: p?.backline ?? 'ARTIST',
    travel: hosp(p?.travel), accommodation: hosp(p?.accommodation), meals: hosp(p?.meals), drinks: hosp(p?.drinks), parking: hosp(p?.parking),
    guestListCount: p ? String(p.guestListCount) : '0',
    technicalRider: p?.technicalRider ?? '', hospitalityRider: p?.hospitalityRider ?? '',
  };
}

function engFrom(e: Partial<EngagementTerms> | null, venueName: string): Eng {
  const s = (n: number | null | undefined, fallback: string) => (n === null || n === undefined ? fallback : String(n));
  return {
    purchaserLegalName: e?.purchaserLegalName ?? venueName, purchaserContact: e?.purchaserContact ?? '',
    venueCapacity: s(e?.venueCapacity, ''), doorsTime: e?.doorsTime ?? '', ageRestriction: e?.ageRestriction ?? 'All ages',
    stageSize: e?.stageSize ?? '', merchCommissionPercent: s(e?.merchCommissionPercent, ''),
    insuranceDollars: e?.insuranceCents !== undefined ? String(e.insuranceCents / 100) : '1000000',
    announceNotBefore: e?.announceNotBefore ?? '', socialClipSeconds: s(e?.socialClipSeconds, '60'),
    setTimeFlexMinutes: s(e?.setTimeFlexMinutes, '30'), soundcheckMinutes: s(e?.soundcheckMinutes, '30'),
    riderConfirmDays: s(e?.riderConfirmDays, '14'), dressingRoomHoursAfter: s(e?.dressingRoomHoursAfter, '1'),
    promoMaterialsDays: s(e?.promoMaterialsDays, '7'),
  };
}

function perfBody(p: Perf) {
  return {
    artistRepresentative: p.artistRepresentative.trim(),
    loadInTime: p.loadInTime, soundcheckTime: p.soundcheckTime, setStartTime: p.setStartTime,
    setLengthMinutes: Number(p.setLengthMinutes), numberOfSets: numOrUndefined(p.numberOfSets),
    billing: p.billing, billingTypePercent: numOrNull(p.billingTypePercent), backline: p.backline,
    travel: p.travel, accommodation: p.accommodation, meals: p.meals, drinks: p.drinks, parking: p.parking,
    guestListCount: numOrUndefined(p.guestListCount),
    technicalRider: p.technicalRider.trim(), hospitalityRider: p.hospitalityRider.trim(),
  };
}

function engBody(e: Eng) {
  return {
    purchaserLegalName: e.purchaserLegalName.trim(), purchaserContact: e.purchaserContact.trim(),
    venueCapacity: numOrNull(e.venueCapacity), doorsTime: e.doorsTime, ageRestriction: e.ageRestriction.trim() || undefined,
    stageSize: e.stageSize.trim(), merchCommissionPercent: numOrNull(e.merchCommissionPercent),
    insuranceCents: e.insuranceDollars.trim() ? Math.round(Number(e.insuranceDollars) * 100) : undefined,
    announceNotBefore: e.announceNotBefore || null, socialClipSeconds: numOrUndefined(e.socialClipSeconds),
    setTimeFlexMinutes: numOrUndefined(e.setTimeFlexMinutes), soundcheckMinutes: numOrUndefined(e.soundcheckMinutes),
    riderConfirmDays: numOrUndefined(e.riderConfirmDays), dressingRoomHoursAfter: numOrUndefined(e.dressingRoomHoursAfter),
    promoMaterialsDays: numOrUndefined(e.promoMaterialsDays),
  };
}

type Deduction = { label: string; cap: string };
type Row = { profileSlug: string; splitPercent: string; isHeadliner: boolean; guarantee: string; deductions: Deduction[]; perf: Perf };

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
  initialEngagement,
  venueName,
}: {
  show: ComposerShow;
  existingSlots: ExistingSlot[];
  initialGuarantorName: string | null;
  initialJuryWaiver: boolean;
  initialEngagement: Partial<EngagementTerms> | null;
  venueName: string;
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
        perf: perfFrom(s.performance, s.isHeadliner),
      }))
      : [{ profileSlug: '', splitPercent: '', isHeadliner: true, guarantee: '', deductions: [], perf: perfFrom(null, true) }],
  );
  const [eng, setEng] = useState<Eng>(() => engFrom(initialEngagement, venueName));
  const updateEng = (patch: Partial<Eng>) => { setPrepared(null); setEng((prev) => ({ ...prev, ...patch })); };
  const updatePerf = (i: number, patch: Partial<Perf>) => updateRow(i, { perf: { ...rows[i].perf, ...patch } });
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
    setRows((prev) => [...prev, { profileSlug: '', splitPercent: '', isHeadliner: false, guarantee: '', deductions: [], perf: perfFrom(null, false) }]);
  }
  function removeRow(i: number) {
    setPrepared(null);
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (!next.some((r) => r.isHeadliner) && next[0]) next[0] = { ...next[0], isHeadliner: true };
      return next;
    });
  }

  /* By slug, exactly. This read `/api/search`, whose answer is `results`
     with lowercase types and which matches names rather than slugs, so it
     found nobody and no venue could send an offer from here (found driving
     the composer for DESIGN_SYNC row 530). */
  async function resolveProfile(slug: string): Promise<{ id: string; name: string } | null> {
    const res = await fetch(`/api/profile/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const p = data?.profile as { id?: string; name?: string; type?: string } | undefined;
    return p?.id && p.type === 'ARTIST' ? { id: p.id, name: p.name ?? slug } : null;
  }

  function offerBody(profileIds: string[]) {
    return {
      slots: rows.map((r, i) => ({
        profileId: profileIds[i],
        splitPercent: Number(r.splitPercent),
        isHeadliner: r.isHeadliner,
        guaranteeCents: r.guarantee.trim() ? toCents(r.guarantee) : null,
        approvedDeductions: r.deductions.filter((d) => d.label.trim()).map((d) => ({ label: d.label.trim(), capCents: toCents(d.cap) })),
        performance: perfBody(r.perf),
      })),
      guarantorName: guaranty ? guarantorName.trim() : null,
      juryWaiver,
      engagement: engBody(eng),
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
    if (!eng.purchaserLegalName.trim() || !eng.purchaserContact.trim() || !eng.doorsTime) {
      setError(t('venueLineupComposer.errorEngagement', 'Fill in the purchaser’s legal name, contact and the doors time.'));
      return;
    }
    if (rows.some((r) => !r.perf.loadInTime || !r.perf.soundcheckTime || !r.perf.setStartTime || !r.perf.setLengthMinutes.trim())) {
      setError(t('venueLineupComposer.errorPerformance', 'Every act needs a load-in, soundcheck and set start time, and a set length.'));
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
        {t('venueLineupComposer.hintPerformanceAgreement', 'Each act signs one Artist Performance Agreement: the performance terms below (Part A) and the Show Revenue Split Agreement (Part B). You receive every ticket sale and pay each act its percentage of the Net Ticket Receipts (ticket money after tax and refunds) within 7 days of the show. Card fees are yours. Sending a revision asks every act to sign again.')}
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
          <PerfFields perf={row.perf} onChange={(patch) => updatePerf(i, patch)} />
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

      <fieldset className="vlc-set">
        <legend className="vlc-eyebrow">{t('venueLineupComposer.engagementLegend', 'The engagement (Part A)')}</legend>
        <div className="vlc-grid">
          <TextField id="vlc-purchaser" label={t('venueLineupComposer.purchaserLabel', 'Purchaser’s legal name')} onChange={(v) => updateEng({ purchaserLegalName: v })} value={eng.purchaserLegalName} />
          <TextField id="vlc-contact" label={t('venueLineupComposer.purchaserContactLabel', 'Purchaser’s contact (email or phone)')} onChange={(v) => updateEng({ purchaserContact: v })} value={eng.purchaserContact} />
          <TextField id="vlc-doors" label={t('venueLineupComposer.doorsLabel', 'Doors')} onChange={(v) => updateEng({ doorsTime: v })} type="time" value={eng.doorsTime} />
          <TextField id="vlc-capacity" inputMode="numeric" label={t('venueLineupComposer.capacityLabel', 'Capacity (optional)')} onChange={(v) => updateEng({ venueCapacity: v.replace(/\D/g, '') })} value={eng.venueCapacity} />
          <TextField id="vlc-age" label={t('venueLineupComposer.ageLabel', 'Age restriction')} onChange={(v) => updateEng({ ageRestriction: v })} value={eng.ageRestriction} />
          <TextField id="vlc-stage" label={t('venueLineupComposer.stageLabel', 'Stage size (optional)')} onChange={(v) => updateEng({ stageSize: v })} value={eng.stageSize} />
          <TextField id="vlc-merch" inputMode="numeric" label={t('venueLineupComposer.merchLabel', 'Merch commission % (blank for none)')} onChange={(v) => updateEng({ merchCommissionPercent: v.replace(/\D/g, '') })} value={eng.merchCommissionPercent} />
          <TextField id="vlc-insurance" inputMode="decimal" label={t('venueLineupComposer.insuranceLabel', 'Liability insurance ($)')} onChange={(v) => updateEng({ insuranceDollars: v.replace(/[^\d.]/g, '') })} value={eng.insuranceDollars} />
          <TextField id="vlc-announce" label={t('venueLineupComposer.announceLabel', 'Announce no earlier than (optional)')} onChange={(v) => updateEng({ announceNotBefore: v })} type="date" value={eng.announceNotBefore} />
        </div>
        <details className="vlc-details">
          <summary>{t('venueLineupComposer.standardTerms', 'Standard terms')}</summary>
          <div className="vlc-grid">
            <TextField id="vlc-flex" inputMode="numeric" label={t('venueLineupComposer.flexLabel', 'Set-time flexibility (minutes)')} onChange={(v) => updateEng({ setTimeFlexMinutes: v.replace(/\D/g, '') })} value={eng.setTimeFlexMinutes} />
            <TextField id="vlc-soundcheck-min" inputMode="numeric" label={t('venueLineupComposer.soundcheckMinutesLabel', 'Soundcheck length (minutes)')} onChange={(v) => updateEng({ soundcheckMinutes: v.replace(/\D/g, '') })} value={eng.soundcheckMinutes} />
            <TextField id="vlc-rider-days" inputMode="numeric" label={t('venueLineupComposer.riderDaysLabel', 'Riders confirmed (days before)')} onChange={(v) => updateEng({ riderConfirmDays: v.replace(/\D/g, '') })} value={eng.riderConfirmDays} />
            <TextField id="vlc-dressing" inputMode="numeric" label={t('venueLineupComposer.dressingLabel', 'Dressing room after the set (hours)')} onChange={(v) => updateEng({ dressingRoomHoursAfter: v.replace(/\D/g, '') })} value={eng.dressingRoomHoursAfter} />
            <TextField id="vlc-promo" inputMode="numeric" label={t('venueLineupComposer.promoDaysLabel', 'Promo materials due (days after signing)')} onChange={(v) => updateEng({ promoMaterialsDays: v.replace(/\D/g, '') })} value={eng.promoMaterialsDays} />
            <TextField id="vlc-clip" inputMode="numeric" label={t('venueLineupComposer.clipLabel', 'Social clip length (seconds)')} onChange={(v) => updateEng({ socialClipSeconds: v.replace(/\D/g, '') })} value={eng.socialClipSeconds} />
          </div>
        </details>
      </fieldset>

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

function TextField({ id, label, value, onChange, type = 'text', inputMode }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; inputMode?: 'numeric' | 'decimal';
}) {
  return (
    <div className="vlc-field">
      <label htmlFor={id}>{label}</label>
      <input className="vlc-input" id={id} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} type={type} value={value} />
    </div>
  );
}

function PaidBySelect({ id, label, value, onChange }: { id: string; label: string; value: PaidBy; onChange: (v: PaidBy) => void }) {
  const { t } = useI18n();
  return (
    <div className="vlc-field">
      <label htmlFor={id}>{label}</label>
      <select className="vlc-input" id={id} onChange={(e) => onChange(e.target.value as PaidBy)} value={value}>
        <option value="ARTIST">{t('venueLineupComposer.paidByArtist', 'The artist')}</option>
        <option value="PURCHASER">{t('venueLineupComposer.paidByPurchaser', 'The venue')}</option>
      </select>
    </div>
  );
}

/** Part A for one act: the times, the billing and what each side provides. */
function PerfFields({ perf, onChange }: { perf: Perf; onChange: (patch: Partial<Perf>) => void }) {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, '');
  const id = (k: string) => `vlc-${k}-${uid}`;
  const num = (v: string) => v.replace(/\D/g, '');
  const hospLabel = (k: HospKey) => {
    switch (k) {
      case 'travel': return t('venueLineupComposer.hospTravel', 'Travel');
      case 'accommodation': return t('venueLineupComposer.hospAccommodation', 'Accommodation');
      case 'meals': return t('venueLineupComposer.hospMeals', 'Meals');
      case 'drinks': return t('venueLineupComposer.hospDrinks', 'Drinks');
      case 'parking': return t('venueLineupComposer.hospParking', 'Parking');
    }
  };
  return (
    <div className="vlc-perf">
      <div className="vlc-grid">
        <TextField id={id('load')} label={t('venueLineupComposer.loadInLabel', 'Load-in')} onChange={(v) => onChange({ loadInTime: v })} type="time" value={perf.loadInTime} />
        <TextField id={id('check')} label={t('venueLineupComposer.soundcheckLabel', 'Soundcheck')} onChange={(v) => onChange({ soundcheckTime: v })} type="time" value={perf.soundcheckTime} />
        <TextField id={id('set')} label={t('venueLineupComposer.setStartLabel', 'Set start')} onChange={(v) => onChange({ setStartTime: v })} type="time" value={perf.setStartTime} />
        <TextField id={id('len')} inputMode="numeric" label={t('venueLineupComposer.setLengthLabel', 'Set length (minutes)')} onChange={(v) => onChange({ setLengthMinutes: num(v) })} value={perf.setLengthMinutes} />
      </div>
      <details className="vlc-details">
        <summary>{t('venueLineupComposer.moreActTerms', 'Billing, hospitality and riders')}</summary>
        <div className="vlc-grid">
          <TextField id={id('rep')} label={t('venueLineupComposer.repLabel', 'Artist’s representative (optional)')} onChange={(v) => onChange({ artistRepresentative: v })} value={perf.artistRepresentative} />
          <TextField id={id('sets')} inputMode="numeric" label={t('venueLineupComposer.setsLabel', 'Number of sets')} onChange={(v) => onChange({ numberOfSets: num(v) })} value={perf.numberOfSets} />
          <div className="vlc-field">
            <label htmlFor={id('billing')}>{t('venueLineupComposer.billingLabel', 'Billing')}</label>
            <select className="vlc-input" id={id('billing')} onChange={(e) => onChange({ billing: e.target.value as Perf['billing'] })} value={perf.billing}>
              <option value="HEADLINER">{t('venueLineupComposer.billingHeadliner', 'Headliner')}</option>
              <option value="CO_HEADLINER">{t('venueLineupComposer.billingCoHeadliner', 'Co-headliner')}</option>
              <option value="SUPPORT">{t('venueLineupComposer.billingSupport', 'Support')}</option>
            </select>
          </div>
          <TextField id={id('btype')} inputMode="numeric" label={t('venueLineupComposer.billingTypeLabel', 'Name size on promotion, % of headliner (optional)')} onChange={(v) => onChange({ billingTypePercent: num(v) })} value={perf.billingTypePercent} />
          <PaidBySelect id={id('backline')} label={t('venueLineupComposer.backlineLabel', 'Backline provided by')} onChange={(v) => onChange({ backline: v })} value={perf.backline} />
          <TextField id={id('guests')} inputMode="numeric" label={t('venueLineupComposer.guestsLabel', 'Guest list spots')} onChange={(v) => onChange({ guestListCount: num(v) })} value={perf.guestListCount} />
          {HOSP_KEYS.map((k) => (
            <div className="vlc-hosp" key={k}>
              <PaidBySelect id={id(`${k}-by`)} label={`${hospLabel(k)} · ${t('venueLineupComposer.paidByLabel', 'paid by')}`} onChange={(v) => onChange({ [k]: { ...perf[k], paidBy: v } } as Partial<Perf>)} value={perf[k].paidBy} />
              <TextField id={id(`${k}-d`)} label={t('venueLineupComposer.hospDetailsLabel', 'Details (optional)')} onChange={(v) => onChange({ [k]: { ...perf[k], details: v } } as Partial<Perf>)} value={perf[k].details} />
            </div>
          ))}
        </div>
        <div className="vlc-field">
          <label htmlFor={id('tech')}>{t('venueLineupComposer.techRiderLabel', 'Technical rider (Schedule A, optional)')}</label>
          <textarea className="vlc-input vlc-textarea" id={id('tech')} maxLength={4000} onChange={(e) => onChange({ technicalRider: e.target.value })} value={perf.technicalRider} />
        </div>
        <div className="vlc-field">
          <label htmlFor={id('hosp')}>{t('venueLineupComposer.hospRiderLabel', 'Hospitality rider (Schedule B, optional)')}</label>
          <textarea className="vlc-input vlc-textarea" id={id('hosp')} maxLength={4000} onChange={(e) => onChange({ hospitalityRider: e.target.value })} value={perf.hospitalityRider} />
        </div>
      </details>
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
      .vlc-set { border: none; padding: 12px 0 0; margin: 0; border-top: 1px solid var(--line); }
      .vlc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0 12px; }
      .vlc-hosp { display: contents; }
      .vlc-perf { margin-top: 4px; }
      .vlc-details { margin: 4px 0 10px; }
      .vlc-details > summary { cursor: pointer; font-size: 0.9375rem; color: var(--ink-a65); min-height: 44px; display: flex; align-items: center; }
      .vlc-textarea { min-height: 88px; font-family: var(--font-body); resize: vertical; }
      .vlc-agreement { margin-bottom: 14px; }
      .vlc-agreement-head { font-family: var(--font-display); font-weight: 800; font-size: 1rem; margin-bottom: 6px; color: var(--ink); }
      .vlc-agreement-text { max-height: 320px; overflow: auto; white-space: pre-wrap; font-family: var(--font-body); font-size: 0.9375rem; line-height: 1.55; background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 14px; margin: 0; color: var(--ink-2); }
    `}</style>
  );
}
