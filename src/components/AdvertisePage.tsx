'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { postJson } from '@/lib/api-client';
import {
  AD_SCOPES, AD_SCOPE_LABELS, AD_SCOPE_DESCRIPTIONS, AD_RUN_LENGTHS_DAYS,
  MIN_SPOTS_PER_DAY, MAX_SPOTS_PER_DAY, quoteAdCampaign,
  type AdScope, type AdCampaignQuote,
} from '@/lib/ad-pricing';

/* ── Types ───────────────────────────────────────────────── */
type ScanSub = { n: string; k: string; tag: string; copy: string; body: string; gates: [string, string, 'pass' | 'fail'][]; ok: boolean };

export type AdvertisePageStats = {
  activeCampaigns: number;
  clearedPct: number | null;
};

const QUEUE = [
  { name: 'Velvet Room — Fri all-ages show', kind: 'Venue', color: '#22e5d4', ok: true },
  { name: 'Maya Reyes — "Sundown" single', kind: 'Artist', color: '#b983ff', ok: true },
  { name: 'NorthBeat Pedals — summer sale', kind: '3rd-party · Gear', color: '#7fb3ff', ok: true },
  { name: 'Crypto "music NFT" airdrop', kind: 'Flagged · off-topic', color: '#ff5a5a', ok: false },
  { name: 'Loft Sessions — tour dates', kind: 'Promoter', color: '#ff3e9a', ok: true },
  { name: 'Ad samples a charting pop hook', kind: 'Flagged · copyright', color: '#ff5a5a', ok: false },
  { name: 'Press & Fold — merch printing', kind: '3rd-party · Merch', color: '#7fb3ff', ok: true },
  { name: 'Energy drink, "as heard on radio"', kind: 'Flagged · non-music', color: '#ff5a5a', ok: false },
  { name: 'Cobalt Hour — EP release', kind: 'Artist', color: '#b983ff', ok: true },
  { name: 'Eastside Rehearsal Rooms', kind: '3rd-party · Studio', color: '#7fb3ff', ok: true },
];

const SUBS: ScanSub[] = [
  { n: 'Velvet Room — Fri show', k: 'Venue · Local', tag: 'VENUE EVENT', copy: 'All-ages Friday: three local bands, doors 7pm',
    body: 'The Velvet Room · 21 Mercer St · $12 at the door · presented by the venue.',
    gates: [['Verified buyer','Verified venue account','pass'],['Audio relevance','Live event, original copy','pass'],['Listener safety','No flags — clean for all audiences','pass'],['Copyright firewall','No songs or name-drops','pass'],['Reputation risk','No misleading claims','pass']], ok: true },
  { n: 'NorthBeat Pedals', k: '3rd-party · Gear', tag: 'GEAR · 3RD-PARTY', copy: 'Summer pedal sale — 20% off all overdrive',
    body: 'NorthBeat Pedals · handmade effects for guitarists · ships worldwide.',
    gates: [['Verified buyer','Verified gear retailer','pass'],['Audio relevance','Instruments & gear','pass'],['Listener safety','No flags — clean for all audiences','pass'],['Copyright firewall','Own product, no names','pass'],['Reputation risk','No misleading claims','pass']], ok: true },
  { n: 'GlowSkin Supplements', k: 'Unverified · retail', tag: 'GENERAL RETAIL', copy: 'Glow from within — 30% off vitamins',
    body: 'GlowSkin · beauty & wellness gummies · use code GLOW30.',
    gates: [['Verified buyer','No music link found','fail'],['Audio relevance','General retail product','fail'],['Listener safety','— not evaluated','pass'],['Copyright firewall','— not evaluated','pass'],['Reputation risk','— not evaluated','pass']], ok: false },
  { n: '"Anthem" promo cut', k: 'Artist · Regional', tag: 'SINGLE PROMO', copy: 'New single — hook from a #1 chart record',
    body: 'Uses a sampled chorus and drops two major-label artist names for clout.',
    gates: [['Verified buyer','Verified artist','pass'],['Audio relevance','Music release','pass'],['Listener safety','No flags — clean for all audiences','pass'],['Copyright firewall','Sampled hook + name-drops','fail'],['Reputation risk','— not evaluated','pass']], ok: false },
];

/* ── Helpers ─────────────────────────────────────────────── */
function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K';
  return '' + n;
}
function money(n: number): string { return '$' + Math.round(n).toLocaleString('en-US'); }

/* ── Sub-components ──────────────────────────────────────── */
function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function CrossIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>;
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
function MinusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

function Wordmark() {
  return (
    <a href="/" style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, letterSpacing: '-.04em', lineHeight: .85, display: 'inline-flex', alignItems: 'baseline', color: 'inherit', textDecoration: 'none', fontSize: 21 }}>
      iH<span style={{ position: 'relative', display: 'inline-block', letterSpacing: 0 }}>
        y<span style={{ display: 'block', width: '.22em', height: '.22em', borderRadius: '50%', background: '#ff5029', position: 'absolute', left: 'calc(50% - .01em)', top: '.03em', transform: 'translateX(-50%)' }} />
      </span>pe
    </a>
  );
}

