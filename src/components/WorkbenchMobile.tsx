'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkbenchData, WbTrack } from './WorkbenchShell';

// ─── Design tokens (match Workbench Mobile design) ───────────
const T = {
  bg:     '#0a0805',
  bg2:    '#100d09',
  bg3:    '#1a1612',
  bg4:    '#221c16',
  ink:    '#f0ebe5',
  ink2:   '#9e9080',
  ink3:   '#5a5048',
  ink4:   '#3a342e',
  line:   'rgba(255,255,255,.06)',
  line2:  'rgba(255,255,255,.14)',
  accent: '#ff5029',
  pink:   '#ff3e9a',
  teal:   '#22e5d4',
  purple: '#b983ff',
  amber:  '#ffb84a',
  blue:   '#7fb3ff',
  fd: '"Syne",sans-serif',
  fb: '"DM Sans",sans-serif',
  fm: '"JetBrains Mono",monospace',
  fs: '"Instrument Serif",serif',
};

type MobileTab = 'me' | 'seeds' | 'radio' | 'studio' | 'tick';

// ─── Icons ────────────────────────────────────────────────────
const WMIcon = {
  me:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="6" r="2.5"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>,
  seeds:  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/></svg>,
  radio:  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r=".6" fill="currentColor"/></svg>,
  studio: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8h1M8 6v4M11 7v2"/></svg>,
  tick:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 6a1.5 1.5 0 0 0 0 3v3h12V9a1.5 1.5 0 0 0 0-3V3H2v3Z"/><path d="M9 3v10" strokeDasharray="1.4 1.4"/></svg>,
  search: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>,
  bell:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7a4 4 0 1 1 8 0v3l1.5 2h-11L4 10V7z"/><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"/></svg>,
};

// ─── Pill ─────────────────────────────────────────────────────
function WMPill({ children, tone = 'soft', style }: { children: React.ReactNode; tone?: string; style?: React.CSSProperties }) {
  const tones: Record<string, { bg: string; fg: string; bd: string }> = {
    soft:  { bg: T.bg3,                        fg: T.ink2,   bd: T.line2 },
    live:  { bg: 'rgba(255,80,41,.12)',         fg: T.accent, bd: 'rgba(255,80,41,.3)' },
    teal:  { bg: 'rgba(34,229,212,.1)',         fg: T.teal,   bd: 'rgba(34,229,212,.3)' },
    pink:  { bg: 'rgba(255,62,154,.1)',         fg: T.pink,   bd: 'rgba(255,62,154,.3)' },
    amber: { bg: 'rgba(255,184,74,.1)',         fg: T.amber,  bd: 'rgba(255,184,74,.3)' },
  };
  const t = tones[tone] ?? tones.soft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 7px', borderRadius: 99,
      fontFamily: T.fm, fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, ...style,
    }}>{children}</span>
  );
}

// ─── Chip button ─────────────────────────────────────────────
function WMChip({ children, accent = false, style }: { children: React.ReactNode; accent?: boolean; style?: React.CSSProperties }) {
  return (
    <button style={{
      padding: '7px 11px', borderRadius: 7, fontFamily: T.fm, fontSize: 10, fontWeight: 600,
      letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer',
      background: accent ? T.ink : 'transparent', color: accent ? T.bg : T.ink2,
      border: accent ? `1px solid ${T.ink}` : `1px solid ${T.line2}`,
      display: 'inline-flex', alignItems: 'center', gap: 6, ...style,
    }}>{children}</button>
  );
}

// ─── View header ──────────────────────────────────────────────
function WMViewHead({ eyebrow, title, italic, sub, actions }: {
  eyebrow: string; title: string; italic?: string; sub?: string; actions?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
      <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{eyebrow}</div>
      <h1 style={{ fontFamily: T.fd, fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1, fontSize: 28, margin: 0 }}>
        {title}{italic && <em style={{ fontFamily: T.fs, fontStyle: 'italic', fontWeight: 400, color: T.ink2 }}> {italic}</em>}
      </h1>
      {sub && <p style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 14, color: T.ink2, marginTop: 6, lineHeight: 1.35 }}>{sub}</p>}
      {actions && <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────
function WMCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {children}
    </div>
  );
}

// ─── EQ animated bars ─────────────────────────────────────────
const eqCss = `
@keyframes wm-eq1{0%,100%{height:3px}50%{height:10px}}
@keyframes wm-eq2{0%,100%{height:5px}50%{height:8px}}
@keyframes wm-eq3{0%,100%{height:4px}50%{height:11px}}
@keyframes wm-pulse{0%,100%{opacity:1}50%{opacity:.3}}
.wm-eq-bar:nth-child(1){animation:wm-eq1 1.1s infinite}
.wm-eq-bar:nth-child(2){animation:wm-eq2 .9s infinite}
.wm-eq-bar:nth-child(3){animation:wm-eq3 1.3s infinite}
.wm-pulse{animation:wm-pulse 1.6s infinite}
.wm-scroll::-webkit-scrollbar{display:none}
`;

