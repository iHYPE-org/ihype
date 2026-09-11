'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { postJson } from '@/lib/api-client';
import {
  AD_SCOPES, AD_SCOPE_LABELS, AD_SCOPE_DESCRIPTIONS,
  SPONSORSHIP_TERMS_MONTHS, SPONSORSHIP_MONTHLY_USD, quoteSponsorship,
  type AdScope, type SponsorshipQuote, type SponsorshipTermMonths,
} from '@/lib/ad-pricing';
import { useI18n } from '@/components/I18nProvider';
import { useFormDraft } from '@/lib/use-form-draft';
import { openExternalUrl } from '@/lib/open-external';

/**
 * The campaign builder, and nothing else.
 *
 * WHAT WAS DELETED AND WHY. This file used to carry a second exported
 * component, `AdvertisePage`, plus the marketing furniture only it rendered —
 * a live ticker, an AI-scanner animation, a scan demo, a count-up, four icons
 * and a queue fixture. **Nothing imported it.** `/advertise` renders
 * `MmmAdvertiseLanding`, and `/app/me/advertising/new` renders
 * `MmmCampaignBuilderPage` below; an exhaustive search of `src/`, `e2e/`,
 * `scripts/` and the JSON turned up no other reference. It was 645 of the
 * file's 1,034 lines.
 *
 * `audit:mounts` could not see it, and that is worth knowing rather than
 * fixing here: that walk asks whether anything renders a FILE, and this file
 * is reached — by its other export. A dead export inside a live module is
 * invisible to it, to TypeScript, and to every other check in this repository.
 * It was found while looking for the inline-style debt `audit:spacing` points
 * at, because this was the file at the top of that list — most of which turned
 * out to be spacing on markup nobody has ever seen.
 */

/* Money is the one helper the builder needs. `fmt` went with the ticker. */
function money(n: number): string { return '$' + Math.round(n).toLocaleString('en-US'); }

/* ── Coverage Builder ────────────────────────────────────── */
type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'redirecting' }
  | { phase: 'done'; status: 'AWAITING_PAYMENT' | 'REJECTED' | 'PENDING'; reasoning: string; message: string }
  | { phase: 'error'; error: string };