/* ── Ticker ──────────────────────────────────────────────── */
function LiveTicker() {
  const [rows, setRows] = useState(QUEUE.slice(0, 5).map((q, i) => ({ ...q, id: i })));
  const [count, setCount] = useState(347);
  const [clock, setClock] = useState('');
  const idRef = useRef(5);
  const qiRef = useRef(5);

  useEffect(() => {
    const interval = setInterval(() => {
      const item = QUEUE[qiRef.current % QUEUE.length];
      qiRef.current++;
      const id = idRef.current++;
      setRows(prev => [{ ...item, id }, ...prev].slice(0, 5));
      setCount(c => c + 1);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside style={{ background: '#100d09', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 70px -20px rgba(0,0,0,.7)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(34,229,212,.4)', color: '#22e5d4' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: 'adv-pulse 2.4s ease-out infinite', flexShrink: 0 }} />
          Live
        </span>
        <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9e9080' }}>Vetting queue</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, color: '#5a5048', letterSpacing: '.08em' }}>{clock}</span>
      </div>
      <div style={{ padding: '8px 8px 12px', display: 'flex', flexDirection: 'column' }}>
        {rows.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 9, animation: 'adv-rowIn .5s cubic-bezier(.2,.7,.2,1)' }}>
            <span style={{
              width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              border: `1px solid color-mix(in srgb, ${item.color} 40%, transparent)`,
              color: item.color,
            }}>
              {item.ok ? <CheckIcon /> : <CrossIcon />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--f-b,DM Sans,sans-serif)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, letterSpacing: '.08em', color: '#5a5048', textTransform: 'uppercase', marginTop: 2 }}>{item.kind}</div>
            </span>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600, color: item.ok ? '#22e5d4' : '#ff5a5a', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {item.ok ? <CheckIcon /> : <CrossIcon />}
              {item.ok ? 'Cleared' : 'Rejected'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ padding: '11px 18px', borderTop: '1px solid rgba(255,255,255,.07)', fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, color: '#5a5048', letterSpacing: '.06em', display: 'flex', justifyContent: 'space-between' }}>
        <span>Reviewed by <b style={{ color: '#9e9080' }}>HYPE Screen</b> · automated</span>
        <span><b style={{ color: '#9e9080' }}>{count.toLocaleString()}</b> today</span>
      </div>
    </aside>
  );
}

/* ── Coverage Builder ────────────────────────────────────── */
type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'done'; status: 'APPROVED' | 'REJECTED' | 'PENDING'; reasoning: string; message: string }
  | { phase: 'error'; error: string };