// ─── Top bar ─────────────────────────────────────────────────
function WMTopBar({ tab, listeningNow, userName, initials }: {
  tab: MobileTab; listeningNow: number; userName: string; initials: string;
}) {
  const titles: Record<MobileTab, string> = {
    me: 'my page', seeds: 'seeds', radio: 'radio', studio: 'studio', tick: 'tickets',
  };
  return (
    <header style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 10,
      padding: '10px 18px 12px', background: T.bg2, borderBottom: `1px solid ${T.line}`,
      flexShrink: 0, position: 'relative', zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8,
          background: `linear-gradient(135deg,${T.accent},${T.pink})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fd, fontWeight: 800, fontSize: 12, color: T.bg, letterSpacing: '-.02em', position: 'relative',
        }}>
          iH
          <span style={{ position: 'absolute', top: 4, right: 6, width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />
        </span>
        <span>
          <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 15, letterSpacing: '-.03em', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 1, color: T.ink }}>
            iHYPE<span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: T.accent, transform: 'translateY(-7px)' }} />
          </span>
          <span style={{ display: 'block', fontFamily: T.fm, fontSize: 8, color: T.ink3, letterSpacing: '.18em', marginTop: 2, textTransform: 'uppercase' }}>
            {titles[tab]}
          </span>
        </span>
      </div>

      <div style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fm, fontSize: 10, color: T.ink2 }}>
        <span className="wm-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal, boxShadow: `0 0 8px ${T.teal}`, display: 'inline-block' }} />
        {listeningNow.toLocaleString()}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: `1px solid ${T.line}`, color: T.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
          <span style={{ width: 14, height: 14 }}>{WMIcon.search}</span>
        </button>
        <button style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: `1px solid ${T.line}`, color: T.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, position: 'relative' }}>
          <span style={{ width: 14, height: 14 }}>{WMIcon.bell}</span>
          <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%', background: T.accent }} />
        </button>
        <span style={{
          width: 30, height: 30, borderRadius: '50%',
          background: `linear-gradient(135deg,${T.pink},${T.accent})`,
          color: T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '-.02em',
        }}>{initials}</span>
      </div>
    </header>
  );
}

// ─── Mini Player ─────────────────────────────────────────────
function WMMiniPlayer({ track, playing, onToggle, progress }: {
  track: WbTrack; playing: boolean; onToggle: () => void; progress: number;
}) {
  return (
    <div style={{
      position: 'relative', padding: '8px 12px', background: T.bg2, borderTop: `1px solid ${T.line2}`,
      display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 10, alignItems: 'center', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${T.accent},${T.pink},transparent)`, opacity: .6 }} />
      <div style={{
        width: 40, height: 40, borderRadius: 7, background: `linear-gradient(135deg,${track.color},${track.color}80)`,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%,rgba(255,255,255,.3),transparent 60%)' }} />
        {playing && (
          <div style={{ position: 'absolute', bottom: 5, left: 5, display: 'flex', gap: 2, alignItems: 'flex-end', height: 9 }}>
            {[0, 1, 2].map(i => (
              <span key={i} className="wm-eq-bar" style={{ width: 2, background: '#fff', borderRadius: 99, display: 'block', height: 4 }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13, letterSpacing: '-.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{track.title}</div>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink2, marginTop: 2, letterSpacing: '.04em' }}>{track.artistName} <span style={{ color: T.ink4 }}>·</span> {track.album}</div>
        <div style={{ marginTop: 5, height: 2, borderRadius: 99, background: 'rgba(255,255,255,.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: `linear-gradient(90deg,${T.accent},${T.pink})`, borderRadius: 99 }} />
        </div>
      </div>
      <button style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
        border: `1px solid rgba(255,62,154,.3)`, borderRadius: 99, color: T.pink,
        fontFamily: T.fm, fontSize: 10, fontWeight: 600, background: 'rgba(255,62,154,.05)', cursor: 'pointer',
      }}>♥ {track.hypeCount}</button>
      <button onClick={onToggle} style={{
        width: 36, height: 36, borderRadius: '50%', background: T.ink, color: T.bg,
        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        {playing
          ? <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>
          : <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 3v10l10-5z"/></svg>}
      </button>
    </div>
  );
}

// ─── Bottom Tab Bar ──────────────────────────────────────────
function WMBottomTabs({ tab, onTab }: { tab: MobileTab; onTab: (t: MobileTab) => void }) {
  const items: { id: MobileTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'me',     label: 'Me',      icon: WMIcon.me },
    { id: 'seeds',  label: 'Seeds',   icon: WMIcon.seeds,  badge: '12' },
    { id: 'radio',  label: 'Radio',   icon: WMIcon.radio,  badge: 'LIVE' },
    { id: 'studio', label: 'Studio',  icon: WMIcon.studio },
    { id: 'tick',   label: 'Tickets', icon: WMIcon.tick,   badge: '3' },
  ];
  return (
    <nav style={{ display: 'flex', background: T.bg2, borderTop: `1px solid ${T.line}`, padding: '4px 6px 8px', gap: 2, flexShrink: 0 }}>
      {items.map(it => {
        const on = tab === it.id;
        return (
          <button key={it.id} onClick={() => onTab(it.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', color: on ? T.ink : T.ink3,
            fontFamily: T.fb, fontSize: 10, fontWeight: 600, letterSpacing: '-.005em',
            padding: '6px 0 4px', cursor: 'pointer', position: 'relative',
          }}>
            {on && <span style={{ position: 'absolute', top: 0, width: 24, height: 2, borderRadius: '0 0 2px 2px', background: T.accent, boxShadow: `0 0 8px ${T.accent}` }} />}
            <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {it.icon}
              {it.badge && (
                <span style={{
                  position: 'absolute', top: -4, right: -9, fontSize: 7, fontWeight: 800,
                  padding: '1px 4px', borderRadius: 99, letterSpacing: '.06em',
                  background: it.badge === 'LIVE' ? 'rgba(255,80,41,.18)' : T.bg3,
                  color: it.badge === 'LIVE' ? T.accent : T.ink2,
                  fontFamily: T.fm, border: `1px solid ${it.badge === 'LIVE' ? 'rgba(255,80,41,.4)' : T.line2}`,
                }}>{it.badge}</span>
              )}
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Screen: Me ──────────────────────────────────────────────
function ScreenMe({ data }: { data: WorkbenchData }) {
  return (
    <>
      {/* Hero portrait card */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg,${T.bg2},${T.bg3})`,
          border: `1px solid ${T.line2}`, borderRadius: 16, padding: 18,
        }}>
          <div style={{ position: 'absolute', top: '-40%', right: '-20%', width: '70%', height: '200%', background: `radial-gradient(ellipse,rgba(255,80,41,.22),transparent 60%)`, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', position: 'relative', zIndex: 2 }}>
            <div style={{
              width: 90, height: 90, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg,${T.accent},${T.pink},${T.purple})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 36, color: T.bg, letterSpacing: '-.04em', mixBlendMode: 'overlay', opacity: .85 }}>{data.userInitials}</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap' }}>
                {data.activeProfileTypes.includes('LISTENER') && <WMPill><span style={{ width: 5, height: 5, borderRadius: '50%', background: T.purple, display: 'inline-block' }} />FAN</WMPill>}
                {data.activeProfileTypes.includes('ARTIST') && <WMPill><span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />ARTIST</WMPill>}
                <WMPill tone="amber">⚡ LV 14</WMPill>
              </div>
              <h1 style={{ fontFamily: T.fd, fontWeight: 800, letterSpacing: '-.025em', lineHeight: .95, fontSize: 30, margin: 0, color: T.ink }}>{data.userName}</h1>
              <p style={{ fontFamily: T.fm, fontSize: 10, color: T.ink2, letterSpacing: '.08em', marginTop: 6 }}>@{data.userName.toLowerCase().replace(/\s/g, '.')} · {data.city}</p>
            </div>
          </div>
          <p style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 14, color: T.ink2, marginTop: 14, lineHeight: 1.4, position: 'relative', zIndex: 2 }}>
            "Halflight EP out now. Writing the next thing in a basement on Western Ave. Recommendations open."
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${T.line}` }}>
            {[
              { v: (data.lifeStats?.totalHype ?? 1284).toLocaleString(), k: 'Given', accent: true },
              { v: '842', k: 'Received' },
              { v: String(data.lifeStats?.eventsAttended ?? 23), k: 'Shows' },
              { v: '7', k: 'Top-5' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: T.fd, fontWeight: 800, letterSpacing: '-.025em', fontSize: 18, color: s.accent ? T.accent : T.ink }}>{s.v}</div>
                <div style={{ fontFamily: T.fm, fontSize: 8, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 3 }}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pulse stat tiles — horizontal scroll */}
      <div style={{ padding: '16px 0 6px' }}>
        <div style={{ padding: '0 18px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 13, color: T.ink }}>Pulse</div>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>this week</div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 18px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[
            { k: 'Weekly listens', v: '2,284', d: '↑ 18%', c: T.teal },
            { k: 'Save rate',      v: '26%',   d: '88 saves', c: T.accent },
            { k: 'Next payout',   v: '$2,460', d: 'Jun 24',   c: T.amber },
            { k: 'Next show',     v: 'Jun 18', d: 'Empty Bottle', c: T.pink },
          ].map((t, i) => (
            <div key={i} style={{ flex: '0 0 142px', background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 13px' }}>
              <div style={{ fontFamily: T.fm, fontSize: 8, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase' }}>{t.k}</div>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.025em', marginTop: 5, color: t.c }}>{t.v}</div>
              <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink2, marginTop: 3, letterSpacing: '.04em' }}>{t.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 */}
      <div style={{ padding: '14px 18px 0' }}>
        <WMCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Top 5 — this week</div>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>Sundays</div>
          </div>
          {data.tracks.slice(0, 5).map((t, i) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '18px 34px 1fr auto', gap: 10, alignItems: 'center' }}>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: T.ink3, textAlign: 'center' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ width: 34, height: 34, borderRadius: 5, background: `linear-gradient(135deg,${t.color},${t.color}80)`, display: 'block' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{t.title}</div>
                <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.04em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artistName} · {t.album}</div>
              </div>
              <span style={{ fontFamily: T.fm, fontSize: 10, color: T.pink, fontWeight: 600, whiteSpace: 'nowrap' }}>♥ {t.hypeCount}</span>
            </div>
          ))}
        </WMCard>
      </div>

      {/* Activity */}
      <div style={{ padding: '14px 18px 24px' }}>
        <WMCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Recent activity</div>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>24h</div>
          </div>
          {data.activity.slice(0, 5).map((a, i, arr) => {
            const dotColors: Record<string, string> = { hype: T.pink, show: T.teal, radio: T.pink, payout: T.amber };
            const ic: Record<string, string> = { hype: '♥', show: '★', radio: '📻', payout: '$', default: '↗' };
            const c = dotColors[a.kind] ?? T.purple;
            return (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px dashed ${T.line}` }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  background: `${c}22`, color: c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.fm, fontSize: 11, fontWeight: 700,
                }}>{ic[a.kind] ?? '↗'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink, lineHeight: 1.35 }}>{a.text}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em', marginTop: 2 }}>{a.time}</div>
                </div>
              </div>
            );
          })}
        </WMCard>
      </div>
    </>
  );
}

// ─── Screen: Seeds ───────────────────────────────────────────
function ScreenSeeds({ data }: { data: WorkbenchData }) {
  const tracks = data.tracks;
  const waveform = [30, 55, 80, 42, 90, 70, 48, 88, 62, 35, 78, 55, 92, 40, 68, 82, 48, 30, 62, 88];

  // Swipe / drag state
  const [cardIdx, setCardIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const totalTracks = tracks.length;
  const front = tracks[cardIdx % totalTracks];
  const behind = [
    tracks[(cardIdx + 2) % totalTracks],
    tracks[(cardIdx + 1) % totalTracks],
  ];

  function advanceCard() {
    setCardIdx(i => i + 1);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setDragX(0);
    setDragY(0);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || !dragStart.current) return;
    setDragX(e.clientX - dragStart.current.x);
    setDragY(e.clientY - dragStart.current.y);
  }

  function handlePointerUp() {
    if (isDragging) {
      if (dragX > 80) {
        // hype
        advanceCard();
      } else if (dragX < -80) {
        // skip
        advanceCard();
      } else if (dragY < -80) {
        // save
        advanceCard();
      }
    }
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
    dragStart.current = null;
  }

  return (
    <>
      <WMViewHead
        eyebrow="DISCOVER · 15–30s · CHICAGO"
        title="Seeds"
        italic="— decide in 15s."
        sub="Hand-cut hooks from new uploads. Save it, hype it, skip it."
        actions={<><WMChip>⚙ Filters</WMChip><WMChip>Local · Chicago ▾</WMChip></>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Session stats */}
        <div style={{
          background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: '10px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 18,
        }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {[
              { k: 'Reviewed', v: '4/12', c: T.ink },
              { k: 'Saved',    v: '+3',   c: T.teal },
              { k: 'Hyped',    v: '2',    c: T.pink },
              { k: 'XP',       v: '+42',  c: T.amber },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: T.fm, fontSize: 8, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>{s.k}</div>
                <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: s.c, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Card stack */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '320 / 440', marginBottom: 18 }}>
          {/* behind cards */}
          {behind.map((t, i) => (
            <div key={t.id} style={{
              position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden',
              transform: `translateY(${(behind.length - i) * 10}px) scale(${.88 + i * .06})`,
              opacity: .3 + i * .25, zIndex: i,
              background: `linear-gradient(135deg,${t.color},${t.color}80)`,
              boxShadow: '0 20px 40px rgba(0,0,0,.5)',
            }} />
          ))}
          {/* front card */}
          {front && (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{
                position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', zIndex: 5,
                background: `linear-gradient(135deg,${front.color},${front.color}cc)`,
                boxShadow: '0 30px 60px -10px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.06)',
                transform: isDragging
                  ? `translateX(${dragX}px) translateY(${Math.min(0, dragY)}px) rotate(${dragX * 0.08}deg)`
                  : 'none',
                transition: isDragging ? 'none' : 'transform .3s ease',
                touchAction: 'none',
                userSelect: 'none',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}>
              {/* Gesture hint overlays */}
              {isDragging && dragX > 40 && (
                <div style={{
                  position: 'absolute', top: 18, right: 18, zIndex: 10,
                  background: 'rgba(34,229,90,.82)', color: '#fff', borderRadius: 10,
                  padding: '7px 14px', fontFamily: T.fd, fontWeight: 800, fontSize: 18,
                  letterSpacing: '-.01em', pointerEvents: 'none',
                  boxShadow: '0 4px 16px rgba(0,200,80,.4)',
                }}>HYPE ♥</div>
              )}
              {isDragging && dragX < -40 && (
                <div style={{
                  position: 'absolute', top: 18, left: 18, zIndex: 10,
                  background: 'rgba(255,60,60,.82)', color: '#fff', borderRadius: 10,
                  padding: '7px 14px', fontFamily: T.fd, fontWeight: 800, fontSize: 18,
                  letterSpacing: '-.01em', pointerEvents: 'none',
                  boxShadow: '0 4px 16px rgba(255,60,60,.4)',
                }}>SKIP ✕</div>
              )}
              {isDragging && dragY < -40 && (
                <div style={{
                  position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
                  background: 'rgba(34,229,212,.82)', color: '#fff', borderRadius: 10,
                  padding: '7px 14px', fontFamily: T.fd, fontWeight: 800, fontSize: 18,
                  letterSpacing: '-.01em', pointerEvents: 'none',
                  boxShadow: `0 4px 16px rgba(34,229,212,.4)`,
                }}>SAVE ↑</div>
              )}
              {/* stripe texture */}
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 8px,transparent 8px 16px)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 30%,rgba(255,255,255,.16),transparent 60%)' }} />
              {/* gradient overlay bottom */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.8) 100%)', zIndex: 2 }} />
              {/* tags */}
              <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', zIndex: 3 }}>
                <span style={{ padding: '4px 8px', borderRadius: 99, background: 'rgba(0,0,0,.55)', fontFamily: T.fm, fontSize: 9, letterSpacing: '.14em', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />SEED · 22s
                </span>
                <span style={{ padding: '4px 8px', borderRadius: 99, background: 'rgba(255,255,255,.18)', fontFamily: T.fm, fontSize: 9, letterSpacing: '.14em', fontWeight: 700, color: '#fff' }}>CHICAGO</span>
              </div>
              {/* waveform */}
              <div style={{ position: 'absolute', bottom: 144, left: 18, right: 18, height: 30, display: 'flex', alignItems: 'flex-end', gap: 2, zIndex: 3 }}>
                {waveform.map((h, i) => (
                  <span key={i} style={{ flex: 1, height: `${h}%`, background: 'rgba(255,255,255,.55)', borderRadius: 99, display: 'block' }} />
                ))}
              </div>
              {/* body */}
              <div style={{ position: 'absolute', bottom: 18, left: 16, right: 16, zIndex: 3, color: '#fff' }}>
                <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 26, letterSpacing: '-.025em', textShadow: '0 2px 12px rgba(0,0,0,.4)' }}>{front.title}</div>
                <div style={{ fontFamily: T.fm, fontSize: 10, color: 'rgba(255,255,255,.8)', letterSpacing: '.1em', marginTop: 4, textTransform: 'uppercase' }}>{front.artistName} · {front.album}</div>
                <div style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,.9)', marginTop: 10, lineHeight: 1.3, borderLeft: `2px solid ${T.accent}`, paddingLeft: 8 }}>
                  "It only really lands at 1:48 — that&apos;s the seed."
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontFamily: T.fm, fontSize: 9, letterSpacing: '.08em', color: 'rgba(255,255,255,.7)' }}>
                  <span>♥ {front.hypeCount} hype</span>
                  <span>48 saves · 21 skips</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Swipe controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
          {[
            { c: '#ff6b5a', bd: 'rgba(255,107,90,.4)', sz: 46, label: '✕', action: 'skip' },
            { c: T.ink2,    bd: T.line2,               sz: 42, label: '↺', action: 'replay' },
            { c: T.teal,    bd: 'rgba(34,229,212,.4)', sz: 60, label: '▶', action: 'save' },
            { c: T.pink,    bd: 'rgba(255,62,154,.4)', sz: 46, label: '♥', action: 'hype' },
          ].map((b, i) => (
            <button key={i} onClick={() => b.action !== 'replay' && advanceCard()} style={{
              width: b.sz, height: b.sz, borderRadius: '50%',
              background: T.bg2, border: `1px solid ${b.bd}`, color: b.c,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              fontFamily: T.fm, fontSize: b.sz * 0.32, fontWeight: 700,
            }}>{b.label}</button>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 18 }}>
          swipe · ↑ save · → hype
        </div>

        {/* Daily quest */}
        <WMCard style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13, letterSpacing: '-.01em', color: T.ink }}>Daily Quest · Save 5 seeds</div>
            <WMPill tone="amber">+60 XP</WMPill>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 1, 1, 0, 0].map((on, i) => (
              <span key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: on ? T.accent : T.bg3, display: 'block' }} />
            ))}
          </div>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em' }}>3 / 5 · earn Seed Curator badge</div>
        </WMCard>

        {/* Up next */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, padding: '0 4px' }}>Up next</div>
          <WMCard style={{ gap: 8 }}>
            {data.tracks.slice(1, 4).map((t, i) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 10, alignItems: 'center', opacity: i === 2 ? .5 : 1 }}>
                <div style={{ width: 38, height: 38, borderRadius: 6, background: `linear-gradient(135deg,${t.color},${t.color}80)` }} />
                <div>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12, color: T.ink }}>{t.title}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em', marginTop: 2 }}>{t.artistName} · {t.duration}s</div>
                </div>
              </div>
            ))}
          </WMCard>
        </div>

        {/* Why this seed */}
        <WMCard style={{ marginBottom: 24, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase' }}>Why this seed?</div>
          <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
            You hyped <span style={{ color: T.accent, fontWeight: 600 }}>3 tracks</span> from this artist this month — promoter test pressing from their unreleased EP.
          </div>
        </WMCard>
      </div>
    </>
  );
}

// ─── Screen: Radio ───────────────────────────────────────────
function ScreenRadio({ data }: { data: WorkbenchData }) {
  const shows = data.radioShows;
  const live = shows.find(s => s.live);
  const rest = shows.filter(s => !s.live);

  return (
    <>
      <WMViewHead
        eyebrow={`LIVE NOW · ${shows.filter(s => s.live).length || 1} SHOWS ON AIR`}
        title="Radio"
        sub="Live and prerecorded shows from DJs and artists — every spin pays the source."
        actions={<><WMChip>⌲ Schedule</WMChip><WMChip>+ New show</WMChip></>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Live hero */}
        {live && (
          <div style={{
            background: `linear-gradient(120deg,rgba(255,62,154,.22),rgba(255,80,41,.12),transparent)`,
            border: `1px solid ${T.line2}`, borderRadius: 14, padding: 16, position: 'relative', overflow: 'hidden', marginBottom: 20,
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', background: `repeating-linear-gradient(45deg,rgba(255,62,154,.06) 0 2px,transparent 2px 14px)`, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{
                width: 88, height: 88, borderRadius: 11, background: `linear-gradient(135deg,${live.color},${live.color}80)`,
                position: 'relative', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%,rgba(255,255,255,.3),transparent 60%)' }} />
                <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 36, color: T.bg, letterSpacing: '-.04em', zIndex: 2, mixBlendMode: 'overlay', opacity: .9 }}>01</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fm, fontSize: 9, color: T.accent, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' }}>
                  <span className="wm-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, boxShadow: `0 0 12px ${T.accent}`, display: 'inline-block' }} />
                  ON AIR · {live.listeners.toLocaleString()}
                </div>
                <h2 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.025em', margin: '5px 0 0', color: T.ink }}>{live.name}</h2>
                <p style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 13, color: T.ink2, margin: '3px 0 0' }}>with {live.host}</p>
              </div>
            </div>
            <div style={{
              marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 7, fontFamily: T.fm, fontSize: 11, color: T.ink,
            }}>
              <span style={{ fontStyle: 'normal', color: T.ink3, fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase' }}>NOW</span>
              <span style={{ flex: 1 }}>{data.tracks[0]?.title} — {data.tracks[0]?.artistName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontFamily: T.fm, fontSize: 10, color: T.ink2 }}>Next: <b style={{ color: T.ink }}>{data.tracks[1]?.title}</b></span>
              <button style={{
                padding: '10px 18px', borderRadius: 99, background: T.ink, color: T.bg,
                fontFamily: T.fm, fontWeight: 700, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer',
              }}>▶ Tune In</button>
            </div>
          </div>
        )}

        {/* Shows list */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 16, color: T.ink, margin: 0 }}>All shows</h2>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.08em' }}>by <span style={{ color: T.ink }}>next on air</span></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {rest.slice(0, 4).map((r, i) => (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12,
              background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 11, padding: 12, alignItems: 'flex-start',
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: `linear-gradient(135deg,${r.color},${r.color}80)` }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <h3 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, letterSpacing: '-.025em', margin: 0, color: T.ink }}>{r.name}</h3>
                    <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>with {r.host}</div>
                  </div>
                  <WMPill>{i === 0 ? 'PRERECORDED' : i === 2 ? 'YOURS' : 'WEEKLY'}</WMPill>
                </div>
                <p style={{ fontFamily: T.fb, fontSize: 11, color: T.ink2, marginTop: 8, lineHeight: 1.4 }}>{r.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.line}` }}>
                  <span style={{ fontFamily: T.fm, fontSize: 10, color: T.ink, fontWeight: 600 }}>{r.time}</span>
                  <span style={{ fontFamily: T.fm, fontSize: 8, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>{r.next}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Screen: Studio ──────────────────────────────────────────
function ScreenStudio({ data }: { data: WorkbenchData }) {
  const clips = [
    { n: '01', t: 'Intro — Welcome back',         m: 'Maya · spoken',               type: 'VOICE', d: '0:42' },
    { n: '02', t: 'Sundown',                      m: 'Maya Reyes · Halflight EP',   type: 'TRACK', d: '3:24' },
    { n: '03', t: 'Westline',                     m: 'Cobalt Hour · 15% co-host',   type: 'TRACK', d: '4:11' },
    { n: '04', t: 'Talk break — writing the bridge', m: 'Maya · 2:18',              type: 'VOICE', d: '2:18' },
    { n: '05', t: 'Underpass',                    m: 'Saint Hex · Night Architect', type: 'TRACK', d: '4:36' },
    { n: '06', t: 'Halflight',                    m: 'Maya Reyes · debut spin',     type: 'TRACK', d: '3:51' },
  ];
  const timeline = [
    { c: T.accent, f: 14, t: 'Intro' },
    { c: T.pink,   f: 18, t: 'Sundown' },
    { c: T.purple, f: 22, t: 'Westline' },
    { c: T.teal,   f: 8,  t: 'Talk' },
    { c: T.blue,   f: 20, t: 'Underpass' },
    { c: T.amber,  f: 18, t: 'Halflight' },
  ];

  return (
    <>
      <WMViewHead
        eyebrow="SHOW CREATOR · PRERECORDED RADIO"
        title="Studio"
        sub="Drag tracks into the timeline. Splits auto-calc: 45/45/10."
        actions={<><WMChip>↥ Import</WMChip><WMChip accent>⬤ Publish</WMChip></>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Composer card */}
        <div style={{ background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${T.line}` }}>
            <div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 17, color: T.ink }}>Halflight FM · Ep 05</div>
              <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.08em', marginTop: 3 }}>47:00 · 6 tracks · Sun Jun 22 · 10AM</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
              <WMPill tone="amber">SCHEDULED</WMPill>
              <WMPill>CO 15%</WMPill>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: T.bg3, borderRadius: 9, padding: 12, marginTop: 12, border: `1px solid ${T.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 8, color: T.ink3, letterSpacing: '.08em', marginBottom: 8 }}>
              <span>00:00</span><span>15:00</span><span>30:00</span><span>47:00</span>
            </div>
            <div style={{ position: 'relative', height: 46, background: T.bg4, borderRadius: 5, display: 'flex', gap: 2, padding: 3, overflow: 'hidden' }}>
              {timeline.map((c, i) => (
                <div key={i} style={{
                  flex: `0 0 ${c.f}%`, height: '100%', background: c.c, borderRadius: 3,
                  display: 'flex', alignItems: 'center', padding: '0 6px',
                  fontFamily: T.fm, fontSize: 8, fontWeight: 700, color: T.bg, letterSpacing: '.04em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative',
                }}>
                  {c.t}
                  <span style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 2px,transparent 2px 4px)' }} />
                </div>
              ))}
              {/* playhead */}
              <div style={{ position: 'absolute', top: -3, bottom: -3, left: '32%', width: 2, background: T.accent, boxShadow: `0 0 8px ${T.accent}`, zIndex: 3 }}>
                <div style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, borderRadius: '50%', background: T.accent }} />
              </div>
            </div>
          </div>

          {/* Clip list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
            {clips.map((c, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 10, alignItems: 'center',
                padding: '7px 10px', borderRadius: 6, background: T.bg3, border: `1px solid ${T.line}`,
              }}>
                <span style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, fontWeight: 700 }}>{c.n}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{c.t}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 8, color: T.ink3, letterSpacing: '.06em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.m}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: T.fm, fontSize: 7, color: T.ink2, letterSpacing: '.12em', padding: '2px 6px', borderRadius: 99, background: T.bg2, border: `1px solid ${T.line2}`, textTransform: 'uppercase', fontWeight: 700 }}>{c.type}</span>
                  <span style={{ fontFamily: T.fm, fontSize: 9, color: T.ink2 }}>{c.d}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
            <WMChip>+ Track</WMChip>
            <WMChip>⏵ Voice</WMChip>
            <WMChip style={{ marginLeft: 'auto' }} accent>Save draft</WMChip>
          </div>
        </div>

        {/* Revenue split */}
        <WMCard style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 13, color: T.ink }}>Revenue split · Ep 05</div>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>per spin</div>
          </div>
          <div style={{ height: 14, borderRadius: 99, overflow: 'hidden', background: T.bg3, display: 'flex' }}>
            <div style={{ width: '45%', background: T.accent }} />
            <div style={{ width: '30%', background: T.pink }} />
            <div style={{ width: '15%', background: T.purple }} />
            <div style={{ width: '10%', background: T.ink3 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontFamily: T.fm, fontSize: 9, color: T.ink2, letterSpacing: '.04em' }}>
            {([['Artist 45%', T.accent], ['Host 30%', T.pink], ['Co-host 15%', T.purple], ['Platform 10%', T.ink3]] as [string, string][]).map(([l, c], i) => (
              <div key={i}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, marginRight: 5, verticalAlign: 'middle' }} />{l}</div>
            ))}
          </div>
        </WMCard>

        {/* Drafts */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink, margin: 0 }}>My drafts</h2>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.08em' }}>4 total</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {[
            { t: 'Halflight FM · Ep 04', m: '8 tracks · 60:00 · 2,284 plays',   pill: ['teal',  'PUBLISHED'], r: '$184.20', g: `linear-gradient(135deg,${T.accent},${T.amber})` },
            { t: 'Halflight FM · Ep 05', m: '6 tracks · 47:00 · Sun Jun 22',    pill: ['amber', 'EDITING'],   r: 'co 15%',  g: `linear-gradient(135deg,${T.accent},${T.pink})`,  curr: true },
            { t: 'Writing room',         m: '5 tracks · 35:00 · unscheduled',   pill: ['soft',  'DRAFT'],     r: '—',       g: `linear-gradient(135deg,${T.blue},${T.bg4})` },
            { t: 'Sundown · back-half',  m: '4 tracks · 30:00 · co: DJ Vex 10%',pill: ['soft',  'DRAFT'],     r: '—',       g: `linear-gradient(135deg,${T.pink},${T.purple})` },
          ].map((d, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 10, alignItems: 'center',
              background: d.curr ? 'rgba(255,80,41,.04)' : T.bg2,
              border: `1px solid ${d.curr ? T.accent : T.line}`, borderRadius: 9, padding: 10,
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 6, background: d.g }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{d.t}</div>
                <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.m}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                <WMPill tone={d.pill[0]}>{d.pill[1]}</WMPill>
                <span style={{ fontFamily: T.fm, fontSize: 9, color: T.ink2 }}>{d.r}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Screen: Ticketing ───────────────────────────────────────
function ScreenTicketing({ data }: { data: WorkbenchData }) {
  const [subTab, setSubTab] = useState(0);
  const subTabs = ['Upcoming', 'My Tickets', 'Past', 'Sell'];

  return (
    <>
      <WMViewHead
        eyebrow="LIVE EVENTS · SERIALIZED · ON-PLATFORM RESALE"
        title="Ticketing"
        sub="Buy. Reassign anytime. 45/45/10 — artist, venue, promoter — every time."
        actions={<><WMChip>⌕ Search</WMChip><WMChip>⌖ Near Chicago ▾</WMChip></>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 2, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {subTabs.map((t, i) => (
            <button key={t} onClick={() => setSubTab(i)} style={{
              padding: '7px 12px', borderRadius: 6, fontFamily: T.fm, fontSize: 10, fontWeight: 600,
              letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
              background: i === subTab ? T.bg3 : 'transparent', color: i === subTab ? T.ink : T.ink3, border: 'none',
            }}>{t}</button>
          ))}
        </div>

        {/* Event cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {data.shows.map((e, i) => {
            const pct = e.capacity > 0 ? (e.sold / e.capacity) * 100 : 0;
            const isHot = pct > 85 || e.status === 'TONIGHT';
            return (
              <div key={e.id} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: 110, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg,${data.tracks[i % data.tracks.length]?.color ?? T.accent},${T.bg4})` }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,.8) 100%)' }} />
                  <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
                    <WMPill tone={e.status === 'TONIGHT' ? 'live' : e.status === 'NEAR SOLD' ? 'pink' : 'soft'}>
                      {e.status === 'TONIGHT' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />}
                      {e.status}
                    </WMPill>
                  </div>
                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, fontFamily: T.fm, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', padding: '4px 9px', borderRadius: 99 }}>
                    ♥ {e.hype}
                  </div>
                  <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 2, color: '#fff' }}>
                    <h3 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 20, letterSpacing: '-.025em', margin: 0 }}>{e.name}</h3>
                    <p style={{ fontFamily: T.fm, fontSize: 9, color: 'rgba(255,255,255,.78)', letterSpacing: '.1em', margin: '3px 0 0', textTransform: 'uppercase' }}>{e.venue} · CHICAGO</p>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink, fontWeight: 600, letterSpacing: '.06em' }}>{e.date} · {e.time}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>{e.sold}/{e.capacity} sold</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, letterSpacing: '-.025em', color: T.ink }}>${e.price}</div>
                    <button style={{
                      padding: '7px 14px', borderRadius: 7, fontFamily: T.fm, fontSize: 10, fontWeight: 700,
                      letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: T.bg,
                      background: isHot ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.ink,
                    }}>Buy</button>
                  </div>
                </div>
                <div style={{ width: '100%', height: 4, background: T.bg, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${T.accent},${T.pink})`, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* My tickets */}
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 15, color: T.ink, margin: 0 }}>My Tickets</h2>
            <span style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.08em' }}>{data.tickets.length} active</span>
          </div>
          {data.tickets.map((tk, i, arr) => {
            const isWait = tk.status === 'WAITLIST';
            return (
              <div key={tk.id} style={{
                display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 12, alignItems: 'center',
                padding: '12px 16px', borderBottom: i === arr.length - 1 ? 'none' : `1px dashed ${T.line}`,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 6, border: `1px dashed ${isWait ? T.amber : T.line2}`,
                  background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 34, height: 34, opacity: isWait ? .3 : .7, background: `linear-gradient(90deg,${T.ink} 1px,transparent 1px) 0 0/5px 5px, linear-gradient(0deg,${T.ink} 1px,transparent 1px) 0 0/5px 5px` }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{tk.showName}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>{tk.date}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 8, color: T.ink3, letterSpacing: '.1em', marginTop: 3 }}>{tk.code}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span style={{ fontFamily: T.fm, fontSize: 10, color: T.ink2, fontWeight: 600, letterSpacing: '.08em' }}>{tk.seat}</span>
                  <WMPill tone={isWait ? 'amber' : 'teal'}>{tk.status}</WMPill>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Main mobile export ───────────────────────────────────────
export function WorkbenchMobile({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<MobileTab>('me');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0.42);
  const track = data.tracks[0];

  // Tick progress when playing
  useEffect(() => {
    if (!playing || !track) return;
    const iv = setInterval(() => {
      setProgress(p => {
        const next = p + 1 / track.durationSec;
        return next >= 1 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [playing, track]);

  const screenEl = (() => {
    switch (tab) {
      case 'me':     return <ScreenMe data={data} />;
      case 'seeds':  return <ScreenSeeds data={data} />;
      case 'radio':  return <ScreenRadio data={data} />;
      case 'studio': return <ScreenStudio data={data} />;
      case 'tick':   return <ScreenTicketing data={data} />;
    }
  })();

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: T.bg, color: T.ink, fontFamily: T.fb,
      overflow: 'hidden',
    }}>
      <style>{eqCss}</style>
      <WMTopBar tab={tab} listeningNow={data.listeningNow} userName={data.userName} initials={data.userInitials} />
      <div className="wm-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', scrollbarWidth: 'none' }}>
        {screenEl}
      </div>
      {track && <WMMiniPlayer track={track} playing={playing} onToggle={() => setPlaying(p => !p)} progress={progress} />}
      <WMBottomTabs tab={tab} onTab={setTab} />
    </div>
  );
}
