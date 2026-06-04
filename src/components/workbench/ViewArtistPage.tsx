'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WorkbenchData } from '@/types/workbench';
import { ArtistMediaUploadManager } from '@/components/ArtistMediaUploadManager';

/* ── types ───────────────────────────────────────────────── */
type CkMode = 'page' | 'insights' | 'tour' | 'release' | 'library' | 'presskit';
type Device = 'desktop' | 'mobile';

interface Msg { side: 'me' | 'ai'; html: string; applied?: string[]; }
interface PageVars {
  '--p-bg': string; '--p-surface': string; '--p-ink': string; '--p-ink2': string;
  '--p-accent': string; '--p-accent2': string; '--p-line': string;
  '--p-display': string; '--p-radius': string; '--p-hero-url': string;
}

const DEFAULT_VARS: PageVars = {
  '--p-bg': '#0e0b09', '--p-surface': '#181310', '--p-ink': '#f4efe9',
  '--p-ink2': '#9c9082', '--p-accent': '#ff5029', '--p-accent2': '#ff3e9a',
  '--p-line': 'rgba(255,255,255,.07)', '--p-display': '"Syne",sans-serif', '--p-radius': '12px',
  '--p-hero-url': '',
};

const GENRE_PATTERNS: [RegExp, string][] = [
  [/\bpunk|hardcore|thrash|grunge\b/, 'punk'],
  [/\bjazz|blues|soul|bebop\b/, 'jazz'],
  [/\bhip.?hop|rap|trap|drill\b/, 'hip-hop'],
  [/\belectronic|techno|house|rave|edm|synth\b/, 'electronic'],
  [/\bfolk|country|americana|bluegrass\b/, 'folk'],
  [/\bindierock|indie.rock\b/, 'indie'],
  [/\bmetal|doom|sludge|death.metal\b/, 'metal'],
  [/\bclassical|orchestra|chamber\b/, 'classical'],
  [/\brnb|r&b|neo.soul\b/, 'rnb'],
];

/* ── AI command interpreter ──────────────────────────────── */
function applyCommand(text: string, vars: PageVars): { reply: string; applied: string[]; newVars: PageVars; detectedGenre: string } {
  const t = text.toLowerCase();
  const v = { ...vars };
  const applied: string[] = [];
  const set = (k: keyof PageVars, val: string) => { v[k] = val; };

  if (/\b(dark|darker|midnight|moody|night)\b/.test(t)) {
    set('--p-bg', '#070605'); set('--p-surface', '#121009');
    set('--p-ink', '#f4efe9'); set('--p-ink2', '#9c9082');
    applied.push('Mood → midnight');
  }
  if (/\b(light|bright|paper|cream|airy)\b/.test(t)) {
    set('--p-bg', '#f6f0e6'); set('--p-surface', '#ede5d6');
    set('--p-ink', '#1a1612'); set('--p-ink2', '#6b6056');
    set('--p-line', 'rgba(0,0,0,.1)');
    applied.push('Mood → paper');
  }
  if (/\bwarm/.test(t)) { set('--p-bg', '#120c08'); set('--p-surface', '#1d140d'); applied.push('Tone → warmer'); }
  if (/\bcool|cold|blue tone/.test(t)) { set('--p-bg', '#080a0d'); set('--p-surface', '#101620'); applied.push('Tone → cooler'); }

  const genreThemes: Record<string, Partial<PageVars>> = {
    punk:       { '--p-bg': '#0c0805', '--p-surface': '#1a110a', '--p-accent': '#ff5029', '--p-accent2': '#ffb84a', '--p-radius': '3px' },
    jazz:       { '--p-bg': '#080710', '--p-surface': '#120f1e', '--p-accent': '#b983ff', '--p-accent2': '#ff3e9a', '--p-display': '"Instrument Serif",serif' },
    'hip-hop':  { '--p-bg': '#060606', '--p-surface': '#101010', '--p-accent': '#ffb84a', '--p-accent2': '#ff5029', '--p-radius': '6px' },
    electronic: { '--p-bg': '#07060f', '--p-surface': '#120f24', '--p-accent': '#22e5d4', '--p-accent2': '#ff3e9a', '--p-radius': '4px' },
    folk:       { '--p-bg': '#f4ece0', '--p-surface': '#fbf6ee', '--p-ink': '#211a12', '--p-ink2': '#6f5f4a', '--p-accent': '#c2451f', '--p-line': 'rgba(0,0,0,.1)', '--p-display': '"Instrument Serif",serif' },
    metal:      { '--p-bg': '#050505', '--p-surface': '#0e0e0e', '--p-accent': '#e8e8ea', '--p-accent2': '#ff5029', '--p-radius': '2px' },
    classical:  { '--p-bg': '#f9f5ef', '--p-surface': '#ffffff', '--p-ink': '#1a1612', '--p-ink2': '#6b6056', '--p-accent': '#8b4513', '--p-line': 'rgba(0,0,0,.08)', '--p-display': '"Instrument Serif",serif' },
    rnb:        { '--p-bg': '#0a0812', '--p-surface': '#151020', '--p-accent': '#ff3e9a', '--p-accent2': '#b983ff' },
    indie:      { '--p-bg': '#0e0b0a', '--p-surface': '#181410', '--p-accent': '#5b8dff', '--p-accent2': '#22e5d4' },
  };
  let detectedGenre = '';
  for (const [re, g] of GENRE_PATTERNS) {
    if (re.test(t)) {
      detectedGenre = g;
      const gt = genreThemes[g];
      if (gt) { Object.entries(gt).forEach(([k, val]) => { v[k as keyof PageVars] = val; }); applied.push(`Scene → ${g}`); }
      break;
    }
  }

  const colors: Record<string, string> = {
    purple: '#b983ff', teal: '#22e5d4', pink: '#ff3e9a', blue: '#7fb3ff',
    amber: '#ffb84a', gold: '#ffb84a', green: '#5fd38a', orange: '#ff5029', red: '#ff5029', lime: '#a6e22e',
  };
  for (const c in colors) {
    if (new RegExp('\\b' + c + '\\b').test(t)) {
      set('--p-accent', colors[c]); applied.push('Accent → ' + c); break;
    }
  }
  if (/\bpop|punch|vivid|bold colou?r|loud/.test(t)) {
    set('--p-accent', '#ff5029'); set('--p-accent2', '#ff3e9a');
    applied.push('Accent → high-energy');
  }

  if (/\bserif|elegant|classic|editorial|refined/.test(t)) {
    set('--p-display', '"Instrument Serif",serif'); applied.push('Headline → serif');
  }
  if (/\bsans|modern|clean type|grotesk/.test(t)) {
    set('--p-display', '"Syne",sans-serif'); applied.push('Headline → Syne');
  }
  if (/\bround|soft corner|pill/.test(t)) { set('--p-radius', '22px'); applied.push('Corners → rounded'); }
  if (/\bsharp|square|hard edge/.test(t)) { set('--p-radius', '3px'); applied.push('Corners → sharp'); }

  let reply: string;
  if (applied.length) {
    reply = 'Done — ' + (applied.length > 1 ? applied.length + ' changes are live.' : "that's live on your page.");
  } else {
    set('--p-accent', '#ff5029');
    reply = 'I tightened the accent. Try "make it punk", "jazz mood", "purple accent", "elegant serif", or "rounder corners".';
  }
  return { reply, applied, newVars: v, detectedGenre };
}