function CoverageBuilder() {
  const { t } = useI18n();
  const [scope, setScope] = useState<AdScope>('REGIONAL');
  const [months, setMonths] = useState<SponsorshipTermMonths>(3);
  const [title, setTitle] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' });
  const [audio, setAudio] = useState<{ phase: 'idle' | 'uploading' | 'done' | 'error'; url?: string; durationSecs?: number | null; fileName?: string; error?: string }>({ phase: 'idle' });
  const draft = useMemo(() => ({ scope, months, title, clickUrl, audio }), [audio, clickUrl, months, scope, title]);
  const draftDirty = Boolean(title.trim() || clickUrl.trim() || audio.phase === 'done' || scope !== 'REGIONAL' || months !== 3);
  const clearDraft = useFormDraft({
    dirty: draftDirty,
    key: 'ihype-draft-ad-campaign',
    onRestore: (saved: typeof draft) => {
      if (AD_SCOPES.includes(saved.scope)) setScope(saved.scope);
      if ((SPONSORSHIP_TERMS_MONTHS as readonly number[]).includes(saved.months)) setMonths(saved.months);
      setTitle(saved.title ?? '');
      setClickUrl(saved.clickUrl ?? '');
      if (saved.audio?.phase === 'done' && saved.audio.url) setAudio(saved.audio);
    },
    value: draft,
  });

  async function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAudio({ phase: 'uploading', fileName: file.name });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/advertise/audio-upload', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; durationSecs?: number | null; error?: string };
      if (!res.ok || !data.url) {
        setAudio({ phase: 'error', fileName: file.name, error: data.error ?? 'Upload failed.' });
        return;
      }
      setAudio({ phase: 'done', url: data.url, durationSecs: data.durationSecs, fileName: file.name });
    } catch {
      setAudio({ phase: 'error', fileName: file.name, error: 'Upload failed. Are you logged in?' });
    }
  }

  const quote: SponsorshipQuote = quoteSponsorship(scope, months);
  const monthly = quote.monthlyCents / 100;
  const total = quote.totalCents / 100;

  // Dot grid
  const dots = Array.from({ length: 48 }, (_, i) => {
    const c = i % 16, row = Math.floor(i / 16);
    let lit = false;
    if (scope === 'LOCAL') lit = c >= 6 && c <= 9 && row === 1;
    if (scope === 'REGIONAL') lit = c >= 4 && c <= 11;
    if (scope === 'NATIONAL') lit = c >= 2 && c <= 13;
    if (scope === 'GLOBAL') lit = true;
    return lit;
  });

  const INPUT_S: React.CSSProperties = { fontFamily: "var(--f-b,'Work Sans',sans-serif)", fontSize: 'inherit', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0 };
  const TEXT_INPUT_S: React.CSSProperties = { width: '100%', fontFamily: "var(--f-b,'Work Sans',sans-serif)", fontSize: '0.9375rem', color: 'var(--ink)', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '11px 13px', outline: 'none' };

  async function handleSubmit() {
    if (!title.trim()) {
      setSubmit({ phase: 'error', error: t('advertisePage.errNoTitle', 'Give your campaign a title or ad copy line first.') });
      return;
    }
    if (audio.phase === 'uploading') {
      setSubmit({ phase: 'error', error: t('advertisePage.errAudioUploading', 'Wait for the ad audio to finish uploading first.') });
      return;
    }
    if (audio.phase !== 'done') {
      setSubmit({ phase: 'error', error: t('advertisePage.errNoAudio', 'Upload your ad audio first — every iHYPE campaign is a radio-style audio spot.') });
      return;
    }
    setSubmit({ phase: 'submitting' });
    try {
      const result = await postJson<{
        checkoutUrl: string | null;
        vetting: { status: 'AWAITING_PAYMENT' | 'REJECTED' | 'PENDING'; reasoning: string; message: string };
      }>('/api/advertise/campaigns', {
        scope, months, title: title.trim(), clickUrl: clickUrl.trim(),
        audioUrl: audio.url, audioDurationSecs: audio.durationSecs ?? undefined,
      });
      if (result.vetting.status === 'AWAITING_PAYMENT' && result.checkoutUrl) {
        clearDraft();
        setSubmit({ phase: 'redirecting' });
        await openExternalUrl(result.checkoutUrl);
        return;
      }
      setSubmit({ phase: 'done', ...result.vetting });
    } catch (err) {
      setSubmit({ phase: 'error', error: err instanceof Error ? err.message : t('advertisePage.errSubmitFailed', 'Could not submit campaign. Are you logged in?') });
    }
  }

  return (
    <div className="adv-builder" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
      {/* Controls */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--hair-70)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--hair-70)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "var(--f-d,'Bricolage Grotesque',sans-serif)", fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-.01em' }}>{t('advertisePage.campaign', 'Campaign')}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', color: 'var(--ink-2)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{t('advertisePage.noContract', 'No contract · cancel anytime')}</span>
        </div>
        <div style={{ padding: '22px 20px', flex: 1 }}>
          {/* Coverage area */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.6875rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent-text)' }}>A.</span> {t('advertisePage.coverageArea', 'Coverage area')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {AD_SCOPES.map(s => (
                <button key={s} onClick={() => setScope(s)} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 15px', borderRadius: 11,
                  border: `1px solid ${s === scope ? 'var(--accent)' : 'var(--hair-70)'}`,
                  background: s === scope ? 'rgba(var(--accent-rgb),.07)' : 'var(--bg-3)',
                  cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .15s, background .15s',
                }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {[0, 6, 12].map(o => <span key={o} style={{ position: 'absolute', inset: o, borderRadius: '50%', border: `1.5px solid ${s === scope ? 'var(--accent)' : 'var(--ink-4)'}` }} />)}
                  </span>
                  <span>
                    <div style={{ fontFamily: "var(--f-d,'Bricolage Grotesque',sans-serif)", fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-.01em' }}>{AD_SCOPE_LABELS[s]}</div>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', color: 'var(--ink-2)', letterSpacing: '.04em', marginTop: 3 }}>{AD_SCOPE_DESCRIPTIONS[s]}</div>
                  </span>
                  <span style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "var(--f-d,'Bricolage Grotesque',sans-serif)", fontWeight: 700, fontSize: '1rem', letterSpacing: '-.01em', color: s === scope ? 'var(--accent-text)' : 'inherit' }}>{money(SPONSORSHIP_MONTHLY_USD[s])}</div>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', color: 'var(--ink-2)', letterSpacing: '.06em', marginTop: 2 }}>{t('advertisePage.perMonth', '/ month')}</div>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Term. There is no "spots per day" any more: it never reached
              delivery — the station shares airtime equally among live
              sponsors — so it was a number the buyer chose and the server
              ignored. What is bought is a stretch of time in the rotation. */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.6875rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent-text)' }}>B.</span> {t('advertisePage.term', 'Term')}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {SPONSORSHIP_TERMS_MONTHS.map(m => (
                <button key={m} onClick={() => setMonths(m)} style={{
                  flex: 1, padding: '11px 8px', borderRadius: 9,
                  border: `1px solid ${months === m ? 'var(--accent)' : 'var(--hair-70)'}`,
                  background: months === m ? 'rgba(var(--accent-rgb),.07)' : 'var(--bg-3)',
                  fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', letterSpacing: '.04em',
                  color: months === m ? 'var(--accent-text)' : 'var(--ink-2)', cursor: 'pointer', transition: 'all .15s',
                }}>{m} {m === 1 ? t('advertisePage.month', 'month') : t('advertisePage.months', 'months')}</button>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', color: 'var(--ink-2)', letterSpacing: '.04em', marginTop: 10 }}>
              {t('advertisePage.termNote', 'Cancel any time — the days you have not used are refunded.')}
            </div>
          </div>

          {/* Campaign details (required for the AI screen) */}
          <div>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.6875rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent-text)' }}>D.</span> {t('advertisePage.whatsTheAd', "What's the ad")}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                style={TEXT_INPUT_S}
                placeholder={t('advertisePage.titlePlaceholder', 'Campaign title / ad copy — e.g. "Nocturnal — North American tour 2026"')}
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={280}
              />
              <input
                style={TEXT_INPUT_S}
                placeholder={t('advertisePage.clickUrlPlaceholder', 'Destination link (optional)')}
                value={clickUrl}
                onChange={e => setClickUrl(e.target.value)}
              />
              <div>
                <label className="adv-btn-ghost adv-btn-sm" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                  {audio.phase === 'uploading' ? t('advertisePage.uploading', 'Uploading…') : audio.phase === 'done' ? t('advertisePage.replaceAudio', 'Replace ad audio') : t('advertisePage.uploadAudio', 'Upload ad audio (required)')}
                  <input accept="audio/*" onChange={handleAudioChange} style={{ display: 'none' }} type="file" />
                </label>
                {audio.phase === 'done' && (
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', color: 'var(--role-venue)', marginTop: 8 }}>
                    ✓ {audio.fileName}{typeof audio.durationSecs === 'number' ? ` · :${audio.durationSecs}` : ''} — {t('advertisePage.willPlayInBreaks', 'will play in station ad breaks')}
                  </div>
                )}
                {audio.phase === 'error' && (
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', color: 'var(--danger-text)', marginTop: 8 }}>{audio.error}</div>
                )}
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', color: 'var(--ink-2)', marginTop: 6 }}>
                  {t('advertisePage.audioRequiredNote', 'Ad audio is required for your campaign to run — iHYPE only ever plays radio-style audio spots, never a visual banner or feed placement.')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reach + Receipt */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--hair-70)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--hair-70)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "var(--f-d,'Bricolage Grotesque',sans-serif)", fontWeight: 700, fontSize: '0.9375rem' }}>{AD_SCOPE_LABELS[scope]} {t('advertisePage.reach', 'reach')}</span>
        </div>
        <div style={{ padding: '22px 20px', flex: 1 }}>
          {/* Dot grid */}
          <div className="adv-dot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 7, padding: '4px 2px 0' }}>
            {dots.map((lit, i) => (
              <span key={i} style={{ aspectRatio: '1', borderRadius: '50%', background: lit ? 'var(--accent)' : 'var(--ink-4)', boxShadow: lit ? '0 0 8px rgba(var(--accent-rgb),.5)' : 'none', transition: 'background .35s, box-shadow .35s', display: 'block' }} />
            ))}
          </div>

          {/* Stats */}
          <div className="adv-quote-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 20 }}>
            {/* NO IMPRESSION FORECAST HERE, deliberately. This block used to
                read "Daily impressions 8,000 · Total over run 240,000 ·
                Effective CPM $0.19" beside a receipt the buyer was charged in
                full — numbers the station cannot produce (it makes eight
                impressions per listener-hour) and delivery never honoured.
                What a sponsor is buying is a share of the rotation for a
                stretch of time, so that is what the panel states. Real
                delivery is reported on their dashboard once spots have
                actually aired. */}
            {[{ v: money(monthly), l: t('advertisePage.perMonthLabel', 'Per month') }, { v: `${quote.months}`, l: quote.months === 1 ? t('advertisePage.monthLabel', 'Month') : t('advertisePage.monthsLabel', 'Months') }, { v: t('advertisePage.equalShareValue', 'Equal'), l: t('advertisePage.equalShareLabel', 'Share of breaks') }].map(s => (
              <div key={s.l} style={{ minWidth: 0, padding: '13px 14px', border: '1px solid var(--hair-70)', borderRadius: 11, background: 'var(--bg-3)' }}>
                <div style={{ fontFamily: "var(--f-d,'Bricolage Grotesque',sans-serif)", fontWeight: 800, fontSize: '1.3125rem', letterSpacing: '-.02em' }}>{s.v}</div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', letterSpacing: '.1em', color: 'var(--ink-2)', textTransform: 'uppercase', marginTop: 6 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Placement chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {/* "Live show intermissions" was a placement nobody could buy
                (2026-09-11): no member can host a broadcast for a spot to sit
                inside, so every spot sold airs in a station break. Replaced
                with the placement rule that is real and is the better
                promise anyway. */}
            {[{ color: 'var(--role-fan)', label: t('advertisePage.stationAdBreaks', 'Station ad breaks') }, { color: 'var(--role-venue)', label: t('advertisePage.betweenSongs', 'Between songs, never mid-track') }].map(p => (
              <span key={p.label} style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', letterSpacing: '.06em', color: 'var(--ink-a65)', padding: '6px 11px', borderRadius: 99, border: '1px solid var(--hair-70)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: p.color }} />
                {p.label}
              </span>
            ))}
          </div>

          {/* Receipt */}
          <div style={{ marginTop: 20, borderTop: '1px dashed var(--line-2)', paddingTop: 18 }}>
            {[{ k: `${AD_SCOPE_LABELS[scope]} ${t('advertisePage.sponsorship', 'sponsorship')}`, v: `${money(monthly)} ${t('advertisePage.perMonth', '/ month')}` }, { k: `${quote.months} × ${money(monthly)}`, v: money(total) }].map(r => (
              <div className="adv-receipt-row" key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '7px 0', fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem' }}>
                <span style={{ color: 'var(--ink-2)', letterSpacing: '.06em' }}>{r.k}</span>
                <span>{r.v}</span>
              </div>
            ))}
            <div className="adv-receipt-total" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--hair-70)' }}>
              <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.6875rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-a65)' }}>{t('advertisePage.total', 'Total')}</span>
              <span style={{ fontFamily: "var(--f-d,'Bricolage Grotesque',sans-serif)", fontWeight: 800, fontSize: '2.125rem', letterSpacing: '-.03em', color: 'var(--accent-text)' }}>
                {money(total)}<small style={{ fontFamily: 'var(--f-m,monospace)', fontSize: '0.9375rem', color: 'var(--ink-2)', letterSpacing: '.04em', fontWeight: 400, marginLeft: 4 }}>{money(monthly)}{t('advertisePage.slashMonth', '/month')}</small>
              </span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submit.phase === 'submitting' || submit.phase === 'redirecting'}
              className="adv-btn-solid"
              style={{ width: '100%', marginTop: 16, opacity: submit.phase === 'submitting' || submit.phase === 'redirecting' ? .6 : 1 }}
            >
              {submit.phase === 'submitting' ? t('advertisePage.screening', 'Screening…') : submit.phase === 'redirecting' ? t('advertisePage.redirecting', 'Redirecting to payment…') : t('advertisePage.submitCampaign', 'Submit campaign →')}
            </button>

            <div aria-atomic="true" aria-live="polite">
            {submit.phase === 'done' && (
              <div style={{
                marginTop: 12, padding: '12px 14px', borderRadius: 10,
                background: submit.status === 'AWAITING_PAYMENT' ? 'rgba(var(--role-venue-rgb),.1)' : submit.status === 'REJECTED' ? 'rgba(255,90,90,.1)' : 'rgba(var(--warning-rgb),.1)',
                border: `1px solid ${submit.status === 'AWAITING_PAYMENT' ? 'rgba(var(--role-venue-rgb),.3)' : submit.status === 'REJECTED' ? 'rgba(255,90,90,.3)' : 'rgba(var(--warning-rgb),.3)'}`,
              }}>
                <div style={{ fontFamily: "var(--f-d,'Bricolage Grotesque',sans-serif)", fontWeight: 800, fontSize: '0.9375rem', color: submit.status === 'AWAITING_PAYMENT' ? 'var(--role-venue)' : submit.status === 'REJECTED' ? 'var(--danger-text)' : 'var(--warning)' }}>
                  {submit.message}
                </div>
                <div style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', marginTop: 4, lineHeight: 1.5 }}>{submit.reasoning}</div>
                <Link href="/advertise/dashboard" style={{ display: 'inline-block', marginTop: 8, fontSize: '0.9375rem', color: 'var(--ink)', textDecoration: 'underline' }}>
                  {t('advertisePage.viewMyCampaigns', 'View my campaigns →')}
                </Link>
              </div>
            )}
            {submit.phase === 'error' && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,90,90,.1)', border: '1px solid rgba(255,90,90,.3)', fontSize: '0.9375rem', color: 'var(--danger-text)' }}>
                {submit.error}
              </div>
            )}
            </div>

            <p style={{ fontFamily: 'var(--font-serif-accent)', fontStyle: 'italic', fontSize: '0.9375rem', color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.45 }}>
              {t('advertisePage.nothingChargesNote', 'Nothing charges until your creative clears the AI screen.')}
              <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: 'var(--accent)', marginLeft: 3, verticalAlign: 'middle' }} />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MmmCampaignBuilderPage() {
  const { t } = useI18n();

  return (
    <div className="adv-compact adv-shell">
      <style>{`
        .adv-btn-solid { background:var(--accent); color:var(--bg); display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:var(--f-m,monospace); font-weight:600; font-size: 0.9375rem; letter-spacing:.06em; padding:13px 22px; border-radius:9px; cursor:pointer; transition:filter .15s; text-decoration:none; border:none; white-space:nowrap }
        .adv-btn-solid:hover { filter:brightness(1.08) }
        /* NOT a restoration -- a FIX. These four classes are worn by markup the
           BUILDER renders (the audio-file label is adv-btn-ghost adv-btn-sm,
           the root is adv-shell, the coverage dots are adv-dot-grid) and their
           only declarations lived in the style block of the component nothing
           ever rendered. A style element only reaches the document when its
           component does, so none of these rules has EVER applied: the baseline
           capture measures the file picker at 215x19, a bare line of text where
           a bordered button was intended -- on the control an advertiser uses
           to upload the spot they are paying for.

           audit:unstyled could not see it either, and its header says why: any
           style block in a file counts as a definition source, because
           over-collecting definitions can only hide a finding, never invent
           one. Deleting the dead half is what exposed these.

           min-height is the one addition. MOBILE.md's 44x44 floor is
           unconditional, the padding here computes to about 37px, and a
           control being drawn for the first time should meet the floor rather
           than inherit a miss. No backticks in this comment: the block is a
           template literal. */
        .adv-btn-ghost { border:1px solid var(--line-2); color:var(--ink); display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:var(--f-m,monospace); font-weight:600; font-size: 0.9375rem; letter-spacing:.06em; padding:13px 22px; border-radius:9px; cursor:pointer; transition:background .15s, border-color .15s; text-decoration:none; white-space:nowrap; background:none }
        .adv-btn-ghost:hover { background:var(--hair-50); border-color:var(--ink-2) }
        .adv-btn-sm { padding:9px 15px !important; font-size: 0.9375rem !important; min-height:44px }
        @media (max-width:480px) { .adv-dot-grid { grid-template-columns:repeat(8, 1fr) !important } }
        @media (max-width:640px) { .adv-shell { padding-left:16px !important; padding-right:16px !important } }
        .adv-compact { width:100%; max-width:1180px; margin:0 auto; padding:20px 40px 72px }
        .adv-compact-head { display:flex; align-items:end; justify-content:space-between; gap:24px; margin-bottom:22px }
        .adv-compact h1 { margin:6px 0 0; font-family:var(--f-d,'Bricolage Grotesque',sans-serif); font-size:clamp(2rem,5vw,3.4rem); line-height:.95; letter-spacing:-.04em }
        .adv-compact-intro { max-width:52ch; margin:10px 0 0; color:var(--ink-2); line-height:1.5 }
        .adv-compact-note { flex:0 0 290px; padding:13px 15px; border:1px solid var(--hair-70); border-radius:12px; background:var(--bg-2); color:var(--ink-2); font-size: 0.9375rem; line-height:1.45 }
        .adv-compact-note b { color:var(--ink) }
        .adv-compact-details { margin-top:18px; border:1px solid var(--hair-70); border-radius:14px; background:var(--bg-2); overflow:hidden }
        .adv-compact-details summary { cursor:pointer; padding:15px 18px; font-family:var(--f-m,monospace); font-size: 0.9375rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase }
        .adv-compact-rules { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; padding:0 18px 18px }
        .adv-compact-rules div { color:var(--ink-2); font-size: 0.9375rem; line-height:1.5 }
        .adv-compact-rules b { display:block; margin-bottom:3px; color:var(--ink); font-size:.8125rem }
        @media (max-width:1180px) { .adv-builder { grid-template-columns:1fr !important } }
        @media (max-width:520px) {
          .adv-quote-stats { grid-template-columns:1fr !important }
          .adv-receipt-row, .adv-receipt-total { align-items:flex-start !important; flex-direction:column; gap:4px !important }
        }
        @media (max-width:760px) {
          .adv-compact { padding:14px 16px 56px }
          .adv-compact-head { display:block }
          .adv-compact-note { margin-top:16px }
          .adv-compact-rules { grid-template-columns:1fr }
        }
      `}</style>
      <header className="adv-compact-head">
        <div>
          <p className="mmm-eyebrow mmm-eyebrow-accent">{t('advertisePage.heroEyebrow', 'Advertise on iHYPE')}</p>
          <h1>{t('advertisePage.compactTitle', 'Build a campaign')}</h1>
          <p className="adv-compact-intro">
            {t('advertisePage.compactIntro', 'Choose who hears it, set the schedule, upload your audio and review the live price. You will confirm payment only after the campaign passes screening.')}
          </p>
        </div>
        <div className="adv-compact-note">
          <b>{t('advertisePage.musicOnlyShort', 'Music-related advertising only.')}</b>{' '}
          {t('advertisePage.compactNote', 'No copyrighted music, unlicensed artist references, unsafe claims or unrelated products.')}
        </div>
      </header>

      <CoverageBuilder />

      <details className="adv-compact-details">
        <summary>{t('advertisePage.screeningAndBilling', 'Screening, eligibility and billing')}</summary>
        <div className="adv-compact-rules">
          <div><b>{t('advertisePage.compactEligibleTitle', 'Who can advertise')}</b>{t('advertisePage.compactEligibleBody', 'Verified artists, venues, promoters and music-related businesses. Non-music campaigns are rejected.')}</div>
          <div><b>{t('advertisePage.compactScreenTitle', 'What gets screened')}</b>{t('advertisePage.compactScreenBody', 'Business eligibility, audio relevance, listener safety, copyright and misleading claims are checked before checkout.')}</div>
          <div><b>{t('advertisePage.compactBillingTitle', 'When you pay')}</b>{t('advertisePage.compactBillingBodyTerm', 'A sponsorship that passes vetting is paid in full at checkout and runs for the term you chose. Cancel part-way and the days you have not used are refunded to the card you paid with, usually within 5–10 business days, with the amount and the Stripe reference on your dashboard. Your spot is never billed per play, so it cannot run out mid-term. iHYPE absorbs the card-processing fee. Rejected spots never run and are never charged.')}</div>
        </div>
      </details>
    </div>
  );
}

