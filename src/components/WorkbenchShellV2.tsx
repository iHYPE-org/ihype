'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { SeedsGamifiedView } from '@/components/SeedsGamifiedView';

// ── Re-export types that home/page.tsx imports ────────────────
export type { WbStat, WbTrack, WbShow, WbActivity, WbNotification, WbRadioShow, WorkbenchData } from './WorkbenchShell';
export type { Prefs } from './WorkbenchShell';

import type { WorkbenchData, WbTrack, WbRadioShow } from './WorkbenchShell';

// ── View type (v2 simplified) ─────────────────────────────────
type View = 'me' | 'seeds' | 'radio' | 'studio' | 'tickets' | 'settings';

// ── Prefs ─────────────────────────────────────────────────────
const DEFAULT_PREFS = {
  accent: '#ff5029',
  density: 'cozy' as 'compact' | 'cozy' | 'comfy',
  queueRail: true,
  stickyDock: true,
  pinned: ['library', 'radio', 'tickets', 'discover', 'studio'] as string[],
  panel_stats: true,
  panel_tonight: true,
  panel_activity: true,
  panel_hyped: true,
  panel_roles: true,
  city: 'Chicago, IL',
  greeting: 'warm' as 'warm' | 'minimal' | 'data',
};

function loadPrefs() {
  try {
    const s = localStorage.getItem('ihype-prefs-v2');
    return s ? { ...DEFAULT_PREFS, ...JSON.parse(s) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

// ── Accent-2 shift ────────────────────────────────────────────
function shiftAccent(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = 30 / 360;
  const nr = Math.round(r * (1 - t) + b * t);
  const ng = Math.round(g * (1 - t) + r * t);
  const nb = Math.round(b * (1 - t) + g * t);
  return '#' + [nr, ng, nb].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── fmtTime ───────────────────────────────────────────────────
function fmtTime(s: number): string {
  const n = Math.floor(s);
  const m = Math.floor(n / 60);
  const sec = String(n % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
const Ic = ({ s = 16, sw = 1.6, children }: { s?: number; sw?: number; children: React.ReactNode }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

const IcHome     = (p: { s?: number }) => <Ic s={p.s}><path d="M3 11l9-8 9 8"/><path d="M5 9v12h14V9"/></Ic>;
const IcLibrary  = (p: { s?: number }) => <Ic s={p.s}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M14 3v18"/></Ic>;
const IcRadio    = (p: { s?: number }) => <Ic s={p.s}><circle cx="12" cy="12" r="3"/><path d="M5.5 8.5a8 8 0 0 1 13 0M3 6a11 11 0 0 1 18 0M5.5 15.5a8 8 0 0 0 13 0M3 18a11 11 0 0 0 18 0"/></Ic>;
const IcTicket   = (p: { s?: number }) => <Ic s={p.s}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" strokeDasharray="2 2"/></Ic>;
const IcDisco    = (p: { s?: number }) => <Ic s={p.s}><circle cx="12" cy="12" r="9"/><polygon points="15 9 13 13 9 15 11 11" fill="currentColor" stroke="none"/></Ic>;
const IcStudio   = (p: { s?: number }) => <Ic s={p.s}><path d="M6 3v18M18 3v18M3 6h18M3 12h18M3 18h18"/></Ic>;
const IcSettings = (p: { s?: number }) => <Ic s={p.s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Ic>;
const IcPlay     = ({ s = 14 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>;
const IcPause    = ({ s = 14 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
const IcSkipP    = ({ s = 14 }: { s?: number }) => <Ic s={s} sw={2}><polygon points="19 4 9 12 19 20" fill="currentColor"/><rect x="5" y="4" width="2" height="16" fill="currentColor"/></Ic>;
const IcSkipN    = ({ s = 14 }: { s?: number }) => <Ic s={s} sw={2}><polygon points="5 4 15 12 5 20" fill="currentColor"/><rect x="17" y="4" width="2" height="16" fill="currentColor"/></Ic>;
const IcShuffle  = (p: { s?: number }) => <Ic s={p.s}><path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5"/></Ic>;
const IcRepeat   = (p: { s?: number }) => <Ic s={p.s}><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></Ic>;
const IcHeart    = ({ s = 14, c = 'currentColor', filled = false }: { s?: number; c?: string; filled?: boolean }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? c : 'none'} stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcQueue    = (p: { s?: number }) => <Ic s={p.s}><path d="M3 6h13M3 12h13M3 18h9M17 14v7l5-3.5z" fill="currentColor"/></Ic>;
const IcVol      = (p: { s?: number }) => <Ic s={p.s}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor"/><path d="M15 9a3 3 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></Ic>;
const IcSearch   = (p: { s?: number }) => <Ic s={p.s}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
const IcDot      = ({ c = 'currentColor', s = 8 }: { c?: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill={c}/></svg>;
const IcBolt     = (p: { s?: number }) => <Ic s={p.s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10" fill="currentColor"/></Ic>;
const IcCheck    = (p: { s?: number }) => <Ic s={p.s}><polyline points="20 6 9 17 4 12"/></Ic>;
const IcArrow    = ({ s = 14 }: { s?: number }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

const IcQR = ({ s = 60 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 80 80">
    {([[0,0],[60,0],[0,60]] as [number,number][]).map(([x,y],i)=>(
      <g key={i}><rect x={x} y={y} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3"/><rect x={x+6} y={y+6} width="8" height="8" fill="currentColor"/></g>
    ))}
    {Array.from({length:40}).map((_,i)=>{
      const x=24+(i%10)*4, y=24+Math.floor(i/10)*4;
      return (i*13+7)%3===0 ? <rect key={i} x={x} y={y} width="3" height="3" fill="currentColor"/> : null;
    })}
  </svg>
);

// ─────────────────────────────────────────────────────────────
// App Topbar (logo + tabs + stats + user chip)
// ─────────────────────────────────────────────────────────────
const TAB_ICONS: Record<string, React.ReactNode> = {
  me: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="2.5"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>,
  seeds: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/></svg>,
  radio: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r=".6" fill="currentColor"/></svg>,
  studio: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8h1M8 6v4M11 7v2"/></svg>,
  tickets: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6a1.5 1.5 0 0 0 0 3v3h12V9a1.5 1.5 0 0 0 0-3V3H2v3Z"/><path d="M9 3v10" strokeDasharray="1.4 1.4"/></svg>,
};

const TABS: { k: View; label: string; badge?: string }[] = [
  { k: 'me',       label: 'My Page' },
  { k: 'seeds',    label: 'Seeds',     badge: '12' },
  { k: 'radio',    label: 'Radio',     badge: 'LIVE' },
  { k: 'studio',   label: 'Studio' },
  { k: 'tickets',  label: 'Ticketing', badge: '3' },
];

function AppTopbar({ view, setView, listeningNow, initials, userName, activeProfileTypes, onSettings }: {
  view: View; setView: (v: View) => void;
  listeningNow: number; initials: string; userName: string;
  activeProfileTypes: string[]; onSettings: () => void;
}) {
  return (
    <header style={{
      height: 'var(--top-h)', borderBottom: '1px solid var(--line)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center',
      gap: 24, padding: '0 22px',
      background: 'var(--bg-2)', position: 'relative', zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', userSelect: 'none' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent), #ff3e9a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 14, color: '#0a0805',
          position: 'relative',
        }}>
          iH
          <span style={{ position: 'absolute', top: 5, right: 7, width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--ink)', display: 'flex', alignItems: 'baseline', gap: 1 }}>
            iHYPE<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', transform: 'translateY(-9px)', marginLeft: 1 }} />
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: 3 }}>workbench</div>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
        {TABS.map(tab => {
          const active = view === tab.k;
          return (
            <button key={tab.k} onClick={() => setView(tab.k)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
              borderRadius: 8, cursor: 'pointer', border: 'none',
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              background: 'transparent',
              fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, letterSpacing: '-.005em',
              position: 'relative', transition: 'color .15s, background .15s',
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.03)'; (e.currentTarget as HTMLButtonElement).style.color = active ? 'var(--ink)' : '#f0ebe5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = active ? 'var(--ink)' : 'var(--ink-2)'; }}
            >
              {TAB_ICONS[tab.k]}
              {tab.label}
              {tab.badge && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99,
                  background: active ? 'rgba(255,80,41,.16)' : 'var(--bg-3)',
                  fontFamily: 'var(--f-m)', fontSize: 9,
                  color: active ? 'var(--accent)' : 'var(--ink-2)', fontWeight: 700, letterSpacing: '.04em',
                }}>{tab.badge}</span>
              )}
              {active && (
                <span style={{
                  position: 'absolute', left: 14, right: 14, bottom: 0, height: 2,
                  background: 'var(--accent)', borderRadius: '2px 2px 0 0',
                  boxShadow: '0 0 12px rgba(255,80,41,.6)',
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: listening + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', paddingRight: 14, borderRight: '1px solid var(--line)', marginRight: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22e5d4', boxShadow: '0 0 8px #22e5d4', animation: 'pulse 1.8s infinite', display: 'inline-block' }} />
          {listeningNow.toLocaleString()} listening
        </span>
        <button onClick={onSettings} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px 5px 5px',
          borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--line-2)',
          cursor: 'pointer', transition: 'border-color .15s',
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff3e9a, var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 11, color: '#0a0805',
          }}>{initials}</span>
          <div>
            <div style={{ fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 12, color: 'var(--ink)', lineHeight: 1 }}>{userName}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.08em', marginTop: 2 }}>{activeProfileTypes.slice(0, 2).join(' + ')}</div>
          </div>
          <span style={{ padding: '3px 7px', borderRadius: 99, background: 'rgba(255,184,74,.12)', color: '#ffb84a', fontFamily: 'var(--f-m)', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', border: '1px solid rgba(255,184,74,.28)' }}>LVL 14</span>
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewMyPage (profile)
// ─────────────────────────────────────────────────────────────
function ViewMyPage({ data, onPickTrack, currentIdx }: {
  data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number;
}) {
  const heroStats = [
    { v: (data.lifeStats?.totalHype ?? 1284).toLocaleString(), k: 'HYPE Given', accent: true },
    { v: '842', k: 'Received', accent: false },
    { v: String(data.lifeStats?.eventsAttended ?? 23), k: 'Shows Attended', accent: false },
    { v: '7', k: 'Top-5 Slots', accent: false },
  ];

  return (
    <div style={{ padding: '32px 48px 48px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Hero — 3-col grid */}
      <div className="me-hero-grid" style={{
        display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 28, alignItems: 'center',
        padding: 26, borderRadius: 14,
        background: 'linear-gradient(135deg, var(--bg-2), var(--bg-3))',
        border: '1px solid var(--line-2)', position: 'relative', overflow: 'hidden', marginBottom: 28,
      }}>
        {/* Radial glow */}
        <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '50%', height: '200%', background: 'radial-gradient(ellipse, rgba(255,80,41,.18), transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />
        {/* Portrait */}
        <div style={{
          width: 200, height: 200, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent) 0%, #ff3e9a 50%, #b983ff 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 90, color: '#0a0805', letterSpacing: '-.04em', mixBlendMode: 'overlay', opacity: .85, lineHeight: 1 }}>{data.userInitials}</span>
        </div>

        {/* Identity col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            {data.activeProfileTypes.slice(0, 2).map(r => {
              const roleColors: Record<string, string> = { LISTENER: '#b983ff', ARTIST: '#ff5029', VENUE: '#22e5d4', DJ: '#ff3e9a' };
              const c = roleColors[r] ?? '#9e9080';
              return (
                <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--line-2)', fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--ink)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />{r}
                </span>
              );
            })}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 99, background: 'rgba(255,184,74,.12)', border: '1px solid rgba(255,184,74,.28)', fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: '#ffb84a' }}>⚡ LEVEL 14</span>
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 46, letterSpacing: '-.03em', lineHeight: .95, margin: 0, color: 'var(--ink)' }}>{data.userName}</h1>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.08em' }}>@{data.userName.toLowerCase().replace(/\s/g, '.')} · {data.city} · Joined Mar &apos;25</div>
          <p style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.4, maxWidth: '50ch' }}>Halflight EP out now. Writing the next thing in a basement on Western Ave. Recommendations open.</p>
        </div>

        {/* Stats 2×2 grid */}
        <div className="me-hero-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '18px 28px', zIndex: 1 }}>
          {heroStats.map(s => (
            <div key={s.k} style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.02em', lineHeight: 1, color: s.accent ? 'var(--accent)' : 'var(--ink)' }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.16em', textTransform: 'uppercase', marginTop: 6 }}>{s.k}</div>
            </div>
          ))}
        </div>
        {/* Inline stats for narrow screens */}
        <div className="me-hero-stats-inline" style={{ display: 'none', gap: 20, flexWrap: 'wrap', gridColumn: '1 / -1', zIndex: 1, paddingTop: 8 }}>
          {heroStats.map(s => (
            <div key={s.k} style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1, color: s.accent ? 'var(--accent)' : 'var(--ink)' }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.16em', textTransform: 'uppercase', marginTop: 4 }}>{s.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stat tiles — 4-col */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { k: 'Weekly Listens', v: '2,284', d: <><span style={{ color: '#22e5d4' }}>↑ 18%</span> vs last week</> },
          { k: 'Seed Save Rate', v: '26%', d: '88 saves on Sundown' },
          { k: 'Next Payout', v: '$2,460', d: 'releases Jun 24' },
          { k: 'Next Show', v: 'Jun 18', d: 'Empty Bottle · 9PM' },
        ].map(s => (
          <div key={s.k} style={{ padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{s.k}</div>
            <div style={{ fontFamily: 'var(--f-d)', fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)', lineHeight: 1, marginTop: 6 }}>{s.v}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)', marginTop: 4 }}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* Two-col: Top 5 + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 14 }}>
        <Panel title="Top 5 — this week" link="Curated · updates Sundays">
          <div style={{ padding: '4px 0' }}>
            {data.tracks.slice(0, 5).map((t, i) => (
              <button key={t.id} onClick={() => onPickTrack(i)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                borderBottom: '1px solid var(--line)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 13, color: 'var(--ink-3)', width: 20, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ width: 32, height: 32, borderRadius: 5, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, flexShrink: 0, borderBottom: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '.04em' }}>{t.artistName} · {t.album}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff3e9a', flexShrink: 0 }}>
                  <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{t.duration}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Recent activity" link="Mark read">
          <div style={{ padding: '4px 0' }}>
            {data.activity.slice(0, 5).map((a, i) => {
              const dotColor: Record<string, string> = { hype: '#ff3e9a', show: '#22e5d4', radio: '#b983ff', payout: '#ffb84a' };
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor[a.kind] || 'var(--ink-3)', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink)' }}>{a.text}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>{a.time}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* HYPEd tracks */}
      <Panel title="HYPEd this week" link="Open seeds →" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, padding: '14px 16px' }}>
          {data.tracks.slice(0, 6).map((t, i) => (
            <TrackCard key={t.id} track={t} active={i === currentIdx} onClick={() => onPickTrack(i)} />
          ))}
        </div>
      </Panel>

      {/* Your roles */}
      <Panel title="Your roles">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '14px 16px' }}>
          {(['LISTENER','ARTIST','VENUE','DJ'] as const).map(rk => {
            const active = data.activeProfileTypes.includes(rk);
            const roleColors: Record<string, string> = { LISTENER: '#b983ff', ARTIST: '#ff5029', VENUE: '#22e5d4', DJ: '#ff3e9a' };
            const roleLabels: Record<string, { label: string; sub: string }> = {
              LISTENER: { label: 'Fan', sub: 'HYPE tracks, swipe seeds, attend' },
              ARTIST:   { label: 'Artist', sub: 'Upload, seed, tour · 45% of every ticket' },
              VENUE:    { label: 'Venue', sub: 'List shows · 45% · demand radar' },
              DJ:       { label: 'Promoter/DJ', sub: 'Referral links · 10% on tickets you drive' },
            };
            const col = roleColors[rk];
            const info = roleLabels[rk];
            return (
              <div key={rk} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                border: `1px solid ${active ? col : 'var(--line)'}`, borderRadius: 8,
                background: active ? `${col}08` : 'var(--bg-2)',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{info.label}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 2 }}>{info.sub}</div>
                </div>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                  border: `1px solid ${active ? col + '40' : 'var(--line-2)'}`, borderRadius: 99,
                  fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.04em',
                  color: active ? col : 'var(--ink-2)', background: 'none', cursor: 'pointer',
                }}>
                  {active ? <><IcCheck s={11} /> active</> : 'add →'}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewSeeds — 3-col layout matching design
// ─────────────────────────────────────────────────────────────
function ViewSeeds({
  data,
  seedPlaying,
  setSeedPlaying,
  seedCardIdx,
  onSave,
}: {
  data: WorkbenchData;
  seedPlaying: boolean;
  setSeedPlaying: (v: boolean) => void;
  seedCardIdx: number;
  onSave?: (idx: number) => void;
}) {
  const waveHeights = [30,55,80,42,90,70,48,88,62,35,78,55,92,40,68,82,48,30,62,88];
  // SeedsGamifiedView is kept for future embedded use
  void SeedsGamifiedView;

  // Determine which track to show on the front card
  const frontTrack = data.tracks.length > 0 ? data.tracks[seedCardIdx % data.tracks.length] : null;

  // Web Audio API tone generator (220Hz sine, 0.08 gain, 15s)
  useEffect(() => {
    if (!seedPlaying) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 220;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 15);
    const timer = setTimeout(() => setSeedPlaying(false), 15000);
    return () => {
      clearTimeout(timer);
      try { osc.stop(); } catch {}
      ctx.close();
    };
  }, [seedPlaying, setSeedPlaying]);

  return (
    <div style={{ padding: '32px 48px 48px', maxWidth: 1600, margin: '0 auto' }}>
      {/* View head */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.18em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>DISCOVER · 15–30s clips · Chicago</div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 38, letterSpacing: '-.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Seeds <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-2)' }}>— decide in 15 seconds.</em></h1>
          <p style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 8, maxWidth: '60ch' }}>Hand-cut hooks from new uploads. Save it, hype it, skip it. Save-rate becomes the algorithm.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink-2)', border: '1px solid transparent', background: 'none' }}>⚙ Filters</button>
          <button style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink-2)', border: '1px solid transparent', background: 'none' }}>Local · Chicago ▾</button>
        </div>
      </div>

      {/* 3-col seeds stage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px 1fr', gap: 30, alignItems: 'flex-start', paddingTop: 8 }}>

        {/* Left col */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>TODAY&apos;S DECK</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
            {[
              { k: 'Reviewed', v: '4 / 12', c: 'var(--ink)' },
              { k: 'Saved', v: '+3', c: '#22e5d4' },
              { k: 'Skipped', v: '1', c: '#ff6b5a' },
              { k: 'Hyped', v: '2', c: 'var(--pink)' },
            ].map(r => (
              <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontFamily: 'var(--f-m)', fontSize: 11 }}>
                <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>{r.k}</span>
                <span style={{ color: r.c, fontWeight: 600 }}>{r.v}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--f-m)', fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>XP earned</span>
              <span style={{ color: '#ffb84a', fontWeight: 600 }}>+42 XP</span>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: 18, marginBottom: 4 }}>DAILY QUEST</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14 }}>Save 5 seeds today</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[true,true,true,false,false].map((filled, i) => (
                <span key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: filled ? 'var(--accent)' : 'var(--bg-3)' }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em' }}>3 / 5 · 60 XP + Seed Curator badge</div>
          </div>
        </aside>

        {/* Center col — card stack + controls */}
        <div>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '380/520', margin: '0 auto' }}>
            {/* behind-2 */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', transformOrigin: 'center bottom', transform: 'translateY(26px) scale(.88)', opacity: .28, zIndex: 0, background: 'linear-gradient(135deg, #22e5d4, #7fb3ff)' }} />
            {/* behind-1 */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', transformOrigin: 'center bottom', transform: 'translateY(14px) scale(.94)', opacity: .55, zIndex: 1, background: 'linear-gradient(135deg, #b983ff, #ff3e9a)' }} />
            {/* front card */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', zIndex: 5 }}>
              {/* Art bg */}
              <div style={{ position: 'absolute', inset: 0, background: frontTrack ? `linear-gradient(135deg, ${frontTrack.color} 0%, #ff3e9a 60%, #221c16 100%)` : 'linear-gradient(135deg, #ff5029 0%, #ff3e9a 60%, #221c16 100%)' }} />
              {/* Overlay gradient */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.75) 100%)' }} />
              {/* Playing indicator */}
              {seedPlaying && (
                <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 10, padding: '5px 12px', borderRadius: 99, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: '#22e5d4', animation: 'pulse 1.4s infinite', whiteSpace: 'nowrap' }}>
                  ● PLAYING
                </div>
              )}
              {/* Tags */}
              <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 3 }}>
                <span style={{ padding: '5px 10px', borderRadius: 99, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />SEED · 22s
                </span>
                <span style={{ padding: '5px 10px', borderRadius: 99, background: 'rgba(255,255,255,.18)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', fontWeight: 700, color: '#fff' }}>CHICAGO</span>
              </div>
              {/* Waveform */}
              <div style={{ position: 'absolute', bottom: 170, left: 24, right: 24, height: 36, display: 'flex', alignItems: 'flex-end', gap: 3, zIndex: 3 }}>
                {waveHeights.map((h, i) => (
                  <i key={i} style={{ flex: 1, background: seedPlaying ? 'rgba(34,229,212,.8)' : 'rgba(255,255,255,.55)', borderRadius: 99, display: 'block', height: `${h}%`, transition: 'background .3s' }} />
                ))}
              </div>
              {/* Body */}
              <div style={{ position: 'absolute', bottom: 60, left: 22, right: 22, zIndex: 3, color: '#fff' }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-.03em', lineHeight: .95, textShadow: '0 2px 12px rgba(0,0,0,.4)' }}>{frontTrack ? frontTrack.title : 'Slow Burn'}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'rgba(255,255,255,.8)', letterSpacing: '.1em', marginTop: 6, textTransform: 'uppercase' }}>{frontTrack ? `${frontTrack.artistName} · ${frontTrack.album}` : 'The Lowriders · Side Roads'}</div>
                <div style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontSize: 16, color: 'rgba(255,255,255,.9)', marginTop: 14, lineHeight: 1.35, borderLeft: '2px solid var(--accent)', paddingLeft: 10 }}>&ldquo;It only really lands at 1:48 — that&apos;s the seed.&rdquo;</div>
              </div>
              {/* Footer */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,.08)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.08em', color: 'rgba(255,255,255,.7)' }}>
                <span>♥ {frontTrack ? frontTrack.hypeCount : 211} hype</span>
                <span>48 saves · 21 skips</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 24 }}>
            <button title="Skip (ArrowLeft)" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid rgba(255,107,90,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ff6b5a' }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
            <button title="Play/Pause (Space)" onClick={() => setSeedPlaying(!seedPlaying)} style={{ width: 56, height: 56, borderRadius: '50%', background: seedPlaying ? 'rgba(34,229,212,.1)' : 'var(--bg-2)', border: `1px solid ${seedPlaying ? 'rgba(34,229,212,.6)' : 'var(--line-2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: seedPlaying ? '#22e5d4' : 'var(--ink-2)' }}>
              {seedPlaying ? <IcPause s={20} /> : <IcPlay s={20} />}
            </button>
            <button title="Save — loads into dock (ArrowUp)" onClick={() => onSave?.(seedCardIdx % Math.max(data.tracks.length, 1))} style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid rgba(34,229,212,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#22e5d4' }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l14 7-14 7V5z" fill="currentColor" opacity=".2"/><path d="M5 5l14 7-14 7V5z"/></svg>
            </button>
            <button title="HYPE it (ArrowRight)" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid rgba(255,62,154,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--pink)' }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.14em', marginTop: 14, textTransform: 'uppercase' }}>← Skip · ↑ Save · → Hype · Space Play/Pause</div>
        </div>

        {/* Right col */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>UP NEXT</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { title: 'Cassette Heart', artist: 'Juno North', dur: '24s', grad: 'linear-gradient(135deg,#b983ff,#7fb3ff)', op: 1 },
              { title: 'Halflight', artist: 'Maya Reyes', dur: '20s', grad: 'linear-gradient(135deg,#22e5d4,#b983ff)', op: 1 },
              { title: 'Underpass', artist: 'Saint Hex', dur: '27s', grad: 'linear-gradient(135deg,#7fb3ff,#ff5029)', op: 0.6 },
            ].map(t => (
              <div key={t.title} style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: 10, alignItems: 'center', opacity: t.op }}>
                <div style={{ width: 42, height: 42, borderRadius: 6, background: t.grad }} />
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13 }}>{t.title}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em' }}>{t.artist} · {t.dur}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: 18, marginBottom: 4 }}>WHY THIS SEED?</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, fontFamily: 'var(--f-b)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            You hyped <span style={{ color: 'var(--accent)', fontWeight: 600 }}>3 tracks</span> from The Lowriders this month. This is from their unreleased EP <em style={{ fontFamily: "'Instrument Serif',serif" }}>&ldquo;Side Roads&rdquo;</em> — promoter test pressing.
          </div>
        </aside>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Queue Rail
// ─────────────────────────────────────────────────────────────
function QueueRail({ tracks, currentIdx, onPick }: {
  tracks: WbTrack[]; currentIdx: number; onPick: (i: number) => void;
}) {
  const durMin = tracks.reduce((a, t) => a + t.durationSec, 0);
  return (
    <aside style={{
      width: 'var(--queue-w)', borderLeft: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden',
      gridColumn: 3, gridRow: 2,
    }}>
      {/* Head */}
      <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em' }}>Queue</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>
            {tracks.length} tracks · {Math.floor(durMin / 60)}m
          </div>
        </div>
        <button style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.1em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {tracks.map((t, i) => {
          const active = i === currentIdx;
          return (
            <button key={t.id} onClick={() => onPick(i)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 6, transition: 'background .15s',
              background: active ? 'rgba(255,255,255,.04)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 4, flexShrink: 0, position: 'relative',
                background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`,
              }}>
                {active && (
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)' }}>
                    <IcDot c={t.color} s={6} />
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{t.title}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 2 }}>{t.artistName}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--f-m)', fontSize: 10, color: '#ff3e9a' }}>
                <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', width: 30, textAlign: 'right' }}>{t.duration}</div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 20px 18px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.14em' }}>CURATED BY</div>
        <div style={{ fontFamily: 'var(--f-s)', fontStyle: 'italic', fontSize: 18, marginTop: 4, color: 'var(--ink)' }}>iHYPE · Discovery Queue</div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Player Dock
// ─────────────────────────────────────────────────────────────
function PlayerDock({ track, playing, onToggle, onNext, onPrev, progress, setProgress }: {
  track: WbTrack; playing: boolean; onToggle: () => void;
  onNext: () => void; onPrev: () => void;
  progress: number; setProgress: (p: number) => void;
}) {
  return (
    <footer style={{
      display: 'grid', gridTemplateColumns: '340px 1fr 340px', alignItems: 'center', gap: 24, padding: '0 22px',
      background: 'linear-gradient(180deg, var(--bg-2), var(--bg))',
      borderTop: '1px solid var(--line-2)', position: 'relative',
      gridColumn: '1 / -1',
    }}>
      {/* Top gradient accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), #ff3e9a, transparent)', opacity: .5, pointerEvents: 'none' }} />

      {/* Left: 340px — art + info + hype */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: 7, flexShrink: 0, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}80)` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.3), transparent 60%)' }} />
          {playing && (
            <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 2, alignItems: 'flex-end', height: 10, zIndex: 2 }}>
              {[{ dur: '1.1s' }, { dur: '.9s' }, { dur: '1.3s' }].map((b, i) => (
                <i key={i} style={{ width: 2, background: '#fff', borderRadius: 99, display: 'block', height: 3, animation: `eq ${b.dur} infinite` }} />
              ))}
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, letterSpacing: '-.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{track.title}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.04em', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artistName} · <span style={{ color: 'var(--ink-4)' }}>{track.album}</span></div>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid rgba(255,62,154,.3)', borderRadius: 99, color: '#ff3e9a', fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 600, background: 'rgba(255,62,154,.05)', cursor: 'pointer', flexShrink: 0 }}>
          <IcHeart s={14} c="#ff3e9a" /> {track.hypeCount}
        </button>
      </div>

      {/* Center: controls + scrub */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button title="Shuffle" style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcShuffle s={14} /></button>
          <button title="Previous" onClick={onPrev} style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcSkipP s={14} /></button>
          <button onClick={onToggle} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
            {playing ? <IcPause s={14} /> : <IcPlay s={14} />}
          </button>
          <button title="Next" onClick={onNext} style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcSkipN s={14} /></button>
          <button title="Repeat" style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcRepeat s={14} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 540 }}>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', minWidth: 34, textAlign: 'center' }}>{fmtTime(progress * track.durationSec)}</span>
          <div
            style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 99, position: 'relative', cursor: 'pointer', overflow: 'visible' }}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              setProgress(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
            }}
          >
            <div style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: 'linear-gradient(90deg, var(--accent), #ff3e9a)', borderRadius: 99 }} />
            <div style={{ position: 'absolute', top: '50%', left: `${progress * 100}%`, transform: 'translate(-50%, -50%)', width: 11, height: 11, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,.15)' }} />
          </div>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', minWidth: 34, textAlign: 'center' }}>{track.duration}</span>
        </div>
      </div>

      {/* Right: 340px — queue + vol */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
        <button title="Queue" style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcQueue s={14} /></button>
        <button title="Volume" style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcVol s={14} /></button>
        <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 99, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, width: '65%', background: 'var(--ink-2)', borderRadius: 99 }} />
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────
function Panel({ title, link, onLink, children, style }: {
  title: string; link?: string; onLink?: () => void; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden', ...style }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, letterSpacing: '-.005em', color: 'var(--ink)' }}>{title}</div>
        {link && <button onClick={onLink} style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.1em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>{link}</button>}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, delta, color }: { label: string; value: string; delta: string; color: string }) {
  return (
    <div style={{ padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.16em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-d)', fontSize: 26, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--ink)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.02em', marginTop: 6, color }}>{delta}</div>
    </div>
  );
}

function Toggle({ on, onChange, small }: { on: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  const w = small ? 30 : 38, h = small ? 18 : 22;
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: w, height: h, borderRadius: 99,
        background: on ? 'var(--accent)' : 'var(--bg-4)',
        position: 'relative', transition: 'background .2s', flexShrink: 0,
        border: 'none', cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? w - h + 2 : 2,
        width: h - 4, height: h - 4, borderRadius: '50%',
        background: 'var(--ink)', transition: 'left .2s',
      }} />
    </button>
  );
}

function TrackCard({ track, active, onClick }: { track: WbTrack; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: 8, border: `1px solid ${active ? track.color : 'var(--line)'}`,
      borderRadius: 8, background: 'var(--bg-3)', textAlign: 'left',
      transition: 'border-color .2s', cursor: 'pointer', width: '100%',
    }}>
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 5, marginBottom: 8, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}80)` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,.25), transparent 65%)' }} />
        <div style={{ position: 'absolute', left: 10, bottom: 10, width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IcPlay s={12} />
        </div>
        <div style={{ position: 'absolute', right: 8, top: 8, padding: '2px 7px', background: 'rgba(0,0,0,.5)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 9, color: '#ff3e9a', display: 'flex', alignItems: 'center', gap: 3 }}>
          <IcHeart s={10} c="#ff3e9a" /> {track.hypeCount}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, letterSpacing: '-.005em', color: 'var(--ink)' }}>{track.title}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{track.artistName} · {track.duration}</div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewRadio
// ─────────────────────────────────────────────────────────────
const ViewRadio = memo(function ViewRadio({ data, onPickTrack }: {
  data: WorkbenchData; onPickTrack: (i: number) => void;
}) {
  const shows = data.radioShows;
  const [activeId, setActiveId] = useState(shows[0]?.id ?? '');
  const show = shows.find(r => r.id === activeId) ?? shows[0];
  const FREQS = ['88.3','94.1','101.7','107.9','104.5','99.5'];
  const showIdx = shows.findIndex(r => r.id === activeId);

  if (!show) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: '#ff3e9a', marginBottom: 10 }}>● RADIO · iHYPE NETWORK</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Radio</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 16 }}>No radio shows yet. Start one in Studio.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: '#ff3e9a', marginBottom: 10 }}>
            ● ON AIR · {shows.length} CHANNELS · {shows.reduce((a, s) => a + s.listeners, 0).toLocaleString()} LISTENING NOW
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Radio</h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Curated shows from promoters, DJs, and artists. No ads, no algorithm — just real people picking music.</p>
        </div>
        <button style={{ padding: '9px 16px', border: '1px solid var(--accent-2)', color: 'var(--accent-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, background: 'none', cursor: 'pointer' }}>
          <IcBolt s={12} /> Start your show →
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Channels list */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.14em' }}>CHANNELS</div>
          {shows.map(r => (
            <button key={r.id} onClick={() => setActiveId(r.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderBottom: '1px solid var(--line)', textAlign: 'left', transition: 'background .15s', cursor: 'pointer',
              background: r.id === activeId ? `${r.color}10` : 'transparent',
              borderLeft: `2px solid ${r.id === activeId ? r.color + '50' : 'transparent'}`,
            }}>
              <div style={{ width: 3, height: 32, borderRadius: 2, background: r.color, opacity: r.live ? 1 : .3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
                  {r.name}
                  {r.live && <span style={{ fontFamily: 'var(--f-m)', fontSize: 8, color: '#ff3e9a', letterSpacing: '.16em', padding: '1px 5px', border: '1px solid rgba(255,62,154,.4)', borderRadius: 3 }}>● LIVE</span>}
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{r.host} · {r.time}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)' }}>{r.listeners}</div>
            </button>
          ))}
          <div style={{ padding: '10px 14px', textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em', cursor: 'pointer' }}>+ Add station</span>
          </div>
        </div>

        {/* Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hero */}
          <div style={{ padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 10, background: `linear-gradient(135deg, ${show.color}30 0%, transparent 60%), var(--bg-2)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              {show.live ? (
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#ff3e9a', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid rgba(255,62,154,.3)', borderRadius: 99 }}>
                  <IcDot c="#ff3e9a" s={8} /> ON AIR · {show.listeners} listening
                </span>
              ) : (
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.14em' }}>
                  NEXT BROADCAST · {show.next}
                </span>
              )}
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--ink-2)' }}>{FREQS[showIdx] ?? '88.3'} MHz</span>
            </div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 34, letterSpacing: '-.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>{show.name}</h2>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.06em', marginTop: 8 }}>Hosted by <strong>{show.host}</strong> · {show.time}</div>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 14, maxWidth: 540, lineHeight: 1.55 }}>{show.desc}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button style={{ padding: '9px 16px', background: show.live ? show.color : 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer' }}>
                <IcPlay s={12} /> {show.live ? 'Tune in' : 'Pre-roll archive'}
              </button>
              {['＋ Subscribe', '♥ Hype show'].map(l => (
                <button key={l} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', background: 'none', cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Set list */}
          <Panel title="Set list · this broadcast" link="Save all to playlist →">
            <div style={{ padding: '4px 0' }}>
              {data.tracks.slice(0, 6).map((t, i) => (
                <button key={t.id} onClick={() => onPickTrack(i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderBottom: '1px solid var(--line)', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', width: 22 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ width: 34, height: 34, borderRadius: 4, flexShrink: 0, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{t.title}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 2 }}>{t.artistName} · {t.album}</div>
                  </div>
                  <div style={{ padding: '2px 8px', background: 'var(--bg-3)', borderRadius: 3, fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-2)', letterSpacing: '.08em' }}>
                    {i === 0 && show.live ? 'NOW' : i < 2 ? 'JUST PLAYED' : `-${i * 4}m`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff3e9a', width: 50, justifyContent: 'flex-end' }}>
                    <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// ViewTickets (Live Events)
// ─────────────────────────────────────────────────────────────
const ViewTickets = memo(function ViewTickets({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'browse' | 'mine' | 'selling' | 'scan'>('browse');
  const tabs = [['browse','Browse'],['mine','My tickets'],['selling','Selling'],['scan','Scan / verify']] as const;

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, gap: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: '#22e5d4', marginBottom: 10 }}>
            ● {data.showsTonight} TONIGHT · NO SCALPERS · 45/45/10 SPLIT
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Live Events</h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>
            Every show in real rooms — browse, buy, hold, transfer, verify. <strong>45/45/10</strong> split: artist · venue · referrer. No platform fee, ever.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, flexShrink: 0 }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '7px 12px', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.04em', border: 'none', cursor: 'pointer',
              background: tab === k ? 'var(--bg-3)' : 'transparent',
              color: tab === k ? 'var(--ink)' : 'var(--ink-3)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['ALL CITIES','CHICAGO','THIS WEEK','UNDER $20'].map((f, i) => (
              <button key={f} style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', cursor: 'pointer', background: i === 1 ? 'var(--bg-4)' : 'var(--bg-2)', color: i === 1 ? 'var(--ink)' : 'var(--ink-2)', borderColor: i === 1 ? 'var(--line-2)' : 'var(--line)' }}>{f}</button>
            ))}
            <span style={{ flex: 1 }} />
            <button style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)', background: 'var(--bg-2)', cursor: 'pointer' }}>Sort · by HYPE ↓</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {data.shows.map(s => {
              const pct = s.capacity > 0 ? (s.sold / s.capacity) * 100 : 0;
              const statusColor = s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : '#b983ff';
              const color = ['#ff5029','#b983ff','#22e5d4','#ff3e9a'][data.shows.indexOf(s) % 4];
              return (
                <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 140, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${color}, ${color}80)` }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,.4) 100%)' }} />
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(0,0,0,.55)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 9, color: '#fff', letterSpacing: '.14em' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} /> {s.status}
                    </div>
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(0,0,0,.55)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 10, color: '#fff' }}>
                      ♡ {s.hype} HYPE
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{s.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{s.venue}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em' }}>{s.date} · {s.time}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: pct > 85 ? '#ffb84a' : '#22e5d4', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)' }}>{s.sold} / {s.capacity}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--ink)' }}>${s.price}</div>
                      <button style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>Get ticket →</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 2, borderTop: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.04em' }}>
                      <span>${(s.price * 0.45).toFixed(2)} → artist</span>
                      <span>${(s.price * 0.45).toFixed(2)} → venue</span>
                      <span>${(s.price * 0.10).toFixed(2)} → referrer</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'mine' && (
        <div>
          {data.tickets.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.16em', marginBottom: 10 }}>NEXT UP</div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 200px', gap: 32, padding: '24px 28px',
                border: '1px solid var(--line)', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(255,80,41,.15) 0%, transparent 60%), var(--bg-2)',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#22e5d4', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcDot c="#22e5d4" s={7} /> CONFIRMED · DOORS 7:30 PM
                  </div>
                  <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-.025em', margin: '10px 0 4px', color: 'var(--ink)' }}>
                    {data.tickets[0].showName}
                  </h2>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{data.tickets[0].date}</div>
                  <div style={{ display: 'flex', gap: 30, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                    {[['SEAT', data.tickets[0].seat], ['PAID', `$${data.tickets[0].price}`], ['ENTRY CODE', data.tickets[0].code]].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.16em', marginBottom: 6 }}>{l}</div>
                        <div style={{ fontFamily: l === 'ENTRY CODE' ? 'var(--f-m)' : 'var(--f-d)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
                    <button style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>Show at door →</button>
                    {['Transfer', 'Add to Wallet'].map(l => (
                      <button key={l} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', color: 'var(--ink)', background: 'none', cursor: 'pointer' }}>{l}</button>
                    ))}
                    <button style={{ padding: '9px 14px', border: '1px solid rgba(255,80,41,.3)', color: '#ff5029', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', background: 'none', cursor: 'pointer' }}>Request refund</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <div style={{ padding: 14, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 8 }}><IcQR s={140} /></div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.06em', textAlign: 'center', maxWidth: 140 }}>Signed by iHYPE · scan with venue app</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>All my tickets</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em' }}>{data.tickets.length} active</div>
            </div>
            {data.tickets.map(tk => (
              <div key={tk.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 3, height: 40, background: 'var(--accent)', borderRadius: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{tk.showName}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{tk.date}</div>
                </div>
                {[['SEAT', tk.seat], ['PAID', `$${tk.price}`]].map(([l, v]) => (
                  <div key={l} style={{ minWidth: 80 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{v}</div>
                  </div>
                ))}
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.05em' }}>{tk.code}</div>
                <div style={{
                  padding: '4px 10px', border: `1px solid ${tk.status === 'CONFIRMED' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)'}`,
                  borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.08em',
                  color: tk.status === 'CONFIRMED' ? '#22e5d4' : '#ffb84a',
                }}>{tk.status}</div>
                <button style={{ color: 'var(--ink-3)', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcArrow s={12} /></button>
              </div>
            ))}
            {data.tickets.length === 0 && (
              <div style={{ padding: 24, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>No tickets yet — browse events above.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'selling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { l: 'TICKETS SOLD', v: data.shows.reduce((a,s) => a + s.sold, 0).toString(), d: 'across all shows', c: '#22e5d4' },
              { l: 'GROSS', v: `$${data.shows.reduce((a,s) => a + s.sold * s.price, 0).toFixed(0)}`, d: 'this period', c: '#22e5d4' },
              { l: 'YOUR SHARE · 45%', v: `$${(data.shows.reduce((a,s) => a + s.sold * s.price, 0) * 0.45).toFixed(0)}`, d: '+ $0 platform fee', c: '#ff5029' },
              { l: 'PAYOUT PENDING', v: `$${(data.shows.reduce((a,s) => a + s.sold * s.price, 0) * 0.45).toFixed(0)}`, d: 'next release', c: '#ffb84a' },
            ].map(s => <StatCard key={s.l} label={s.l} value={s.v} delta={s.d} color={s.c} />)}
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Shows on sale</div>
              <button style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>＋ New show</button>
            </div>
            {data.shows.map(s => {
              const pct = s.capacity > 0 ? (s.sold / s.capacity) * 100 : 0;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 3, height: 40, background: '#22e5d4', borderRadius: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{s.name} <span style={{ color: 'var(--ink-3)' }}>· {s.venue}</span></div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{s.date} · {s.time}</div>
                  </div>
                  <div style={{ minWidth: 90 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 4 }}>SOLD</div>
                    <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, position: 'relative', overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: pct > 85 ? '#ffb84a' : '#22e5d4', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)' }}>{s.sold} / {s.capacity}</div>
                  </div>
                  <div style={{ minWidth: 60 }}><div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>PRICE</div><div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>${s.price}</div></div>
                  <div style={{ minWidth: 80 }}><div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>GROSS</div><div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>${(s.sold * s.price).toLocaleString()}</div></div>
                  <button style={{ padding: '7px 12px', border: '1px solid var(--line-2)', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', background: 'none', cursor: 'pointer' }}>Manage →</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'scan' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, padding: 24, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-2)' }}>
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: '#22e5d4', marginBottom: 10 }}>● VENUE MODE · GATE 1</div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '8px 0', color: 'var(--ink)' }}>Door scanner</h2>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: 480, lineHeight: 1.5 }}>Point a phone camera at the QR. Valid tickets show green; replays are blocked at the protocol layer.</p>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { code: 'iH-XX-K3X9', meta: 'GA · admitted 21:04', status: 'VALID', ok: true },
                { code: 'iH-XX-7QQR', meta: 'Transferred 14m ago · GA · admitted 21:06', status: 'VALID', ok: true },
                { code: 'iH-XX-9BLN', meta: 'Already scanned at 20:51 · blocked', status: 'REPLAY', ok: false },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 6, borderLeft: `2px solid ${r.ok ? '#22e5d4' : '#ff5029'}` }}>
                  {r.ok ? <IcCheck s={14} /> : <span style={{ fontSize: 14 }}>⨯</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink)', letterSpacing: '.04em' }}>{r.code}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{r.meta}</div>
                  </div>
                  <div style={{ color: r.ok ? '#22e5d4' : '#ff5029', fontFamily: 'var(--f-m)', fontSize: 11 }}>{r.status}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ aspectRatio: '1', background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 10, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 30, border: '2px solid rgba(34,229,212,.5)', borderRadius: 4 }} />
              <div style={{ position: 'absolute', left: 30, right: 30, top: '50%', height: 1, background: '#22e5d4', boxShadow: '0 0 16px #22e5d4' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.1em' }}>Ready for QR…</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-3)' }}>
              {[['ADMITTED', '148', 'var(--ink)'], ['WAITING', '23', 'var(--ink)'], ['BLOCKED', '2', '#ff5029']].map(([l, v, c]) => (
                <div key={l}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// ViewLibrary (stub)
// ─────────────────────────────────────────────────────────────
function ViewLibrary({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: '#b983ff', marginBottom: 10 }}>● YOUR SAVED TRACKS · {data.tracks.length} SONGS · 18 PLAYLISTS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Library</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Everything you've HYPEd, saved from Discover seeds, or curated. Your library is yours.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { n: 'HYPEd tracks', c: '#ff3e9a', count: data.tracks.length },
          { n: 'Saved from seeds', c: '#ff5029', count: Math.floor(data.tracks.length * 0.4) },
          { n: 'Writing room', c: '#b983ff', count: 42 },
          { n: 'Tour van', c: '#22e5d4', count: 88 },
        ].map(p => (
          <div key={p.n} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', cursor: 'pointer' }}>
            <div style={{ aspectRatio: '1', borderRadius: 6, background: `linear-gradient(135deg, ${p.c}, ${p.c}80)`, marginBottom: 10 }} />
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.n}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>{p.count} tracks</div>
          </div>
        ))}
      </div>
      <Panel title="Recent tracks">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, padding: '14px 16px' }}>
          {data.tracks.map((t, i) => <TrackCard key={t.id} track={t} active={i === currentIdx} onClick={() => onPickTrack(i)} />)}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewDiscover (stub)
// ─────────────────────────────────────────────────────────────
function ViewDiscover({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● DISCOVER · SEEDS · NEW ARTISTS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Discover</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Swipe through 15–30 second seeds from new artists. Right to save, left to skip, up to HYPE.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        {data.tracks.map((t, i) => <TrackCard key={t.id} track={t} active={i === currentIdx} onClick={() => onPickTrack(i)} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewStudio (stub)
// ─────────────────────────────────────────────────────────────
function ViewStudio({ data }: { data: WorkbenchData }) {
  const payout = data.lifeStats?.totalEarnings ?? 0;
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● STUDIO · SHOW CREATOR · UPLOADS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Studio</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Upload tracks, build radio shows, track payouts. 45% of every ticket to you, always.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="Uploads">
          <div style={{ padding: '4px 0' }}>
            {data.tracks.slice(0, 4).map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 5, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t.title}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{t.artistName} · {t.duration}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff3e9a' }}>
                  <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '24px 28px' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.16em', color: 'var(--ink-3)', marginBottom: 8 }}>PAYOUT PENDING</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.025em', color: 'var(--ink)' }}>${payout.toLocaleString()}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ffb84a', letterSpacing: '.04em', marginTop: 6 }}>pending · next release</div>
          <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.04em' }}>
            45% tickets · 45% venue · 10% referrer · $0 platform fee
          </div>
          <button style={{ marginTop: 14, width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>
            + New show
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewSettings
// ─────────────────────────────────────────────────────────────
function ViewSettings({ prefs, setPref, data, onBack }: {
  prefs: typeof DEFAULT_PREFS;
  setPref: (k: string, v: unknown) => void;
  data: WorkbenchData;
  onBack?: () => void;
}) {
  const ACCENTS = [
    { v: '#ff5029', label: 'Ember' }, { v: '#ff3e9a', label: 'Hot pink' },
    { v: '#b983ff', label: 'Lilac' }, { v: '#22e5d4', label: 'Aqua' },
    { v: '#ffb84a', label: 'Amber' }, { v: '#7fb3ff', label: 'Sky' },
  ];
  const PIN_TOOLS = [
    { k: 'library', label: 'Library', sub: 'HYPEd tracks, playlists', icon: <IcLibrary s={18} /> },
    { k: 'radio', label: 'Radio', sub: 'Tune in to shows', icon: <IcRadio s={18} /> },
    { k: 'tickets', label: 'Live Events', sub: 'Browse, hold, sell, scan', icon: <IcTicket s={18} /> },
    { k: 'discover', label: 'Discover', sub: 'Seeds · swipe new artists', icon: <IcDisco s={18} /> },
    { k: 'studio', label: 'Studio', sub: 'Show Creator · uploads', icon: <IcStudio s={18} /> },
  ];

  return (
    <div style={{ padding: '24px 32px 32px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-3)', marginBottom: 10 }}>● PERSONAL · APPLIES TO THIS BROWSER</div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Settings <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>· page customization</span></h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 580, lineHeight: 1.5 }}>Make iHYPE feel like yours. Changes apply live.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onBack && (
            <button onClick={onBack} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.04em', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
          )}
          <button onClick={() => setPref('__reset__', null)} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.04em', background: 'none', cursor: 'pointer' }}>Reset to defaults</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Accent */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Accent color</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>Used for highlights, the player, and active nav.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {ACCENTS.map(c => (
              <button key={c.v} onClick={() => setPref('accent', c.v)} style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                border: `1px solid ${prefs.accent === c.v ? c.v : 'var(--line)'}`,
                borderRadius: 8, background: 'var(--bg-3)', transition: 'all .15s', textAlign: 'left', cursor: 'pointer',
                boxShadow: prefs.accent === c.v ? `0 0 0 1px ${c.v}80` : 'none',
              }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: c.v, flexShrink: 0 }} />
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink)', letterSpacing: '.04em' }}>{c.label}</div>
                {prefs.accent === c.v && <div style={{ position: 'absolute', top: 6, right: 6, color: c.v }}><IcCheck s={11} /></div>}
              </button>
            ))}
          </div>
        </section>

        {/* Density */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Density</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>Tighter = more on screen. Comfortable = more breathing room.</div>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-3)', borderRadius: 7, border: '1px solid var(--line)' }}>
            {[['compact','Compact'],['cozy','Cozy'],['comfy','Comfortable']].map(([k,l]) => (
              <button key={k} onClick={() => setPref('density', k)} style={{
                flex: 1, padding: '8px 10px', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.04em', border: 'none', cursor: 'pointer',
                background: prefs.density === k ? 'var(--bg)' : 'transparent',
                color: prefs.density === k ? 'var(--ink)' : 'var(--ink-3)',
              }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {[
              { k: 'queueRail', l: 'Show the queue rail', s: 'Right-hand sidebar. Off frees up ~300px.' },
              { k: 'stickyDock', l: 'Sticky player dock', s: 'Always show the player at the bottom.' },
            ].map(opt => (
              <div key={opt.k} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{opt.l}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{opt.s}</div>
                </div>
                <Toggle on={(prefs as Record<string, unknown>)[opt.k] as boolean} onChange={v => setPref(opt.k, v)} />
              </div>
            ))}
          </div>
        </section>

        {/* Pinned tools — span 2 */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px', gridColumn: 'span 2' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Pinned tools</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>What shows in the left rail. Home and Settings are always present.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PIN_TOOLS.map(t => {
              const pinned = prefs.pinned.includes(t.k);
              return (
                <button key={t.k} onClick={() => setPref('togglePin', t.k)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: `1px solid ${pinned ? `${prefs.accent}50` : 'var(--line)'}`,
                  borderRadius: 8, transition: 'all .15s', cursor: 'pointer',
                  background: pinned ? `${prefs.accent}08` : 'var(--bg-3)',
                }}>
                  <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, background: 'var(--bg-2)', color: pinned ? prefs.accent : 'var(--ink-3)' }}>{t.icon}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t.label}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.02em', marginTop: 2 }}>{t.sub}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', border: `1px solid ${pinned ? `${prefs.accent}40` : 'var(--line-2)'}`, borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.04em', color: pinned ? prefs.accent : 'var(--ink-3)' }}>
                    {pinned ? <><IcCheck s={11} /> pinned</> : 'pin'}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Home panels — span 2 */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px', gridColumn: 'span 2' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Home page panels</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>What appears on Home below the greeting.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { k: 'panel_stats', l: 'Stat row', d: 'Hype, sales, plays, payouts' },
              { k: 'panel_tonight', l: 'Tonight in Chicago', d: 'Local shows + capacity bars' },
              { k: 'panel_activity', l: 'Activity feed', d: 'Hypes, payouts, bookings' },
              { k: 'panel_hyped', l: 'Hyped this week', d: '6-up grid of trending tracks' },
              { k: 'panel_roles', l: 'Your roles', d: 'Active + add new' },
            ].map(p => (
              <label key={p.k} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                border: `1px solid ${(prefs as Record<string,unknown>)[p.k] ? `${prefs.accent}40` : 'var(--line)'}`,
                borderRadius: 8, background: 'var(--bg-3)', cursor: 'pointer',
              }}>
                <Toggle on={(prefs as Record<string,unknown>)[p.k] as boolean} onChange={v => setPref(p.k, v)} small />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{p.l}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{p.d}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* City */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>City + scene</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>Used everywhere — "Tonight in", radio picks, discover defaults.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select value={prefs.city} onChange={e => setPref('city', e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink)' }}>
              {['Chicago, IL','Brooklyn, NY','Los Angeles, CA','Austin, TX','Detroit, MI','Atlanta, GA'].map(c => <option key={c}>{c}</option>)}
            </select>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em' }}>· current</span>
          </div>
        </section>

        {/* Greeting */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Greeting style</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>The big line at the top of Home.</div>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-3)', borderRadius: 7, border: '1px solid var(--line)' }}>
            {[['warm','Warm name'],['minimal','Minimal'],['data','Data first']].map(([k,l]) => (
              <button key={k} onClick={() => setPref('greeting', k)} style={{
                flex: 1, padding: '8px 10px', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.04em', border: 'none', cursor: 'pointer',
                background: prefs.greeting === k ? 'var(--bg)' : 'transparent',
                color: prefs.greeting === k ? 'var(--ink)' : 'var(--ink-3)',
              }}>{l}</button>
            ))}
          </div>
        </section>
      </div>

      <div style={{ marginTop: 20, padding: '14px 18px', border: '1px dashed var(--line-2)', borderRadius: 8, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.02em' }}>
        Preferences live in this browser. Sign in to sync across devices — keys never leave your control.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// StarterPack type (for compat with home/page.tsx)
// ─────────────────────────────────────────────────────────────
export type StarterPackItem = {
  id: string; name: string; slug: string; hypeCount: number; city: string | null; genre: string | null;
};

// ─────────────────────────────────────────────────────────────
// Main WorkbenchShell export
// ─────────────────────────────────────────────────────────────
export function WorkbenchShell({ data, starterPack = [] }: { data: WorkbenchData; starterPack?: StarterPackItem[] }) {
  const [view, setView] = useState<View>('me');
  const [prevView, setPrevView] = useState<View>('me');
  const navigateTo = (v: View) => { if (v !== view) setPrevView(view); setView(v); };
  const [prefs, setPrefs] = useState<typeof DEFAULT_PREFS>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);

  // Tracks for player
  const tracks = data.tracks.length > 0 ? data.tracks : [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Load prefs from localStorage after mount
  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
  }, []);

  // Apply prefs as CSS vars
  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem('ihype-prefs-v2', JSON.stringify(prefs)); } catch {}
    const root = document.documentElement;
    root.style.setProperty('--accent', prefs.accent);
    root.style.setProperty('--accent-2', shiftAccent(prefs.accent));
    const densMap: Record<string, number> = { compact: 0.85, cozy: 1, comfy: 1.15 };
    root.style.setProperty('--density', String(densMap[prefs.density] ?? 1));
    root.style.setProperty('--rail-w', '0px');
    root.style.setProperty('--queue-w', prefs.queueRail ? '300px' : '0px');
    root.style.setProperty('--player-h', prefs.density === 'compact' ? '58px' : '64px');
    root.style.setProperty('--top-h', '60px');
  }, [prefs, mounted]);

  // Player tick
  useEffect(() => {
    if (!playing || tracks.length === 0) return;
    const track = tracks[currentIdx];
    if (!track) return;
    const iv = setInterval(() => {
      setProgress(p => {
        const next = p + 1 / track.durationSec;
        if (next >= 1) {
          setCurrentIdx(ci => (ci + 1) % tracks.length);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [playing, currentIdx, tracks]);

  const setPref = useCallback((key: string, val: unknown) => {
    setPrefs(p => {
      if (key === '__reset__') return DEFAULT_PREFS;
      if (key === 'togglePin') {
        const v = val as string;
        const next = p.pinned.includes(v) ? p.pinned.filter(x => x !== v) : [...p.pinned, v];
        return { ...p, pinned: next };
      }
      return { ...p, [key]: val };
    });
  }, []);

  const onPickTrack = useCallback((i: number) => { setCurrentIdx(i); setPlaying(true); }, []);
  const onNext = useCallback(() => { setCurrentIdx(ci => (ci + 1) % tracks.length); setProgress(0); }, [tracks.length]);
  const onPrev = useCallback(() => { setCurrentIdx(ci => (ci - 1 + tracks.length) % tracks.length); setProgress(0); }, [tracks.length]);

  // Seeds state
  const [seedPlaying, setSeedPlaying] = useState(false);
  const [seedCardIdx, setSeedCardIdx] = useState(0);
  const onSeedSave = useCallback((idx: number) => {
    setCurrentIdx(idx);
    setPlaying(true);
    setSeedCardIdx(ci => ci + 1);
    setSeedPlaying(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (view === 'seeds') {
        if (e.key === 'ArrowLeft')  { setSeedCardIdx(ci => ci + 1); setSeedPlaying(false); }
        if (e.key === 'ArrowUp')    { onSeedSave(seedCardIdx % Math.max(tracks.length, 1)); }
        if (e.key === ' ')          { e.preventDefault(); setSeedPlaying(p => !p); }
        if (e.key === 'ArrowRight') { setSeedCardIdx(ci => Math.max(0, ci - 1)); }
      } else {
        if (e.key === ' ')         { e.preventDefault(); setPlaying(p => !p); }
        if (e.key === 'ArrowRight') { onNext(); }
        if (e.key === 'ArrowLeft')  { onPrev(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, seedCardIdx, tracks.length, onSeedSave, onNext, onPrev]);

  const track = tracks[currentIdx] ?? tracks[0];
  const showDock = prefs.stickyDock && track;

  // Seeds view renders its own full-height column layout (no queue rail, dock below)
  const isSeeds = view === 'seeds';

  // Grid: just topbar | main | dock (no sidebar, optional queue rail on non-seeds views)
  const showQueue = prefs.queueRail && tracks.length > 0 && !isSeeds;
  const colTemplate = showQueue ? '1fr var(--queue-w)' : '1fr';
  const rowTemplate = showDock ? 'var(--top-h) 1fr var(--player-h)' : 'var(--top-h) 1fr';

  const viewEl = (() => {
    switch (view) {
      case 'me':       return <ViewMyPage data={data} onPickTrack={onPickTrack} currentIdx={currentIdx} />;
      case 'seeds':    return <ViewSeeds data={data} seedPlaying={seedPlaying} setSeedPlaying={setSeedPlaying} seedCardIdx={seedCardIdx} onSave={onSeedSave} />;
      case 'radio':    return <ViewRadio data={data} onPickTrack={onPickTrack} />;
      case 'studio':   return <ViewStudio data={data} />;
      case 'tickets':  return <ViewTickets data={data} />;
      case 'settings': return <ViewSettings prefs={prefs} setPref={setPref} data={data} onBack={() => navigateTo(prevView)} />;
      default:         return <ViewMyPage data={data} onPickTrack={onPickTrack} currentIdx={currentIdx} />;
    }
  })();

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes eq { 0%,100% { height: 3px; } 50% { height: 10px; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        .wb-view-anim { animation: fadeIn .35s ease-out both; }
      `}</style>
      <div
        className="wb-shell"
        style={{
          position: 'fixed', inset: 0, display: 'grid',
          gridTemplateColumns: colTemplate,
          gridTemplateRows: rowTemplate,
          background: 'var(--bg)',
          fontFamily: 'var(--f-b)',
          color: 'var(--ink)',
        }}
      >
        {/* Topbar with integrated tabs — spans all columns */}
        <div style={{ gridColumn: '1 / -1', gridRow: 1 }}>
          <AppTopbar
            view={view}
            setView={navigateTo}
            listeningNow={data.listeningNow}
            initials={data.userInitials}
            userName={data.userName}
            activeProfileTypes={data.activeProfileTypes}
            onSettings={() => navigateTo('settings')}
          />
        </div>

        {/* Main content */}
        <main style={{
          gridColumn: 1, gridRow: 2,
          overflowY: isSeeds ? 'hidden' : 'auto',
          overflowX: 'hidden',
          background: 'var(--bg)', minHeight: 0,
          fontSize: `calc(14px * var(--density, 1))`,
          position: 'relative',
        }}>
          {/* Radial glow at top */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, background: 'radial-gradient(ellipse at 50% -50%, rgba(255,80,41,.07), transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />
          <div key={view} className="wb-view-anim" style={{ position: 'relative', zIndex: 1 }}>
            {viewEl}
          </div>
        </main>

        {/* Queue rail (non-seeds views only) */}
        {showQueue && (
          <QueueRail tracks={tracks} currentIdx={currentIdx} onPick={onPickTrack} />
        )}

        {/* Player dock */}
        {showDock && track && (
          <PlayerDock
            track={track}
            playing={playing}
            onToggle={() => setPlaying(p => !p)}
            onNext={onNext}
            onPrev={onPrev}
            progress={progress}
            setProgress={setProgress}
          />
        )}
      </div>
    </>
  );
}