/* ── sub-components ──────────────────────────────────────── */
function RailBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        padding: '10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(255,80,41,.12)' : 'transparent',
        color: active ? '#ff5029' : 'rgba(244,239,233,.45)',
        transition: 'all .15s', width: '100%',
      }}
    >
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</span>
    </button>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '9px 12px',
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8,
  color: 'var(--ink,#f4efe9)',
  fontFamily: 'var(--f-b,sans-serif)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

/* ── main component ──────────────────────────────────────── */
export function ViewArtistPage({ data }: { data: WorkbenchData }) {
  const [mode, setMode] = useState<CkMode>('page');
  const [device, setDevice] = useState<Device>('desktop');
  const [editOn, setEditOn] = useState(true);
  const [pageVars, setPageVars] = useState<PageVars>(DEFAULT_VARS);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showShows, setShowShows] = useState(false);
  const [showMerch, setShowMerch] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [msgs, typing]);

  const send = useCallback(async (text: string) => {
    text = text.trim();
    if (!text) return;
    setMsgs(m => [...m, { side: 'me', html: esc(text) }]);
    setInput('');
    setTyping(true);
    setGenerating(true);

    const res = applyCommand(text, pageVars);
    if (/\btour|shows?|dates|gig|concert/.test(text.toLowerCase())) {
      setShowShows(true);
      if (!res.applied.includes('Added · Tour dates')) res.applied.push('Added · Tour dates');
    }
    if (/\bmerch|shop|store|tee|vinyl/.test(text.toLowerCase())) {
      setShowMerch(true);
      if (!res.applied.includes('Added · Merch shelf')) res.applied.push('Added · Merch shelf');
    }
    if (/\badd booking|book me|contact/.test(text.toLowerCase())) {
      setShowBooking(true);
      if (!res.applied.includes('Added · Booking form')) res.applied.push('Added · Booking form');
    }

    let heroUrl = '';
    const uploadedHero = data.pageEditor?.heroImage;
    if (uploadedHero) {
      heroUrl = uploadedHero;
      if (!res.applied.some(a => a.startsWith('Hero'))) res.applied.push('Hero → your photo');
    } else if (res.detectedGenre) {
      try {
        const r = await fetch(`/api/page-hero?genre=${encodeURIComponent(res.detectedGenre)}`);
        if (r.ok) {
          const d = await r.json() as { url?: string };
          if (d.url) { heroUrl = d.url; res.applied.push('Hero → ' + res.detectedGenre + ' photo'); }
        }
      } catch { /* ignore */ }
    }

    const newVars: PageVars = { ...res.newVars, '--p-hero-url': heroUrl ? `url('${heroUrl}')` : '' };

    await new Promise(r => setTimeout(r, heroUrl ? 400 : 1100));
    setPageVars(newVars);
    setTyping(false);
    setGenerating(false);
    const chip = res.applied.length
      ? '<div style="margin-top:8px;padding:6px 10px;border-radius:6px;background:rgba(34,229,212,.08);border:1px solid rgba(34,229,212,.18);font-size:11px;color:#22e5d4;font-weight:700">✓ ' + res.applied.join(' · ') + '</div>'
      : '';
    setMsgs(m => [...m, { side: 'ai', html: esc(res.reply) + chip, applied: res.applied }]);
  }, [pageVars, data]);

  const artistSlug = 'ihype.fm/maya';
  const artistName = data.userName || 'Maya Reyes';
  const initials = artistName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const ARTIST_TABS: { k: CkMode; label: string; icon: React.ReactNode }[] = [
    { k: 'page',      label: 'Page',     icon: <IconPage /> },
    { k: 'insights',  label: 'Insights', icon: <IconInsights /> },
    { k: 'tour',      label: 'Tour',     icon: <IconTour /> },
    { k: 'release',   label: 'Release',  icon: <IconRelease /> },
    { k: 'library',   label: 'Library',  icon: <IconLibrary /> },
    { k: 'presskit',  label: 'Press Kit',icon: <IconPressKit /> },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', background: 'var(--bg,#0c0a09)', overflow: 'hidden' }}>
      {/* ── left rail (desktop) ── */}
      <div style={{
        display: isMobile ? 'none' : 'flex', flexDirection: 'column',
        background: 'var(--bg-2,#121009)', borderRight: '1px solid var(--line-2,rgba(255,255,255,.07))',
        overflow: 'hidden',
      }}>
        {/* identity */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg,#ff5029,#ff3e9a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--f-d,sans-serif)', fontSize: 13, fontWeight: 800, color: '#fff',
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 13, fontWeight: 700, color: 'var(--ink,#f4efe9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artistName}</div>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'var(--ink-3,rgba(244,239,233,.35))', marginTop: 1 }}>{artistSlug}</div>
            </div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px',
            borderRadius: 20, background: 'rgba(34,229,212,.08)', border: '1px solid rgba(34,229,212,.2)',
            fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: '#22e5d4',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22e5d4', display: 'inline-block' }} />
            Page live
          </div>
        </div>

        {/* nav */}
        <div style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          <RailBtn active={mode === 'page'} onClick={() => setMode('page')} label="Page + AI" icon={<IconPage />} />
          <RailBtn active={mode === 'insights'} onClick={() => setMode('insights')} label="Insights" icon={<IconInsights />} />
          <RailBtn active={mode === 'tour'} onClick={() => setMode('tour')} label="Tour" icon={<IconTour />} />
          <RailBtn active={mode === 'release'} onClick={() => setMode('release')} label="Release" icon={<IconRelease />} />
          <RailBtn active={mode === 'library'} onClick={() => setMode('library')} label="Library" icon={<IconLibrary />} />
          <RailBtn active={mode === 'presskit'} onClick={() => setMode('presskit')} label="Press Kit" icon={<IconPressKit />} />

          <div style={{ marginTop: 16, padding: '0 4px' }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.25)', marginBottom: 8 }}>Quick Jump</div>
            {(['Shows', 'Merch', 'Bio'] as const).map(s => (
              <div key={s} style={{
                padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--f-b,sans-serif)', fontSize: 12, color: 'rgba(244,239,233,.45)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
                onClick={() => { setMode('page'); if (s === 'Shows') setShowShows(true); if (s === 'Merch') setShowMerch(true); }}
              >
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,80,41,.5)', display: 'inline-block' }} />
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* health bar */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)' }}>Page health</span>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, color: '#22e5d4' }}>72%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '72%', background: 'linear-gradient(90deg,#22e5d4,#5fd38a)', borderRadius: 99 }} />
          </div>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.35)', marginTop: 6 }}>Add bio to reach 80%</div>
        </div>
      </div>

      {/* ── stage ── */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingBottom: isMobile ? 58 : 0, boxSizing: 'border-box' }}>

        {/* Mode: Page Editor */}
        {mode === 'page' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px' }}>
            {/* live preview */}
            <div style={{ position: 'relative', overflow: 'hidden', background: '#1a1612' }}>
              {/* toolbar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 46, zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px', background: 'rgba(14,11,9,.9)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,.06)',
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['desktop', 'mobile'] as Device[]).map(d => (
                    <button key={d} onClick={() => setDevice(d)} style={{
                      padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                      background: device === d ? 'rgba(255,80,41,.15)' : 'transparent',
                      color: device === d ? '#ff5029' : 'rgba(244,239,233,.4)',
                    }}>
                      {d === 'desktop' ? '⊞ Desktop' : '▭ Mobile'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => setShareOpen(true)} style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)',
                    background: 'transparent', color: 'rgba(244,239,233,.45)',
                    fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                    cursor: 'pointer',
                  }}>
                    ⬡ Share
                  </button>
                  <button onClick={() => setEditOn(e => !e)} style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid',
                    borderColor: editOn ? 'rgba(255,80,41,.35)' : 'rgba(255,255,255,.1)',
                    background: editOn ? 'rgba(255,80,41,.12)' : 'transparent',
                    color: editOn ? '#ff5029' : 'rgba(244,239,233,.45)',
                    fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                    cursor: 'pointer',
                  }}>
                    {editOn ? '✎ Editing' : '✎ Edit'}
                  </button>
                </div>
              </div>
              {/* public page */}
              <div style={{ position: 'absolute', inset: '46px 0 0', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: generating ? '0' : '20px', transition: 'padding .3s' }}>
                <div style={{
                  width: device === 'mobile' ? 390 : '100%', maxWidth: device === 'mobile' ? 390 : 800,
                  background: pageVars['--p-bg'],
                  fontFamily: 'system-ui,sans-serif',
                  borderRadius: device === 'mobile' ? 32 : 0,
                  overflow: 'hidden',
                  transition: 'all .4s cubic-bezier(.25,.8,.25,1)',
                  outline: generating ? '2px solid rgba(255,80,41,.5)' : 'none',
                  outlineOffset: 2,
                  minHeight: '100%',
                }}>
                  <PublicPage
                    artistName={artistName} initials={initials}
                    vars={pageVars} editOn={editOn}
                    showShows={showShows} showMerch={showMerch} showBooking={showBooking}
                  />
                </div>
              </div>
            </div>

            {/* AI chat dock */}
            <div style={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', background: 'var(--bg-2,#121009)', borderLeft: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
                <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: 'var(--ink,#f4efe9)' }}>✦ AI Editor</div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.4)', marginTop: 2 }}>Describe changes — they apply live</div>
              </div>

              {/* suggestions */}
              {msgs.length === 0 && (
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.3)', marginBottom: 8 }}>Try these</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['Make it punk', 'Jazz mood', 'Electronic rave energy', 'Make it darker & moodier', 'Purple accent', 'Add my tour dates'].map(s => (
                      <button key={s} onClick={() => send(s)} style={{
                        padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,.1)',
                        background: 'rgba(255,255,255,.04)', color: 'rgba(244,239,233,.6)',
                        fontFamily: 'var(--f-m,monospace)', fontSize: 10, cursor: 'pointer',
                        transition: 'all .15s',
                      }}>
                        &quot;{s}&quot;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* thread */}
              <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {msgs.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.side === 'me' ? 'row-reverse' : 'row' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: m.side === 'ai' ? 'rgba(255,80,41,.15)' : 'rgba(255,255,255,.08)',
                      fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 800,
                      color: m.side === 'ai' ? '#ff5029' : 'rgba(244,239,233,.6)',
                    }}>
                      {m.side === 'ai' ? '✦' : initials}
                    </div>
                    <div
                      style={{
                        maxWidth: '80%', padding: '8px 11px', borderRadius: m.side === 'ai' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                        background: m.side === 'ai' ? 'rgba(255,255,255,.05)' : 'rgba(255,80,41,.12)',
                        border: `1px solid ${m.side === 'ai' ? 'rgba(255,255,255,.07)' : 'rgba(255,80,41,.2)'}`,
                        fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, lineHeight: 1.5,
                        color: 'var(--ink,#f4efe9)',
                      }}
                      dangerouslySetInnerHTML={{ __html: m.html }}
                    />
                  </div>
                ))}
                {typing && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,80,41,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: '#ff5029' }}>✦</div>
                    <div style={{ padding: '10px 14px', borderRadius: '4px 12px 12px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map(i => <TypingDot key={i} delay={i * 160} />)}
                    </div>
                  </div>
                )}
              </div>

              {/* input */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder="Describe a change…"
                    rows={1}
                    style={{
                      flex: 1, resize: 'none', border: '1px solid rgba(255,255,255,.1)',
                      borderRadius: 10, padding: '9px 12px',
                      background: 'rgba(255,255,255,.05)', color: 'var(--ink,#f4efe9)',
                      fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, lineHeight: 1.5,
                      outline: 'none', maxHeight: 120, overflow: 'auto',
                    }}
                  />
                  <button onClick={() => send(input)} style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: input.trim() ? '#ff5029' : 'rgba(255,80,41,.2)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .15s', flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mode: Insights */}
        {mode === 'insights' && (
          <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
            <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>Insights</h2>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginBottom: 24 }}>Last 30 days · updated hourly</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
                <KpiCard label="Listens" value="2,284" delta="+14%" sub="past 30 days" color="#ff5029" />
                <KpiCard label="Finish rate" value="71%" delta="+3pts" sub="avg vs 58% norm" color="#b983ff" />
                <KpiCard label="Save rate" value="26%" delta="+5pts" sub="saves / streams" color="#22e5d4" />
                <KpiCard label="Est. payout" value="$2,460" delta="+$340" sub="this month" color="#ffb84a" />
              </div>

              <ChartSection title="Listens & Engagement" subtitle="Daily streams over the past 30 days">
                <ListensChart />
              </ChartSection>

              <ChartSection title="HYPE Sources" subtitle="Where your hype is coming from">
                <HypeSources />
              </ChartSection>

              <div style={{ background: 'rgba(255,80,41,.06)', border: '1px solid rgba(255,80,41,.15)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>✦</span>
                <div>
                  <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: '#ff5029', marginBottom: 4 }}>Trending in Milwaukee this week</div>
                  <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.6)', lineHeight: 1.5 }}>Your save rate jumped 8 pts in Milwaukee in the past 7 days — you have 410 listeners there. Consider adding a Milwaukee tour date.</div>
                </div>
              </div>

              <ChartSection title="Audience" subtitle="Top cities by listener count">
                <AudienceMap />
              </ChartSection>

              <ChartSection title="Ticket Revenue" subtitle="Sales across all platforms — past 60 days">
                <TicketRevenue />
              </ChartSection>

              <ChartSection title="Top Tracks" subtitle="Ranked by streams">
                <TopTracks />
              </ChartSection>

              <ChartSection title="Discovery Funnel" subtitle="Seed view → attended">
                <DiscoveryFunnel />
              </ChartSection>
            </div>
          </div>
        )}

        {/* Mode: Tour / Live Events */}
        {mode === 'tour' && data.profileId && (
          <TourManager profileId={data.profileId} artistName={artistName} existingShows={data.shows ?? []} />
        )}

        {/* Mode: Library — media uploads */}
        {mode === 'library' && (
          <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
            <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>Media Library</h2>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginBottom: 24 }}>Upload tracks, photos, and stems to your artist page</div>
              {data.profileId ? (
                <ArtistMediaUploadManager profileId={data.profileId} />
              ) : (
                <p style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.4)' }}>No artist profile found.</p>
              )}
            </div>
          </div>
        )}

        {/* Mode: Release Planner */}
        {mode === 'release' && (
          <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
            <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>Release Planner</h2>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginBottom: 24 }}>&quot;Westbound&quot; · Single · Dropping Jun 14</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
                <RelStat label="Pre-saves" value="284" icon="♡" color="#ff3e9a" />
                <RelStat label="Seed plays" value="1,840" icon="▷" color="#b983ff" />
                <RelStat label="Radio adds" value="3" icon="◉" color="#22e5d4" />
                <RelStat label="Est. 1st-wk" value="4,200" icon="↗" color="#ffb84a" />
              </div>

              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 14 }}>Drop Timeline</div>
              <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
                {DROP_STEPS.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i < DROP_STEPS.length - 1 ? 18 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                        background: s.state === 'done' ? 'rgba(95,211,138,.15)' : s.state === 'active' ? 'rgba(255,80,41,.15)' : 'rgba(255,255,255,.05)',
                        border: `2px solid ${s.state === 'done' ? '#5fd38a' : s.state === 'active' ? '#ff5029' : 'rgba(255,255,255,.1)'}`,
                        color: s.state === 'done' ? '#5fd38a' : s.state === 'active' ? '#ff5029' : 'rgba(244,239,233,.3)',
                      }}>
                        {s.state === 'done' ? '✓' : s.state === 'active' ? '●' : '○'}
                      </div>
                      {i < DROP_STEPS.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, marginTop: 4, background: i < DROP_STEPS.findIndex(x => x.state !== 'done') ? '#5fd38a' : 'rgba(255,255,255,.07)', borderRadius: 1 }} />}
                    </div>
                    <div style={{ paddingTop: 4 }}>
                      <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: s.state === 'pending' ? 'rgba(244,239,233,.35)' : 'var(--ink,#f4efe9)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.35)' }}>{s.note}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(185,131,255,.06)', border: '1px solid rgba(185,131,255,.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 28, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>✦</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: '#b983ff', marginBottom: 4 }}>Write your announcement copy</div>
                  <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.6)', lineHeight: 1.5, marginBottom: 12 }}>Drop your one-liner about Westbound and I&apos;ll write press blurbs, social captions, and a playlist pitch for you.</div>
                  <textarea
                    placeholder="What's the vibe? What's the story behind this single?"
                    rows={2}
                    style={{
                      width: '100%', resize: 'none', border: '1px solid rgba(185,131,255,.2)',
                      borderRadius: 8, padding: '9px 12px',
                      background: 'rgba(185,131,255,.06)', color: 'var(--ink,#f4efe9)',
                      fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, lineHeight: 1.5,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 12 }}>Release Bundle</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
                {BUNDLES.map((b, i) => (
                  <div key={b.label} style={{
                    background: i === 1 ? 'rgba(255,80,41,.08)' : 'var(--bg-2,#121009)',
                    border: `1px solid ${i === 1 ? 'rgba(255,80,41,.25)' : 'var(--line-2,rgba(255,255,255,.07))'}`,
                    borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                  }}>
                    <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: i === 1 ? '#ff5029' : 'var(--ink,#f4efe9)', marginBottom: 6 }}>{b.label}</div>
                    <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 12, color: 'rgba(244,239,233,.5)', lineHeight: 1.5 }}>{b.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 12 }}>First-Week Projections</div>
              <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '18px 22px' }}>
                {PROJECTIONS.map(p => (
                  <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 120, fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.5)', flexShrink: 0 }}>{p.label}</div>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: p.pct + '%', background: p.color, borderRadius: 99 }} />
                    </div>
                    <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: p.color, width: 60, textAlign: 'right', flexShrink: 0 }}>{p.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mode: Press Kit */}
        {mode === 'presskit' && (
          <PressKitPanel artistName={artistName} artistSlug="maya" />
        )}
      </div>

      {/* Share card modal */}
      {shareOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
          }}
          onClick={() => setShareOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* Share card */}
            <div style={{
              width: 340, borderRadius: 20, overflow: 'hidden',
              background: 'linear-gradient(135deg,#ff5029 0%,#ff3e9a 50%,#b983ff 100%)',
              padding: '2px',
            }}>
              <div style={{
                borderRadius: 18, background: '#0e0b09',
                padding: '32px 28px', textAlign: 'center',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
                  background: 'linear-gradient(135deg,#ff5029,#ff3e9a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: '#fff',
                }}>{initials}</div>
                <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 24, fontWeight: 800, color: '#f4efe9', marginBottom: 4 }}>{artistName}</div>
                <div style={{ fontFamily: 'system-ui', fontSize: 13, color: 'rgba(244,239,233,.55)', marginBottom: 20 }}>Artist · Chicago, IL · Alt-Indie</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  {[['2,284', 'Streams'], ['12', 'Shows'], ['410+', 'Fans']].map(([v, l]) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 8px' }}>
                      <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 18, fontWeight: 800, color: '#ff5029' }}>{v}</div>
                      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, color: 'rgba(244,239,233,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)', letterSpacing: '.06em' }}>ihype.fm/maya · iHYPE</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShareOpen(false)}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)',
                  background: 'transparent', color: 'rgba(244,239,233,.6)',
                  fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#ff5029', color: '#fff',
                  fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── bottom tab bar (mobile) ── */}
      {isMobile && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 58,
          display: 'flex', alignItems: 'stretch',
          background: 'rgba(10,8,5,.96)', backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,.08)',
          gridColumn: '1 / -1',
        }}>
          {ARTIST_TABS.map(t => (
            <button key={t.k} onClick={() => setMode(t.k)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, border: 'none', cursor: 'pointer', background: 'transparent',
              color: mode === t.k ? '#ff5029' : 'rgba(244,239,233,.4)',
              transition: 'color .15s',
            }}>
              <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</span>
              <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 8, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Press Kit Panel ─────────────────────────────────────── */
function PressKitPanel({ artistName, artistSlug }: { artistName: string; artistSlug: string }) {
  const [bio, setBio] = useState(`${artistName} makes late-night songs for long drives. Based in Chicago, IL, their sound blends hazy guitar work with confessional lyrics that land somewhere between indie folk and alternative pop. Their debut EP, recorded live in a basement on Western Ave, has accumulated over 2,000 streams and counting.`);
  const [riderChecks, setRiderChecks] = useState<Record<string, boolean>>({
    'PA system (min 1,000W)': true,
    'Stage monitors (x2)': true,
    'Direct box (x2)': false,
    'Drum kit (full)': false,
    'Green room access': true,
    'Merch table': true,
  });
  const [copied, setCopied] = useState(false);

  function toggleRider(key: string) {
    setRiderChecks(c => ({ ...c, [key]: !c[key] }));
  }

  function copyLink() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 4 }}>Press Kit · EPK</h2>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)' }}>Electronic Press Kit for {artistName}</div>
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#ff5029', color: '#fff',
            fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 3v12M7 14l5 5 5-5M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            DOWNLOAD EPK
          </button>
        </div>

        {/* Artist bio */}
        <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)', marginBottom: 12 }}>Artist Bio</div>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={5}
            style={{
              ...INPUT_STYLE,
              resize: 'vertical',
              lineHeight: 1.65,
              minHeight: 100,
            }}
          />
        </div>

        {/* Key stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Streams', value: '2,284', color: '#ff5029' },
            { label: 'Shows', value: '12', color: '#b983ff' },
            { label: 'Cities', value: '4', color: '#22e5d4' },
            { label: 'Avg Draw', value: '240', color: '#ffb84a' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))',
              borderRadius: 12, padding: '16px 18px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 28, fontWeight: 800, color: stat.color, lineHeight: 1, marginBottom: 6 }}>{stat.value}</div>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tech rider */}
        <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)', marginBottom: 14 }}>Tech Rider</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(riderChecks).map(([item, checked]) => (
              <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div
                  onClick={() => toggleRider(item)}
                  style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${checked ? '#22e5d4' : 'rgba(255,255,255,.2)'}`,
                    background: checked ? 'rgba(34,229,212,.15)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s', cursor: 'pointer',
                  }}
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#22e5d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: checked ? 'var(--ink,#f4efe9)' : 'rgba(244,239,233,.45)' }}>{item}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Press photos */}
        <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)' }}>Press Photos</div>
            <button style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,80,41,.3)',
              background: 'rgba(255,80,41,.08)', color: '#ff5029',
              fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            }}>
              + Add photo
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                height: 140, borderRadius: 10, border: '1px dashed rgba(255,255,255,.12)',
                background: `linear-gradient(135deg, rgba(255,80,41,${0.06 + i * 0.02}), rgba(185,131,255,${0.06 + i * 0.02}))`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(244,239,233,.25)" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.25)', letterSpacing: '.06em' }}>Photo {i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shareable link */}
        <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)', marginBottom: 10 }}>Shareable Link</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, padding: '9px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.55)',
            }}>
              ihype.fm/{artistSlug}/epk
            </div>
            <button
              onClick={copyLink}
              style={{
                padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(34,229,212,.25)',
                background: copied ? 'rgba(34,229,212,.15)' : 'rgba(34,229,212,.06)',
                color: '#22e5d4',
                fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                transition: 'all .15s', flexShrink: 0,
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Public Page Preview ─────────────────────────────────── */
function PublicPage({ artistName, initials, vars, editOn, showShows, showMerch, showBooking }: {
  artistName: string; initials: string; vars: PageVars; editOn: boolean;
  showShows: boolean; showMerch: boolean; showBooking: boolean;
}) {
  const s = vars;
  const hasHero = !!s['--p-hero-url'];
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [bookingForm, setBookingForm] = useState({ name: '', email: '', date: '', message: '' });

  function togglePlay(idx: number) {
    setPlayingIdx(p => (p === idx ? null : idx));
  }

  return (
    <div style={{ background: s['--p-bg'], color: s['--p-ink'], minHeight: '100%', fontFamily: 'system-ui,sans-serif' }}>
      {/* hero */}
      <div style={{
        padding: '48px 36px 32px', borderBottom: `1px solid ${s['--p-line']}`,
        position: 'relative', overflow: 'hidden',
        ...(hasHero ? { backgroundImage: s['--p-hero-url'], backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      }}>
        {hasHero && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,.45) 0%, ${s['--p-bg']}ee 90%)`, zIndex: 0 }} />}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: s['--p-radius'],
            background: `linear-gradient(135deg,${s['--p-accent']},${s['--p-accent2']})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: s['--p-display'], fontSize: 24, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          <div>
            <div style={{ fontFamily: s['--p-display'], fontSize: 32, fontWeight: 800, color: hasHero ? '#fff' : s['--p-ink'], lineHeight: 1.1 }}
              contentEditable={editOn} suppressContentEditableWarning>{artistName}</div>
            <div style={{ fontFamily: 'system-ui', fontSize: 14, color: hasHero ? 'rgba(255,255,255,.65)' : s['--p-ink2'], marginTop: 4 }}>Artist · Chicago, IL</div>
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'system-ui', fontSize: 15, color: hasHero ? 'rgba(255,255,255,.8)' : s['--p-ink2'], lineHeight: 1.6, maxWidth: 520 }}
            contentEditable={editOn} suppressContentEditableWarning>
            Late-night songs for long drives. New EP out now — the rest is being written in a basement on Western Ave.
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button style={{ padding: '10px 22px', borderRadius: s['--p-radius'], border: 'none', background: s['--p-accent'], color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Follow</button>
            <button style={{ padding: '10px 22px', borderRadius: s['--p-radius'], border: `1px solid ${s['--p-line']}`, background: 'transparent', color: hasHero ? 'rgba(255,255,255,.7)' : s['--p-ink2'], fontSize: 14, cursor: 'pointer' }}>Share</button>
          </div>
        </div>
      </div>

      {/* shows */}
      {showShows && (
        <div style={{ padding: '28px 36px', borderBottom: `1px solid ${s['--p-line']}` }}>
          <div style={{ fontFamily: s['--p-display'], fontSize: 20, fontWeight: 800, color: s['--p-ink'], marginBottom: 16 }}>Tour Dates</div>
          {[{ date: 'Jun 18', venue: 'Empty Bottle', city: 'Chicago, IL' }, { date: 'Jul 5', venue: 'Cactus Club', city: 'Milwaukee, WI' }, { date: 'Jul 20', venue: 'The Basement', city: 'Nashville, TN' }].map(show => (
            <div key={show.date} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: `1px solid ${s['--p-line']}` }}>
              <div style={{ width: 44, fontFamily: 'system-ui', fontSize: 13, fontWeight: 700, color: s['--p-accent'] }}>{show.date}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'system-ui', fontSize: 14, fontWeight: 600, color: s['--p-ink'] }}>{show.venue}</div>
                <div style={{ fontFamily: 'system-ui', fontSize: 12, color: s['--p-ink2'] }}>{show.city}</div>
              </div>
              <button style={{ padding: '7px 16px', borderRadius: s['--p-radius'], border: `1px solid ${s['--p-accent']}`, background: 'transparent', color: s['--p-accent'], fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Tickets</button>
            </div>
          ))}
        </div>
      )}

      {/* merch */}
      {showMerch && (
        <div style={{ padding: '28px 36px', borderBottom: `1px solid ${s['--p-line']}` }}>
          <div style={{ fontFamily: s['--p-display'], fontSize: 20, fontWeight: 800, color: s['--p-ink'], marginBottom: 16 }}>Merch</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {['Logo Tee – $32', 'Vinyl LP – $28', 'Cap – $24'].map(item => (
              <div key={item} style={{ background: s['--p-surface'], borderRadius: s['--p-radius'], padding: 14 }}>
                <div style={{ height: 80, background: `linear-gradient(135deg,${s['--p-accent']}22,${s['--p-accent2']}22)`, borderRadius: 8, marginBottom: 10 }} />
                <div style={{ fontFamily: 'system-ui', fontSize: 13, fontWeight: 600, color: s['--p-ink'] }}>{item}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* tracks with inline player */}
      <div style={{ padding: '28px 36px' }}>
        <div style={{ fontFamily: s['--p-display'], fontSize: 20, fontWeight: 800, color: s['--p-ink'], marginBottom: 16 }}>Tracks</div>
        {['Velvet Hours', 'Carmine', 'Westbound', 'North Shore'].map((track, i) => {
          const isPlaying = playingIdx === i;
          return (
            <div key={track} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: `1px solid ${s['--p-line']}` }}>
              {/* play/pause button */}
              <button
                onClick={() => togglePlay(i)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: `1px solid ${isPlaying ? s['--p-accent'] : s['--p-line']}`,
                  background: isPlaying ? `${s['--p-accent']}22` : 'transparent',
                  color: isPlaying ? s['--p-accent'] : s['--p-ink2'],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, transition: 'all .15s',
                }}
              >
                {isPlaying ? (
                  /* pulsing waveform icon when playing */
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <rect x="1" y="3" width="2" height="6" rx="1">
                      <animate attributeName="height" values="6;10;6;4;6" dur=".7s" repeatCount="indefinite" />
                      <animate attributeName="y" values="3;1;3;4;3" dur=".7s" repeatCount="indefinite" />
                    </rect>
                    <rect x="5" y="1" width="2" height="10" rx="1">
                      <animate attributeName="height" values="10;4;10;6;10" dur=".7s" repeatCount="indefinite" begin=".15s" />
                      <animate attributeName="y" values="1;4;1;3;1" dur=".7s" repeatCount="indefinite" begin=".15s" />
                    </rect>
                    <rect x="9" y="2" width="2" height="8" rx="1">
                      <animate attributeName="height" values="8;12;8;4;8" dur=".7s" repeatCount="indefinite" begin=".3s" />
                      <animate attributeName="y" values="2;0;2;4;2" dur=".7s" repeatCount="indefinite" begin=".3s" />
                    </rect>
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M2 1.5l7 3.5-7 3.5V1.5z" />
                  </svg>
                )}
              </button>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${s['--p-accent']}33,${s['--p-surface']})`, flexShrink: 0 }} />
              <div style={{ flex: 1, fontFamily: 'system-ui', fontSize: 14, fontWeight: 600, color: s['--p-ink'] }} contentEditable={editOn} suppressContentEditableWarning>{track}</div>
              <div style={{ fontFamily: 'system-ui', fontSize: 12, color: s['--p-ink2'] }}>{['3:42', '4:01', '3:58', '4:22'][i]}</div>
            </div>
          );
        })}
      </div>

      {/* booking section */}
      {showBooking && (
        <div style={{ padding: '28px 36px', borderTop: `1px solid ${s['--p-line']}` }}>
          <div style={{ fontFamily: s['--p-display'], fontSize: 20, fontWeight: 800, color: s['--p-ink'], marginBottom: 8 }}>Book for Your Event</div>
          <div style={{ fontFamily: 'system-ui', fontSize: 14, color: s['--p-ink2'], marginBottom: 20 }}>Interested in booking {artistName}? Send an inquiry below.</div>
          <div style={{ background: s['--p-surface'], borderRadius: s['--p-radius'], padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
            <input
              placeholder="Your name"
              value={bookingForm.name}
              onChange={e => setBookingForm(f => ({ ...f, name: e.target.value }))}
              style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${s['--p-line']}`, background: 'transparent', color: s['--p-ink'], fontFamily: 'system-ui', fontSize: 13, outline: 'none' }}
            />
            <input
              placeholder="Email address"
              value={bookingForm.email}
              onChange={e => setBookingForm(f => ({ ...f, email: e.target.value }))}
              style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${s['--p-line']}`, background: 'transparent', color: s['--p-ink'], fontFamily: 'system-ui', fontSize: 13, outline: 'none' }}
            />
            <input
              placeholder="Date in mind (e.g. Jul 15)"
              value={bookingForm.date}
              onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))}
              style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${s['--p-line']}`, background: 'transparent', color: s['--p-ink'], fontFamily: 'system-ui', fontSize: 13, outline: 'none' }}
            />
            <textarea
              placeholder="Your message…"
              rows={3}
              value={bookingForm.message}
              onChange={e => setBookingForm(f => ({ ...f, message: e.target.value }))}
              style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${s['--p-line']}`, background: 'transparent', color: s['--p-ink'], fontFamily: 'system-ui', fontSize: 13, outline: 'none', resize: 'none' }}
            />
            <button style={{ padding: '11px 22px', borderRadius: s['--p-radius'], border: 'none', background: s['--p-accent'], color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Send Inquiry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Insights sub-components ─────────────────────────────── */
function KpiCard({ label, value, delta, sub, color }: { label: string; value: string; delta: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 28, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, color: '#5fd38a' }}>{delta}</span>
        <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.3)' }}>{sub}</span>
      </div>
    </div>
  );
}

function ChartSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 15, fontWeight: 700, color: 'var(--ink,#f4efe9)' }}>{title}</div>
        {subtitle && <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.35)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function ListensChart() {
  const pts = [40, 55, 48, 72, 68, 90, 85, 110, 95, 120, 105, 130, 115, 140, 125, 155, 140, 170, 145, 180, 160, 190, 175, 200, 185, 210, 195, 220, 205, 230];
  const max = Math.max(...pts);
  const h = 80; const w = 600;
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} style={{ width: '100%', height: 100 }}>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff5029" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ff5029" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d + ` L${w},${h} L0,${h} Z`} fill="url(#lg1)" />
      <path d={d} fill="none" stroke="#ff5029" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function HypeSources() {
  const items = [
    { label: 'Direct plays', pct: 42, color: '#ff5029' },
    { label: 'Seed discovery', pct: 28, color: '#b983ff' },
    { label: 'Shared links', pct: 18, color: '#22e5d4' },
    { label: 'Radio', pct: 12, color: '#ffb84a' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 100, fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.5)', flexShrink: 0 }}>{item.label}</div>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: item.pct + '%', background: item.color, borderRadius: 99 }} />
          </div>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, color: item.color, width: 36, textAlign: 'right', flexShrink: 0 }}>{item.pct}%</div>
        </div>
      ))}
    </div>
  );
}