function CoverageBuilder() {
  const [scope, setScope] = useState<AdScope>('REGIONAL');
  const [spots, setSpots] = useState(6);
  const [days, setDays] = useState<(typeof AD_RUN_LENGTHS_DAYS)[number]>(14);
  const [title, setTitle] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' });

  const quote: AdCampaignQuote = quoteAdCampaign(scope, spots, days);
  const perSpot = quote.ratePerSpotCents / 100;
  const dailyCost = quote.dailyCostCents / 100;
  const total = quote.totalCostCents / 100;
  const cpm = quote.effectiveCpmCents / 100;
  const everyH = 24 / spots;
  const spotsNote = spots >= 24 ? '≈ hourly placements, all day long'
    : `≈ one placement every ${everyH >= 1 ? everyH.toFixed(everyH % 1 ? 1 : 0) : '<1'} hours across the feed`;

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

  const INPUT_S: React.CSSProperties = { fontFamily: 'var(--f-b,DM Sans,sans-serif)', fontSize: 'inherit', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0 };
  const TEXT_INPUT_S: React.CSSProperties = { width: '100%', fontFamily: 'var(--f-b,DM Sans,sans-serif)', fontSize: 13, color: '#f0ebe5', background: '#1a1612', border: '1px solid rgba(255,255,255,.14)', borderRadius: 9, padding: '11px 13px', outline: 'none' };

  async function handleSubmit() {
    if (!title.trim()) {
      setSubmit({ phase: 'error', error: 'Give your campaign a title or ad copy line first.' });
      return;
    }
    setSubmit({ phase: 'submitting' });
    try {
      const result = await postJson<{
        vetting: { status: 'APPROVED' | 'REJECTED' | 'PENDING'; reasoning: string; message: string };
      }>('/api/advertise/campaigns', { scope, spotsPerDay: spots, runDays: days, title: title.trim(), clickUrl: clickUrl.trim() });
      setSubmit({ phase: 'done', ...result.vetting });
    } catch (err) {
      setSubmit({ phase: 'error', error: err instanceof Error ? err.message : 'Could not submit campaign. Are you logged in?' });
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
      {/* Controls */}
      <div style={{ background: '#100d09', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 700, fontSize: 14, letterSpacing: '-.01em' }}>Campaign</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, color: '#5a5048', letterSpacing: '.1em', textTransform: 'uppercase' }}>No contract · cancel anytime</span>
        </div>
        <div style={{ padding: '22px 20px', flex: 1 }}>
          {/* Coverage area */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5a5048', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#ff5029' }}>A.</span> Coverage area
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {AD_SCOPES.map(s => (
                <button key={s} onClick={() => setScope(s)} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 15px', borderRadius: 11,
                  border: `1px solid ${s === scope ? '#ff5029' : 'rgba(255,255,255,.07)'}`,
                  background: s === scope ? 'rgba(255,80,41,.07)' : '#1a1612',
                  cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .15s, background .15s',
                }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {[0, 6, 12].map(o => <span key={o} style={{ position: 'absolute', inset: o, borderRadius: '50%', border: `1.5px solid ${s === scope ? '#ff5029' : '#3a342e'}` }} />)}
                  </span>
                  <span>
                    <div style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 700, fontSize: 15, letterSpacing: '-.01em' }}>{AD_SCOPE_LABELS[s]}</div>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, color: '#5a5048', letterSpacing: '.04em', marginTop: 3 }}>{AD_SCOPE_DESCRIPTIONS[s]}</div>
                  </span>
                  <span style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 700, fontSize: 16, letterSpacing: '-.01em', color: s === scope ? '#ff5029' : 'inherit' }}>{money(quoteAdCampaign(s, 1, 1).ratePerSpotCents / 100)}</div>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 8.5, color: '#5a5048', letterSpacing: '.06em', marginTop: 2 }}>/ spot · day</div>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Spots per day */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5a5048', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#ff5029' }}>B.</span> Spots per day
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
              <button aria-label="Decrease spots per day" onClick={() => setSpots(s => Math.max(MIN_SPOTS_PER_DAY, s - 1))} style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9e9080', cursor: 'pointer', ...INPUT_S, transition: 'background .15s' }}><MinusIcon /></button>
              <div style={{ minWidth: 64, textAlign: 'center', fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', borderLeft: '1px solid rgba(255,255,255,.07)', borderRight: '1px solid rgba(255,255,255,.07)', height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{spots}</div>
              <button aria-label="Increase spots per day" onClick={() => setSpots(s => Math.min(MAX_SPOTS_PER_DAY, s + 1))} style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9e9080', cursor: 'pointer', ...INPUT_S, transition: 'background .15s' }}><PlusIcon /></button>
            </div>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: '#5a5048', letterSpacing: '.04em', marginTop: 10 }}>{spotsNote}</div>
          </div>

          {/* Run length */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5a5048', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#ff5029' }}>C.</span> Run length
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {AD_RUN_LENGTHS_DAYS.map(d => (
                <button key={d} onClick={() => setDays(d)} style={{
                  flex: 1, padding: '11px 8px', borderRadius: 9,
                  border: `1px solid ${days === d ? '#ff5029' : 'rgba(255,255,255,.07)'}`,
                  background: days === d ? 'rgba(255,80,41,.07)' : '#1a1612',
                  fontFamily: 'var(--f-m,monospace)', fontSize: 11, letterSpacing: '.04em',
                  color: days === d ? '#ff5029' : '#9e9080', cursor: 'pointer', transition: 'all .15s',
                }}>{d} days</button>
              ))}
            </div>
          </div>

          {/* Campaign details (required for the AI screen) */}
          <div>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5a5048', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#ff5029' }}>D.</span> What's the ad
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                style={TEXT_INPUT_S}
                placeholder="Campaign title / ad copy — e.g. &quot;Nocturnal — North American tour 2026&quot;"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={280}
              />
              <input
                style={TEXT_INPUT_S}
                placeholder="Destination link (optional)"
                value={clickUrl}
                onChange={e => setClickUrl(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reach + Receipt */}
      <div style={{ background: '#100d09', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 700, fontSize: 14 }}>{AD_SCOPE_LABELS[scope]} reach</span>
        </div>
        <div style={{ padding: '22px 20px', flex: 1 }}>
          {/* Dot grid */}
          <div className="adv-dot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 7, padding: '4px 2px 0' }}>
            {dots.map((lit, i) => (
              <span key={i} style={{ aspectRatio: '1', borderRadius: '50%', background: lit ? '#ff5029' : '#3a342e', boxShadow: lit ? '0 0 8px rgba(255,80,41,.5)' : 'none', transition: 'background .35s, box-shadow .35s', display: 'block' }} />
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {[{ v: fmt(quote.dailyImpressions), l: 'Daily impressions' }, { v: fmt(quote.totalImpressions), l: 'Total over run' }, { v: '$' + cpm.toFixed(2), l: 'Effective CPM' }].map(s => (
              <div key={s.l} style={{ flex: 1, padding: '13px 14px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 11, background: '#1a1612' }}>
                <div style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 21, letterSpacing: '-.02em' }}>{s.v}</div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 8.5, letterSpacing: '.1em', color: '#5a5048', textTransform: 'uppercase', marginTop: 6 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Placement chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {[{ color: '#b983ff', label: 'Discover feed' }, { color: '#22e5d4', label: 'Chart interstitials' }, { color: '#ffb84a', label: 'Seed swipe cards' }].map(p => (
              <span key={p.label} style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.06em', color: '#9e9080', padding: '6px 11px', borderRadius: 99, border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: p.color }} />
                {p.label}
              </span>
            ))}
          </div>

          {/* Receipt */}
          <div style={{ marginTop: 20, borderTop: '1px dashed rgba(255,255,255,.14)', paddingTop: 18 }}>
            {[{ k: `${AD_SCOPE_LABELS[scope]} base`, v: `${money(perSpot)} / spot` }, { k: `${spots} spots/day × ${days} days`, v: `${money(dailyCost)} / day` }, { k: 'Co-op handling · 0%', v: '$0.00', vc: '#22e5d4' }].map(r => (
              <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', fontFamily: 'var(--f-m,monospace)', fontSize: 12 }}>
                <span style={{ color: '#5a5048', letterSpacing: '.06em' }}>{r.k}</span>
                <span style={{ color: r.vc ?? 'inherit' }}>{r.v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9e9080' }}>Total</span>
              <span style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 34, letterSpacing: '-.03em', color: '#ff5029' }}>
                {money(total)}<small style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: '#5a5048', letterSpacing: '.04em', fontWeight: 400, marginLeft: 4 }}>{money(dailyCost)}/day</small>
              </span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submit.phase === 'submitting'}
              className="adv-btn-solid"
              style={{ width: '100%', marginTop: 16, opacity: submit.phase === 'submitting' ? .6 : 1 }}
            >
              {submit.phase === 'submitting' ? 'Screening…' : 'Submit campaign →'}
            </button>

            {submit.phase === 'done' && (
              <div style={{
                marginTop: 12, padding: '12px 14px', borderRadius: 10,
                background: submit.status === 'APPROVED' ? 'rgba(34,229,212,.1)' : submit.status === 'REJECTED' ? 'rgba(255,90,90,.1)' : 'rgba(255,184,74,.1)',
                border: `1px solid ${submit.status === 'APPROVED' ? 'rgba(34,229,212,.3)' : submit.status === 'REJECTED' ? 'rgba(255,90,90,.3)' : 'rgba(255,184,74,.3)'}`,
              }}>
                <div style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 13, color: submit.status === 'APPROVED' ? '#22e5d4' : submit.status === 'REJECTED' ? '#ff5a5a' : '#ffb84a' }}>
                  {submit.message}
                </div>
                <div style={{ fontSize: 11, color: '#9e9080', marginTop: 4, lineHeight: 1.5 }}>{submit.reasoning}</div>
              </div>
            )}
            {submit.phase === 'error' && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,90,90,.1)', border: '1px solid rgba(255,90,90,.3)', fontSize: 12, color: '#ff5a5a' }}>
                {submit.error}
              </div>
            )}

            <p style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontSize: 14, color: '#9e9080', marginTop: 14, lineHeight: 1.45 }}>
              Nothing charges until your creative clears the AI screen.
              <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: '#ff5029', marginLeft: 3, verticalAlign: 'middle' }} />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Scanner ─────────────────────────────────────────────── */