function AudienceMap() {
  const cities = [
    { city: 'Chicago', count: 1120, x: 52, y: 42 },
    { city: 'Milwaukee', count: 410, x: 54, y: 34 },
    { city: 'Detroit', count: 360, x: 68, y: 38 },
    { city: 'Cleveland', count: 280, x: 72, y: 44 },
    { city: 'Indianapolis', count: 190, x: 62, y: 52 },
  ];
  const max = Math.max(...cities.map(c => c.count));
  return (
    <div style={{ display: 'flex', gap: 20 }}>
      <div style={{ flex: '0 0 220px', position: 'relative', height: 120, background: 'rgba(255,255,255,.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,.05)', overflow: 'hidden' }}>
        {cities.map(c => (
          <div key={c.city} style={{
            position: 'absolute', left: c.x + '%', top: c.y + '%',
            width: Math.max(6, (c.count / max) * 18), height: Math.max(6, (c.count / max) * 18),
            borderRadius: '50%', background: '#ff5029', opacity: 0.6,
            transform: 'translate(-50%, -50%)',
          }} title={c.city} />
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cities.map(c => (
          <div key={c.city} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 70, fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.5)', flexShrink: 0 }}>{c.city}</div>
            <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: (c.count / max * 100) + '%', background: 'linear-gradient(90deg,#ff5029,#ff3e9a)', borderRadius: 99 }} />
            </div>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, color: 'var(--ink,#f4efe9)', width: 40, textAlign: 'right', flexShrink: 0 }}>{c.count.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketRevenue() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 28, fontWeight: 800, color: '#ffb84a' }}>$4,280</div>
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.4)' }}>gross, 3 shows</div>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: '45%', background: '#ff5029' }} title="Door" />
        <div style={{ width: '45%', background: '#b983ff' }} title="Advance" />
        <div style={{ width: '10%', background: '#22e5d4' }} title="Comp" />
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {[{ label: 'Door', pct: '45%', color: '#ff5029' }, { label: 'Advance', pct: '45%', color: '#b983ff' }, { label: 'Comp', pct: '10%', color: '#22e5d4' }].map(t => (
          <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color }} />
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.5)' }}>{t.label} {t.pct}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopTracks() {
  const tracks = [
    { title: 'Velvet Hours', streams: 820, saves: 214 },
    { title: 'Carmine', streams: 610, saves: 178 },
    { title: 'Westbound', streams: 490, saves: 142 },
    { title: 'North Shore', streams: 364, saves: 98 },
  ];
  const max = tracks[0].streams;
  return (
    <div>
      {tracks.map((t, i) => (
        <div key={t.title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < tracks.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
          <div style={{ width: 18, fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.3)', textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1, fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'var(--ink,#f4efe9)' }}>{t.title}</div>
          <div style={{ width: 100, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ height: '100%', width: (t.streams / max * 100) + '%', background: '#ff5029', borderRadius: 99 }} />
          </div>
          <div style={{ width: 44, fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, color: 'var(--ink,#f4efe9)', textAlign: 'right', flexShrink: 0 }}>{t.streams}</div>
          <div style={{ width: 44, fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.4)', textAlign: 'right', flexShrink: 0 }}>♡ {t.saves}</div>
        </div>
      ))}
    </div>
  );
}

function DiscoveryFunnel() {
  const steps = [
    { label: 'Seed views', value: 18400, color: '#ff5029' },
    { label: 'Saved', value: 4780, color: '#b983ff' },
    { label: 'Tickets sold', value: 612, color: '#22e5d4' },
    { label: 'Attended', value: 540, color: '#5fd38a' },
  ];
  const max = steps[0].value;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 88, fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.5)', flexShrink: 0 }}>{s.label}</div>
          <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,.04)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (s.value / max * 100) + '%', background: s.color, borderRadius: 4, opacity: 0.8 }} />
          </div>
          <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 13, fontWeight: 700, color: s.color, width: 52, textAlign: 'right', flexShrink: 0 }}>{s.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Tour sub-components ─────────────────────────────────── */
type LiveShow = {
  id: string; name: string; venue: string; date: string; time: string;
  hype: number; sold: number; capacity: number; price: number;
  status: 'TONIGHT' | 'THIS WEEK' | 'UPCOMING' | 'NEAR SOLD' | 'ENDED';
};

type TourView = 'list' | 'create';

function ShowStatusChip({ status }: { status: LiveShow['status'] }) {
  const cfg: Record<LiveShow['status'], { label: string; color: string; bg: string }> = {
    TONIGHT:   { label: 'Tonight',   color: '#ff5029', bg: 'rgba(255,80,41,.12)' },
    'THIS WEEK': { label: 'This week', color: '#ffb84a', bg: 'rgba(255,184,74,.1)' },
    UPCOMING:  { label: 'Upcoming',  color: 'rgba(244,239,233,.5)', bg: 'rgba(255,255,255,.05)' },
    'NEAR SOLD': { label: 'Near sold', color: '#5fd38a', bg: 'rgba(95,211,138,.1)' },
    ENDED:     { label: 'Ended',     color: 'rgba(244,239,233,.3)', bg: 'rgba(255,255,255,.04)' },
  };
  const c = cfg[status];
  return (
    <span style={{ padding: '3px 9px', borderRadius: 20, fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c.color, background: c.bg }}>
      {c.label}
    </span>
  );
}

function TourManager({ profileId, artistName, existingShows }: { profileId: string; artistName: string; existingShows: LiveShow[] }) {
  const [view, setView] = useState<TourView>('list');
  const [shows, setShows] = useState<LiveShow[]>(existingShows.filter(s => s.status !== 'ENDED'));
  const [pastShows] = useState<LiveShow[]>(existingShows.filter(s => s.status === 'ENDED'));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [dateVal, setDateVal] = useState('');
  const [timeVal, setTimeVal] = useState('20:00');
  const [ticketed, setTicketed] = useState(false);
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [description, setDescription] = useState('');
  const [asDraft, setAsDraft] = useState(false);

  function resetForm() {
    setTitle(''); setVenue(''); setCity(''); setDateVal(''); setTimeVal('20:00');
    setTicketed(false); setPrice(''); setCapacity(''); setDescription(''); setAsDraft(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !venue.trim() || !dateVal || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const startsAt = new Date(`${dateVal}T${timeVal}:00`).toISOString();
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        isRadioShow: false,
        status: asDraft ? 'DRAFT' : 'SCHEDULED',
        startsAt,
        headlinerProfileId: profileId,
        isTicketed: ticketed,
        ticketPriceCents: ticketed && price ? Math.round(parseFloat(price) * 100) : 0,
        ticketCapacity: ticketed && capacity ? parseInt(capacity, 10) : null,
        venueText: `${venue.trim()}${city.trim() ? ', ' + city.trim() : ''}`,
      };
      const res = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not create show.');
      const d = new Date(`${dateVal}T${timeVal}:00`);
      const now = new Date();
      const diff = d.getTime() - now.getTime();
      const status: LiveShow['status'] = diff < 86400000 && diff > 0 ? 'TONIGHT' : diff < 7 * 86400000 && diff > 0 ? 'THIS WEEK' : 'UPCOMING';
      setShows(prev => [{
        id: json.id ?? Math.random().toString(36).slice(2),
        name: title.trim(),
        venue: venue.trim(),
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        hype: 0, sold: 0,
        capacity: ticketed && capacity ? parseInt(capacity, 10) : 0,
        price: ticketed && price ? parseFloat(price) : 0,
        status,
      }, ...prev]);
      resetForm();
      setView('list');
      setNotice({ text: asDraft ? 'Saved as draft.' : 'Show scheduled and live on your page.', ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Failed.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  const upcomingCount = shows.length;
  const totalHype = shows.reduce((s, x) => s + x.hype, 0);
  const totalSold = shows.reduce((s, x) => s + x.sold, 0);

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 4 }}>Tour & Events</h2>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)' }}>
              {upcomingCount} upcoming · {totalHype} hype · {totalSold} tickets sold
            </div>
          </div>
          {view === 'list' ? (
            <button
              onClick={() => { setNotice(null); setView('create'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#ff5029', color: '#fff',
                fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
              ADD DATE
            </button>
          ) : (
            <button
              onClick={() => { resetForm(); setNotice(null); setView('list'); }}
              style={{
                padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)',
                background: 'transparent', color: 'rgba(244,239,233,.5)',
                fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {notice && (
          <div style={{
            marginBottom: 20, padding: '10px 16px', borderRadius: 8,
            background: notice.ok ? 'rgba(95,211,138,.08)' : 'rgba(255,80,41,.08)',
            border: `1px solid ${notice.ok ? 'rgba(95,211,138,.2)' : 'rgba(255,80,41,.2)'}`,
            fontFamily: 'var(--f-b,sans-serif)', fontSize: 13,
            color: notice.ok ? '#5fd38a' : '#ff5029',
          }}>
            {notice.text}
          </div>
        )}

        {view === 'create' && (
          <form onSubmit={submit} style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 16, padding: '24px 28px', marginBottom: 28 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 18 }}>New Event</div>

            <div style={{ display: 'grid', gap: 14 }}>
              <input style={INPUT_STYLE} placeholder="Event title *" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={INPUT_STYLE} placeholder="Venue name *" value={venue} onChange={e => setVenue(e.target.value)} maxLength={100} required />
                <input style={INPUT_STYLE} placeholder="City, State" value={city} onChange={e => setCity(e.target.value)} maxLength={80} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>DATE *</div>
                  <input type="date" style={INPUT_STYLE} value={dateVal} onChange={e => setDateVal(e.target.value)} required />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>TIME</div>
                  <input type="time" style={INPUT_STYLE} value={timeVal} onChange={e => setTimeVal(e.target.value)} />
                </div>
              </div>

              <textarea
                style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: 72 }}
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
              />

              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '14px 16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: ticketed ? 14 : 0 }}>
                  <div
                    onClick={() => setTicketed(t => !t)}
                    style={{
                      width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
                      background: ticketed ? '#ff5029' : 'rgba(255,255,255,.1)',
                      transition: 'background .2s', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: ticketed ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left .2s',
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'var(--ink,#f4efe9)' }}>Sell tickets</span>
                </label>
                {ticketed && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>PRICE (USD)</div>
                      <input type="number" min="0" step="0.01" style={INPUT_STYLE} placeholder="e.g. 15.00" value={price} onChange={e => setPrice(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>CAPACITY</div>
                      <input type="number" min="1" style={INPUT_STYLE} placeholder="e.g. 200" value={capacity} onChange={e => setCapacity(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={asDraft} onChange={e => setAsDraft(e.target.checked)} style={{ accentColor: '#ff5029' }} />
                <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.45)' }}>Save as draft (not public yet)</span>
              </label>
              <button
                type="submit"
                disabled={busy || !title.trim() || !venue.trim() || !dateVal}
                style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none', cursor: busy ? 'default' : 'pointer',
                  background: busy || !title.trim() || !venue.trim() || !dateVal ? 'rgba(255,80,41,.3)' : '#ff5029',
                  color: '#fff', fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em',
                }}
              >
                {busy ? 'Saving…' : asDraft ? 'SAVE DRAFT' : 'PUBLISH EVENT'}
              </button>
            </div>
          </form>
        )}

        {shows.length > 0 && (
          <>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 12 }}>Upcoming</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {shows.map(s => (
                <div key={s.id} style={{
                  background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))',
                  borderRadius: 12, padding: '14px 18px',
                  display: 'grid', gridTemplateColumns: '80px 1fr auto auto', alignItems: 'center', gap: 14,
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, color: 'var(--ink,#f4efe9)' }}>{s.date}</div>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginTop: 2 }}>{s.time}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: 'var(--ink,#f4efe9)', marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.4)' }}>
                      {s.venue}
                      {s.capacity > 0 && <span> · {s.sold}/{s.capacity} sold</span>}
                      {s.hype > 0 && <span> · {s.hype} hype</span>}
                    </div>
                  </div>
                  <ShowStatusChip status={s.status} />
                  {s.price > 0 && (
                    <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: '#ffb84a' }}>
                      ${s.price}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {shows.length === 0 && view === 'list' && (
          <div style={{
            background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))',
            borderRadius: 16, padding: '40px 32px', textAlign: 'center', marginBottom: 28,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎤</div>
            <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>No upcoming events</div>
            <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.4)', marginBottom: 20 }}>
              Add a date to get it live on your page and start selling tickets.
            </div>
            <button
              onClick={() => setView('create')}
              style={{
                padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#ff5029', color: '#fff',
                fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700,
              }}
            >
              ADD FIRST DATE
            </button>
          </div>
        )}

        {pastShows.length > 0 && (
          <>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 12 }}>Past</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pastShows.map(s => (
                <div key={s.id} style={{
                  background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)',
                  borderRadius: 10, padding: '12px 18px',
                  display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.35)' }}>{s.date}</div>
                  <div>
                    <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.5)' }}>{s.name}</div>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.25)', marginTop: 2 }}>
                      {s.venue}
                      {s.sold > 0 && <span> · {s.sold} attended</span>}
                      {s.hype > 0 && <span> · {s.hype} hype</span>}
                    </div>
                  </div>
                  <ShowStatusChip status="ENDED" />
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 28, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)', lineHeight: 1.6 }}>
          Events you publish here appear on your public {artistName} page. Ticketed shows go live for purchase immediately after publishing.
        </div>
      </div>
    </div>
  );
}