function AIScanner() {
  const [active, setActive] = useState(0);
  const [gateState, setGateState] = useState<('idle' | 'pass' | 'fail')[]>([]);
  const [verdict, setVerdict] = useState<'none' | 'pass' | 'fail'>('none');
  const [scanning, setScanning] = useState(false);
  const tokenRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const didScan = useRef(false);

  const runScan = useCallback((idx: number) => {
    const token = ++tokenRef.current;
    setActive(idx);
    setGateState([]);
    setVerdict('none');
    setScanning(true);

    const sub = SUBS[idx];
    sub.gates.forEach((g, i) => {
      setTimeout(() => {
        if (token !== tokenRef.current) return;
        setGateState(prev => {
          const next = [...prev];
          next[i] = g[2] === 'pass' ? 'pass' : 'fail';
          return next;
        });
        if (i === sub.gates.length - 1) {
          setTimeout(() => {
            if (token !== tokenRef.current) return;
            setVerdict(sub.ok ? 'pass' : 'fail');
            setScanning(false);
          }, 380);
        }
      }, 650 + i * 620);
    });
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !didScan.current) { didScan.current = true; runScan(0); }
      });
    }, { threshold: .12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [runScan]);

  const sub = SUBS[active];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '.86fr 1.14fr', gap: 18, alignItems: 'start' }} ref={wrapperRef}>
      {/* Three checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { n: '01', title: 'Verified buyers only', desc: 'Only verified artists, venues, DJs, and music-related organizations reach checkout. No verified badge, no buy button.' },
          { n: '02', title: 'Audio relevance scan', desc: 'The submission is scored against your advertiser profile. If it isn\'t about live music, releases, gear, or merch, it doesn\'t run.' },
          { n: '03', title: 'Listener safety', desc: 'Hate speech, harassment, explicit content outside rating, scams, and unsafe claims are flagged before a listener ever hears it.' },
          { n: '04', title: 'Copyright firewall', desc: 'Audio is fingerprinted and copy is scanned for protected song titles, lyrics, and artist name-drops you don\'t have rights to. Auto-rejected on any match.' },
          { n: '05', title: 'Reputation risk', desc: 'A final pass for misleading pricing, fake scarcity, impersonation, or off-platform resale — anything that would tarnish the scene.' },
        ].map(c => (
          <div key={c.n} style={{ display: 'flex', gap: 14, padding: '18px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, background: '#100d09' }}>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: '#ff5029', letterSpacing: '.1em', flexShrink: 0, paddingTop: 3 }}>{c.n}</span>
            <div>
              <div style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 700, fontSize: 15, letterSpacing: '-.01em' }}>{c.title}</div>
              <p style={{ fontSize: 12.5, color: '#9e9080', lineHeight: 1.5, marginTop: 6 }}>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive scanner */}
      <div style={{ background: '#100d09', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,.14)', color: '#9e9080' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff5029', animation: 'adv-pulse 2.4s ease-out infinite', flexShrink: 0 }} />
            HYPE Screen
          </span>
          <span style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 700, fontSize: 14 }}>Submission review</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-m,monospace)', fontSize: 9, color: '#5a5048', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            {scanning ? 'Scanning…' : verdict === 'none' ? 'Idle' : verdict === 'pass' ? 'Cleared' : 'Rejected'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '188px 1fr', minHeight: 330 }}>
          {/* Submission list */}
          <div style={{ borderRight: '1px solid rgba(255,255,255,.07)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SUBS.map((s, i) => (
              <button key={i} onClick={() => runScan(i)} style={{
                padding: '11px 12px', borderRadius: 9, textAlign: 'left',
                border: `1px solid ${i === active ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.07)'}`,
                background: i === active ? '#221c16' : '#1a1612',
                cursor: 'pointer', transition: 'border-color .15s',
              }}>
                <div style={{ fontFamily: 'var(--f-b,DM Sans,sans-serif)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.n}</div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 8.5, letterSpacing: '.06em', color: '#5a5048', textTransform: 'uppercase', marginTop: 3 }}>{s.k}</div>
              </button>
            ))}
          </div>

          {/* Scan stage */}
          <div style={{ padding: '18px 20px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {/* Ad preview */}
            <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 11, padding: '14px 16px', background: '#1a1612', position: 'relative', overflow: 'hidden' }}>
              {scanning && (
                <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #ff5029, transparent)', boxShadow: '0 0 14px #ff5029', animation: 'adv-scan 1.25s ease-in-out' }} />
              )}
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 8.5, letterSpacing: '.14em', textTransform: 'uppercase', color: '#5a5048' }}>{sub.tag}</div>
              <div style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 700, fontSize: 17, letterSpacing: '-.01em', marginTop: 8, lineHeight: 1.15 }}>{sub.copy}</div>
              <div style={{ fontSize: 12, color: '#9e9080', marginTop: 7, lineHeight: 1.45 }}>{sub.body}</div>
            </div>

            {/* Gate rows */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
              {sub.gates.map((g, i) => {
                const state = gateState[i] ?? 'idle';
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 10,
                    border: `1px solid ${state === 'pass' ? 'rgba(34,229,212,.25)' : state === 'fail' ? 'rgba(255,90,90,.25)' : 'rgba(255,255,255,.07)'}`,
                    background: '#1a1612', opacity: state === 'idle' ? .4 : 1, transition: 'opacity .3s, border-color .3s',
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      border: `1px solid ${state === 'pass' ? '#22e5d4' : state === 'fail' ? '#ff5a5a' : 'rgba(255,255,255,.14)'}`,
                      color: state === 'pass' ? '#22e5d4' : state === 'fail' ? '#ff5a5a' : '#5a5048',
                    }}>
                      {state === 'pass' ? <CheckIcon /> : state === 'fail' ? <CrossIcon /> : null}
                    </span>
                    <span style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--f-b,DM Sans,sans-serif)', fontSize: 12.5, fontWeight: 600 }}>{g[0]}</div>
                      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, color: '#5a5048', letterSpacing: '.02em', marginTop: 3, lineHeight: 1.4 }}>{g[1]}</div>
                    </span>
                    <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', flexShrink: 0, color: state === 'pass' ? '#22e5d4' : state === 'fail' ? '#ff5a5a' : 'transparent' }}>
                      {state === 'pass' ? 'Pass' : state === 'fail' ? 'Blocked' : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Final verdict */}
            {verdict !== 'none' && (
              <div style={{
                marginTop: 14, padding: '13px 16px', borderRadius: 11, display: 'flex', alignItems: 'center', gap: 11,
                fontFamily: 'var(--f-m,monospace)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, border: '1px solid',
                borderColor: verdict === 'pass' ? 'rgba(34,229,212,.4)' : 'rgba(255,90,90,.4)',
                background: verdict === 'pass' ? 'rgba(34,229,212,.07)' : 'rgba(255,90,90,.07)',
                color: verdict === 'pass' ? '#22e5d4' : '#ff5a5a',
              }}>
                {verdict === 'pass' ? <CheckIcon /> : <CrossIcon />}
                <span>{verdict === 'pass' ? 'Approved — ad is eligible to run' : 'Rejected — ad will not run'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── HYPE Screen upload demo (Step 03) ──────────────────────
   Explicitly an illustrative simulation — matches Advertise.dc.html's own
   framing ("Simulate a scan"). Not tied to any real submission; the actual
   AI vetting call happens when a campaign is submitted in CoverageBuilder. */
const SCAN_GATES = ['Verified buyer', 'Audio relevance', 'Listener safety', 'Copyright', 'Reputation risk'];

function ScanDemo() {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [passed, setPassed] = useState<number>(-1);
  const tokenRef = useRef(0);

  function runDemo() {
    if (phase === 'scanning') return;
    const token = ++tokenRef.current;
    setPhase('scanning');
    setPassed(-1);
    SCAN_GATES.forEach((_, i) => {
      setTimeout(() => { if (token === tokenRef.current) setPassed(i); }, 700 + i * 650);
    });
    setTimeout(() => { if (token === tokenRef.current) setPhase('done'); }, 700 + SCAN_GATES.length * 650 + 300);
  }

  function reset() {
    tokenRef.current++;
    setPhase('idle');
    setPassed(-1);
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', background: '#100d09', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <span style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 700, fontSize: 14, flex: 1 }}>HYPE Screen · automated ad review</span>
        <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: phase === 'done' ? '#22e5d4' : phase === 'scanning' ? '#ff5029' : '#5a5048' }}>
          {phase === 'done' ? 'Cleared · 5/5' : phase === 'scanning' ? 'Scanning…' : 'Awaiting audio'}
        </span>
      </div>

      {phase === 'idle' && (
        <div onClick={runDemo} style={{ margin: 18, border: '2px dashed rgba(255,255,255,.14)', borderRadius: 12, padding: '34px 20px', textAlign: 'center', cursor: 'pointer' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9e9080" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 5 }}>Drop your ad audio here</div>
          <div style={{ fontSize: 12, color: '#9e9080' }}>MP3 / WAV / AAC · 15–60s · audio only, no video</div>
          <div className="adv-btn-solid" style={{ display: 'inline-flex', marginTop: 14 }}>Simulate a scan</div>
        </div>
      )}

      {phase !== 'idle' && (
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SCAN_GATES.map((g, i) => {
            const state = passed >= i ? 'pass' : 'wait';
            return (
              <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: state === 'pass' ? 'rgba(34,229,212,.1)' : 'rgba(255,255,255,.03)', border: `1px solid ${state === 'pass' ? 'rgba(34,229,212,.25)' : 'rgba(255,255,255,.08)'}`, transition: 'all .3s' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: state === 'pass' ? '#22e5d4' : 'transparent', border: state === 'pass' ? 'none' : '2px solid rgba(255,255,255,.18)' }} />
                <span style={{ flex: 1, fontSize: 12, color: state === 'pass' ? '#f0ebe5' : '#9e9080' }}>Gate {i + 1} — {g}</span>
                <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: state === 'pass' ? '#22e5d4' : '#5a5048' }}>{state === 'pass' ? 'PASS' : '…'}</span>
              </div>
            );
          })}

          {phase === 'done' && (
            <div style={{ marginTop: 6, padding: '13px 16px', borderRadius: 10, background: 'rgba(34,229,212,.1)', border: '1px solid rgba(34,229,212,.3)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 15, color: '#22e5d4', marginBottom: 3 }}>✓ CLEARED — checkout unlocked</div>
              <div style={{ fontSize: 12, color: '#9e9080' }}>Verified buyers go straight to payment. Your spot starts running the moment the charge clears.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                <a href="#build" className="adv-btn-solid">Buy this campaign →</a>
                <button onClick={reset} className="adv-btn-ghost" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#5a5048', textDecoration: 'underline' }}>Run another scan</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 18px', borderTop: '1px solid rgba(255,255,255,.06)', fontFamily: 'var(--f-m,monospace)', fontSize: 9, color: '#5a5048', letterSpacing: '.06em' }}>
        <span>Median scan time · 41 seconds</span>
        <span>Fails are refunded automatically</span>
      </div>
    </div>
  );
}

/* ── Hero meta counter ───────────────────────────────────── */
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let v = 0;
    const step = target / 40;
    const t = setInterval(() => {
      v += step;
      if (v >= target) { v = target; clearInterval(t); }
      setVal(Math.round(v));
    }, 28);
    return () => clearInterval(t);
  }, [target]);
  return <>{suffix === '%' ? val + suffix : fmt(val)}</>;
}

/* ── Main page ───────────────────────────────────────────── */
export function AdvertisePage({ stats }: { stats: AdvertisePageStats }) {
  const eyebrow = (text: string, accent = true): React.CSSProperties => ({
    fontFamily: 'var(--f-m,monospace)', fontSize: 10, letterSpacing: '.2em', color: accent ? '#ff5029' : '#5a5048',
    textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 9,
  });

  return (
    <>
      <style>{`
        @keyframes adv-pulse { 0%{ box-shadow:0 0 0 0 currentColor } 70%{ box-shadow:0 0 0 6px transparent } 100%{ box-shadow:0 0 0 0 transparent } }
        @keyframes adv-rowIn { from{ opacity:0; transform:translateY(-10px) } to{ opacity:1; transform:none } }
        @keyframes adv-scan { 0%{ opacity:1; top:0 } 100%{ opacity:1; top:100% } }
        .adv-btn-solid { background:#ff5029; color:#0a0805; display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:var(--f-m,monospace); font-weight:600; font-size:11.5px; letter-spacing:.06em; padding:13px 22px; border-radius:9px; cursor:pointer; transition:filter .15s; text-decoration:none; border:none; white-space:nowrap }
        .adv-btn-solid:hover { filter:brightness(1.08) }
        .adv-btn-ghost { border:1px solid rgba(255,255,255,.14); color:#f0ebe5; display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:var(--f-m,monospace); font-weight:600; font-size:11.5px; letter-spacing:.06em; padding:13px 22px; border-radius:9px; cursor:pointer; transition:background .15s, border-color .15s; text-decoration:none; white-space:nowrap; background:none }
        .adv-btn-ghost:hover { background:rgba(255,255,255,.05); border-color:#9e9080 }
        .adv-btn-sm { padding:9px 15px !important; font-size:10.5px !important }
        @media (max-width:1040px) {
          .adv-hero-grid, .adv-builder, .adv-guard, .adv-paths, .adv-trans { grid-template-columns:1fr !important }
          .adv-hero-title { font-size:52px !important }
        }
        @media (max-width:480px) {
          .adv-dot-grid { grid-template-columns:repeat(8, 1fr) !important }
        }
      `}</style>

      {/* Hero */}
      <header id="top" style={{ position: 'relative', padding: '40px 0 84px', overflow: 'hidden' }}>
        <div style={{ content: '', position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 1100, height: 680, background: 'radial-gradient(ellipse at center, rgba(255,80,41,.10), transparent 62%)', pointerEvents: 'none' }} />
        <div className="adv-hero-grid" style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '0 40px', display: 'grid', gridTemplateColumns: '1.18fr .92fr', gap: 54, alignItems: 'center', position: 'relative' }}>
          <div>
            <span style={{ ...eyebrow(''), display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: '#ff5029' }} />
              Advertise on iHYPE
            </span>
            <h1 className="adv-hero-title" style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 68, lineHeight: .96, letterSpacing: '-.035em', margin: '20px 0 0' }}>
              Put your music<br />in front of the<br />people who <em style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontWeight: 400, color: '#9e9080', letterSpacing: '-.01em' }}>dig deepest.</em>
            </h1>
            <p style={{ fontSize: 16, color: '#9e9080', lineHeight: 1.6, maxWidth: '46ch', marginTop: 22 }}>
              Buy reach by the spot — <b style={{ color: '#f0ebe5', fontWeight: 600 }}>local to global</b>, by the day. Every ad is screened by AI before it runs: <b style={{ color: '#f0ebe5', fontWeight: 600 }}>music only, no copyrighted material, no name-drops.</b> One operator, one rulebook, zero junk in the feed.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
              <a href="#build" className="adv-btn-solid">Build a campaign →</a>
              <a href="#guard" className="adv-btn-ghost">See how vetting works</a>
            </div>
            <div style={{ display: 'flex', gap: 26, marginTop: 34, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              {[
                { v: <CountUp target={stats.activeCampaigns} />, l: 'Campaigns live now' },
                { v: stats.clearedPct !== null ? <CountUp target={stats.clearedPct} suffix="%" /> : '—', l: 'Auto-cleared, no review' },
                { v: '100%', l: 'Music-related' },
              ].map(m => (
                <div key={m.l}>
                  <div style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>{m.v}</div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.12em', color: '#5a5048', textTransform: 'uppercase', marginTop: 5 }}>{m.l}</div>
                </div>
              ))}
            </div>
          </div>
          <LiveTicker />
        </div>
      </header>

      {/* Coverage Builder */}
      <section id="build" style={{ position: 'relative', padding: '88px 0', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ maxWidth: 680, marginBottom: 40 }}>
            <span style={{ ...eyebrow(''), display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 22, height: 1, background: '#ff5029', opacity: .6 }} />Step 01 · Build
            </span>
            <h2 style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 38, letterSpacing: '-.03em', lineHeight: 1.02, margin: '14px 0 0' }}>
              Pick your <em style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontWeight: 400, color: '#ff5029' }}>reach.</em> Pick your <em style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontWeight: 400, color: '#ff5029' }}>volume.</em>
            </h2>
            <p style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontSize: 19, color: '#9e9080', lineHeight: 1.4, marginTop: 14, maxWidth: '58ch' }}>
              Coverage scales from your block to the whole platform. Spots are impressions placed across discovery, charts, and seed feeds — priced per day, billed per spot.
            </p>
          </div>
          <div className="adv-builder">
            <CoverageBuilder />
          </div>
        </div>
      </section>

      {/* AI Guardrails */}
      <section id="guard" style={{ position: 'relative', padding: '88px 0', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ maxWidth: 680, marginBottom: 40 }}>
            <span style={{ ...eyebrow(''), display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 22, height: 1, background: '#ff5029', opacity: .6 }} />Step 02 · The screen
            </span>
            <h2 style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 38, letterSpacing: '-.03em', lineHeight: 1.02, margin: '14px 0 0' }}>
              Every ad clears <em style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontWeight: 400, color: '#ff5029' }}>five gates</em> before a single listener sees it.
            </h2>
            <p style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontSize: 19, color: '#9e9080', lineHeight: 1.4, marginTop: 14, maxWidth: '58ch' }}>
              No human review queue. iHYPE runs on one operator — HYPE Screen scans the buyer, the copy, and the submission itself. Approval is instant when every gate passes.
            </p>
          </div>
          <div className="adv-guard">
            <AIScanner />
          </div>
        </div>
      </section>

      {/* HYPE Screen — upload & scan demo */}
      <section id="scan" style={{ position: 'relative', padding: '88px 0', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto 40px', textAlign: 'center' }}>
            <span style={{ ...eyebrow(''), display: 'inline-flex', alignItems: 'center', gap: 9, justifyContent: 'center' }}>
              <span style={{ width: 22, height: 1, background: '#ff5029', opacity: .6 }} />Step 03 · Upload &amp; go live
            </span>
            <h2 style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 38, letterSpacing: '-.03em', lineHeight: 1.02, margin: '14px 0 0' }}>
              Drop your audio. <em style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontWeight: 400, color: '#ff5029' }}>HYPE Screen</em> does the rest.
            </h2>
            <p style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontSize: 19, color: '#9e9080', lineHeight: 1.4, marginTop: 14, maxWidth: '58ch', marginLeft: 'auto', marginRight: 'auto' }}>
              Try the scanner below. When every gate passes, checkout unlocks instantly — no sales call, no review queue.
            </p>
          </div>
          <ScanDemo />
          <p style={{ maxWidth: 640, margin: '22px auto 0', textAlign: 'center', fontSize: 12, color: '#5a5048', lineHeight: 1.7 }}>
            Purchasing is available exclusively to verified artists, venues, DJs, and music-related organizations. Rejected spots are never heard by listeners and are refunded in full.
          </p>
        </div>
      </section>

      {/* Two paths */}
      <section id="paths" style={{ position: 'relative', padding: '88px 0', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ maxWidth: 680, marginBottom: 40 }}>
            <span style={{ ...eyebrow(''), display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 22, height: 1, background: '#ff5029', opacity: .6 }} />Step 04 · Who's buying
            </span>
            <h2 style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 38, letterSpacing: '-.03em', lineHeight: 1.02, margin: '14px 0 0' }}>
              Two ways in. <em style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontWeight: 400, color: '#ff5029' }}>Same screen</em> for both.
            </h2>
            <p style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontSize: 19, color: '#9e9080', lineHeight: 1.4, marginTop: 14, maxWidth: '58ch' }}>
              Whether you're on the platform already or coming from the outside, you buy the same coverage and pass the same gates.
            </p>
          </div>
          <div className="adv-paths" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {/* Members */}
            <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, background: '#100d09', padding: '28px 28px 26px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 8, color: '#ff5029' }}>
                <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: '#ff5029' }} />Members
              </span>
              <h3 style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', marginTop: 16, lineHeight: 1.05 }}>Artists, venues<br />&amp; promoters</h3>
              <p style={{ fontSize: 13.5, color: '#9e9080', lineHeight: 1.55, marginTop: 12 }}>Already part of iHYPE? Buy coverage straight from your dashboard. Your role is pre-verified, so the buyer-vetting gate clears instantly — you go right to creative review.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                {[{ c: '#b983ff', l: 'Artist' }, { c: '#22e5d4', l: 'Venue' }, { c: '#ff3e9a', l: 'Promoter' }].map(r => (
                  <span key={r.l} style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, letterSpacing: '.06em', padding: '7px 12px', borderRadius: 99, border: `1px solid color-mix(in srgb, ${r.c} 40%, transparent)`, display: 'inline-flex', alignItems: 'center', gap: 7, color: r.c }}>
                    <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: r.c }} />{r.l}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[['Instant eligibility.', 'Role verification carries over — no separate application.'], ['Promote your own catalog.', "Your releases and shows are pre-cleared for copyright."], ['Referral reach.', 'Fans with a referral link can co-fund coverage for artists they back.']].map(([b, t]) => (
                  <div key={b} style={{ display: 'flex', gap: 11, fontSize: 12.5, color: '#9e9080', lineHeight: 1.45 }}>
                    <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: '#ff5029', marginTop: 6, flexShrink: 0 }} />
                    <span><span style={{ color: '#f0ebe5', fontWeight: 600 }}>{b}</span> {t}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: '#5a5048', letterSpacing: '.04em', marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: '#7fb3ff' }} />
                Referral-funded spots split billing across backers automatically.
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 22 }}>
                <a href="#build" className="adv-btn-solid">Buy from dashboard →</a>
              </div>
            </div>

            {/* 3rd party */}
            <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, background: '#100d09', padding: '28px 28px 26px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 8, color: '#7fb3ff' }}>
                <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: '#7fb3ff' }} />3rd-Party Accounts
              </span>
              <h3 style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', marginTop: 16, lineHeight: 1.05 }}>Music businesses<br />&amp; suppliers</h3>
              <p style={{ fontSize: 13.5, color: '#9e9080', lineHeight: 1.55, marginTop: 12 }}>Not an artist, but you serve them? Music stores, live-production companies, and merch providers open a 3rd-party account to control their own placements — fully self-serve.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                {['Music stores', 'Live production', 'Merch & print', 'Instruments & gear'].map(l => (
                  <span key={l} style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, letterSpacing: '.06em', padding: '7px 12px', borderRadius: 99, border: '1px solid rgba(255,255,255,.14)', color: '#9e9080' }}>{l}</span>
                ))}
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[['Self-serve console.', 'Manage budgets, creatives, and schedules from one account.', '#7fb3ff'], ['Business verification.', "A one-time check confirms you're genuinely music-adjacent.", '#7fb3ff'], ['Same firewall applies.', 'No borrowed songs, no unlicensed artist names — ever.', '#7fb3ff']].map(([b, t, c]) => (
                  <div key={b} style={{ display: 'flex', gap: 11, fontSize: 12.5, color: '#9e9080', lineHeight: 1.45 }}>
                    <span style={{ display: 'inline-block', width: '.55em', height: '.55em', borderRadius: '50%', background: c, marginTop: 6, flexShrink: 0 }} />
                    <span><span style={{ color: '#f0ebe5', fontWeight: 600 }}>{b}</span> {t}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-start', gap: 11, padding: '14px 16px', border: '1px solid rgba(255,90,90,.25)', borderRadius: 12, background: 'rgba(255,90,90,.05)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" stroke="#ff5a5a" strokeWidth="1.6"/><path d="M9 9l6 6M15 9l-6 6" stroke="#ff5a5a" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#ff5a5a' }}>Auto-rejected</div>
                  <div style={{ fontSize: 12, color: '#9e9080', lineHeight: 1.5, marginTop: 5 }}>Non-musical goods, dropshipping, financial products, and anything unrelated to music never reach a listener.</div>
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 22 }}>
                <a href="#build" className="adv-btn-ghost">Open a 3rd-party account →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section id="trust" style={{ position: 'relative', padding: '88px 0', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ maxWidth: 680, marginBottom: 8 }}>
            <span style={{ ...eyebrow(''), display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 22, height: 1, background: '#ff5029', opacity: .6 }} />The co-op promise
            </span>
            <h2 style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 38, letterSpacing: '-.03em', lineHeight: 1.02, margin: '14px 0 0' }}>
              Ad money feeds the <em style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontWeight: 400, color: '#ff5029' }}>artists</em>, not a feed.
            </h2>
          </div>
          <div className="adv-trans" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 40, alignItems: 'center', marginTop: 8 }}>
            <p style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontSize: 26, lineHeight: 1.35, color: '#9e9080', maxWidth: '22ch' }}>
              iHYPE is run by one director and a lot of automation — so almost every dollar of ad spend <b style={{ fontFamily: 'DM Sans,sans-serif', fontStyle: 'normal', fontWeight: 600, color: '#ff5029' }}>goes back into the music</b>, not overhead.
            </p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}>
              {[{ lb: 'To artists & payouts', w: '72%', color: '#ff5029', pct: '72%' }, { lb: 'Platform & hosting', w: '18%', color: '#f0ebe5', pct: '18%' }, { lb: 'Moderation & AI screen', w: '10%', color: '#9e9080', pct: '10%' }].map(r => (
                <div key={r.lb} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5a5048', width: 150 }}>{r.lb}</span>
                  <span style={{ flex: 1, height: 9, borderRadius: 99, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                    <i style={{ display: 'block', height: '100%', width: r.w, background: r.color, borderRadius: 99 }} />
                  </span>
                  <span style={{ fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800, fontSize: 19, letterSpacing: '-.02em', width: 54, textAlign: 'right', color: r.color }}>{r.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.07)', padding: '46px 0 40px', background: '#0a0805', color: '#f0ebe5' }}>
        <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '0 40px', display: 'flex', alignItems: 'flex-start', gap: 40 }}>
          <div>
            <Wordmark />
            <p style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', fontSize: 15, color: '#9e9080', marginTop: 14, maxWidth: '34ch', lineHeight: 1.4 }}>
              A music co-op where the ads are about music — and a machine makes sure of it.
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 60 }}>
            <div>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5a5048', marginBottom: 14 }}>Advertise</div>
              {[['Build a campaign', '#build'], ['How vetting works', '#guard'], ['3rd-party accounts', '#paths'], ['Where money goes', '#trust']].map(([l, h]) => (
                <a key={l} href={h} style={{ display: 'block', fontSize: 13, color: '#9e9080', padding: '5px 0', textDecoration: 'none', transition: 'color .15s' }}>{l}</a>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5a5048', marginBottom: 14 }}>Platform</div>
              {['Discover', 'Charts', 'Seeds', 'For Artists'].map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 13, color: '#9e9080', padding: '5px 0', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
        <div style={{ width: '100%', maxWidth: 1180, margin: '28px auto 0', padding: '20px 40px 0', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: '#3a342e', letterSpacing: '.04em' }}>
          <span>© 2026 iHYPE Music Co-op · Operated under one roof</span>
          <span>Ad policy v3.1 · Copyright firewall enabled</span>
        </div>
      </footer>
    </>
  );
}