/* ── Release sub-components ──────────────────────────────── */
function RelStat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>
        {icon} {value}
      </div>
    </div>
  );
}

const DROP_STEPS = [
  { label: 'Upload & master', note: 'Done · Jun 1', state: 'done' as const },
  { label: 'Cut seed active', note: 'Live · 1,840 views', state: 'active' as const },
  { label: 'Schedule drop', note: 'Jun 14 · pending', state: 'pending' as const },
  { label: 'Radio & playlist pitch', note: '3 playlists queued', state: 'pending' as const },
  { label: 'Announce to fans', note: 'Social + email draft', state: 'pending' as const },
];

const BUNDLES = [
  { label: 'Single', desc: 'Track + seed + release post. Best for quick drops.' },
  { label: 'Launch Pack', desc: 'Single + social kit + playlist pitch + bio update. Recommended.' },
  { label: 'Full Push', desc: 'Launch Pack + radio outreach + press kit + tour hook.' },
];

const PROJECTIONS = [
  { label: 'Streams wk 1', value: '4,200', pct: 60, color: '#ff5029' },
  { label: 'New followers', value: '340', pct: 40, color: '#b983ff' },
  { label: 'Saves', value: '1,100', pct: 50, color: '#22e5d4' },
  { label: 'Est. revenue', value: '$190', pct: 25, color: '#ffb84a' },
];

/* ── Icons ───────────────────────────────────────────────── */
function IconPage() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>;
}
function IconInsights() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20h18M8 16V8M12 16V4M16 16v-6" strokeLinecap="round" /></svg>;
}
function IconTour() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M6 16V7a1 1 0 011-1h10l2 5v5" strokeLinejoin="round" /><path d="M6 16h12" /></svg>;
}
function IconRelease() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" strokeLinecap="round" /></svg>;
}
function IconLibrary() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" /><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>;
}
function IconPressKit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TypingDot({ delay, ..._ }: { delay: number; [k: string]: unknown }) {
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', background: 'rgba(244,239,233,.4)',
      animation: `bounce 1.2s ${delay}ms ease-in-out infinite`,
    }}>
      <style>{`@keyframes bounce { 0%,60%,100% { transform: translateY(0) } 30% { transform: translateY(-6px) } }`}</style>
    </div>
  );
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}

export default ViewArtistPage;
