'use client';

import { useState } from 'react';
import { useApp } from './context';
import { BetaGate } from './BetaGate';
import { Onboarding } from './Onboarding';
import { ListenTab } from './ListenTab';
import { EventsTab } from './EventsTab';
import { PagesTab } from './PagesTab';
import {
  ArtistProfileSheet,
  LiveEventOverlay,
  SettingsSheet,
  EarningsSheet,
  PayoutSheet,
  PostPurchaseSheet,
  FriendActivitySheet,
  PlaylistCreateSheet,
  NotificationsSheet,
  GlobalSearchSheet,
} from './Sheets';
import { IHYPE_DATA } from '@/lib/data';

// Animated waveform bars
function Waveform({ playing, tint }: { playing: boolean; tint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20, flexShrink: 0 }}>
      {['.4s', '.2s', '.55s', '.3s', '.45s'].map((d, i) => (
        <div key={i} style={{ width: 3, height: '100%', borderRadius: 2, background: tint || 'var(--accent)', transformOrigin: 'bottom', transform: playing ? undefined : 'scaleY(.25)', animation: playing ? `wv ${[.7, .5, .8, .6, .75][i]}s ${d} ease-in-out infinite` : undefined, transition: 'transform .3s' }} />
      ))}
    </div>
  );
}

// Mini player bar at top
function MediaPlayerBar({ onExpand }: { onExpand: () => void }) {
  const { nowPlaying, playing, togglePlay } = useApp();
  if (!nowPlaying) return null;
  const tint = nowPlaying.tint || 'var(--accent)';
  return (
    <div onClick={onExpand} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: `linear-gradient(90deg,${tint}18,rgba(14,11,8,.92))`, backdropFilter: 'blur(16px)', borderBottom: `1px solid ${tint}22`, cursor: 'pointer', flexShrink: 0, boxShadow: `0 2px 20px ${tint}18` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${tint}cc,${tint}33)`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nowPlaying.t}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-3)' }}>{nowPlaying.a}</div>
      </div>
      <Waveform playing={playing} tint={tint} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={e => { e.stopPropagation(); }} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="19,20 9,12 19,4" /><line x1="5" y1="4" x2="5" y2="20" /></svg>
        </button>
        <button onClick={e => { e.stopPropagation(); togglePlay(); }} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          {playing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>}
        </button>
        <button onClick={e => { e.stopPropagation(); }} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5,4 15,12 5,20" /><line x1="19" y1="4" x2="19" y2="20" /></svg>
        </button>
      </div>
    </div>
  );
}

// Expanded player overlay
function ExpandedPlayer({ onClose }: { onClose: () => void }) {
  const { nowPlaying, playing, togglePlay } = useApp();
  const [progress, setProgress] = useState(38);
  if (!nowPlaying) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', padding: '2rem 1.5rem 1.5rem' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, alignSelf: 'center', marginBottom: 24 }}>⌄</button>
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 24, background: `linear-gradient(135deg,${nowPlaying.tint}cc,${nowPlaying.tint}22)`, marginBottom: 28 }} />
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-.03em' }}>{nowPlaying.t}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.88rem', color: 'var(--ink-3)', marginTop: 4 }}>{nowPlaying.a}</div>
      </div>
      <div style={{ marginBottom: 6, position: 'relative', height: 36, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', width: '100%', height: 3, borderRadius: 999, background: 'var(--bg-raised)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: progress + '%', background: 'var(--accent)', borderRadius: 999 }} />
        </div>
        <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(+e.target.value)} style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', height: 36 }} />
        <div style={{ position: 'absolute', left: progress + '%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-base)', pointerEvents: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)' }}>1:{String(Math.round(progress * .42)).padStart(2, '0')}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)' }}>3:42</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
        <button style={{ background: 'none', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', padding: 0 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="19,20 9,12 19,4" /><line x1="5" y1="4" x2="5" y2="20" /></svg>
        </button>
        <button onClick={togglePlay} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          {playing
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>}
        </button>
        <button style={{ background: 'none', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', padding: 0 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5,4 15,12 5,20" /><line x1="19" y1="4" x2="19" y2="20" /></svg>
        </button>
      </div>
    </div>
  );
}

// Beta advisory banner
function BetaBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (dismissed) return null;
  return (
    <div style={{ flexShrink: 0, padding: '6px 12px 0' }}>
      <div style={{ borderRadius: 12, background: 'rgba(255,184,74,.08)', border: '1px solid rgba(255,184,74,.22)', overflow: 'hidden' }}>
        <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffb84a', flexShrink: 0, boxShadow: '0 0 6px #ffb84a' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#ffb84a', flex: 1 }}>Beta 0.1.0-beta.5 · Work in progress</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'rgba(255,184,74,.5)', marginRight: 4 }}>{expanded ? '▲' : '▼'}</span>
          <button onClick={e => { e.stopPropagation(); setDismissed(true); }} style={{ background: 'none', border: 'none', color: 'rgba(255,184,74,.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
        {expanded && (
          <div style={{ padding: '0 10px 10px', borderTop: '1px solid rgba(255,184,74,.12)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '.78rem', color: 'rgba(240,235,229,.65)', lineHeight: 1.6, margin: '8px 0 10px' }}>This is a beta build. Ticket purchases are simulated — no real money moves.</p>
            <button onClick={() => setDismissed(true)} style={{ width: '100%', padding: '6px', borderRadius: 8, border: 'none', background: 'rgba(255,184,74,.12)', color: '#ffb84a', fontFamily: 'var(--font-mono)', fontSize: '.68rem', cursor: 'pointer', letterSpacing: '.06em', fontWeight: 700 }}>Got it ✓</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Bottom tab navigation
function BottomTabs() {
  const { tab, setTab, playing } = useApp();
  const [pressed, setPressed] = useState<string | null>(null);
  const tabs: { id: 'listen' | 'events' | 'pages'; label: string; icon: (c: string, sz: number) => React.ReactNode }[] = [
    { id: 'listen', label: 'Listen', icon: (c, sz) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg> },
    { id: 'events', label: 'Events', icon: (c, sz) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" /></svg> },
    { id: 'pages', label: 'Pages', icon: (c, sz) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg> },
  ];
  return (
    <div style={{ display: 'flex', borderTop: '1px solid var(--line)', background: 'var(--bg-surface)', paddingBottom: 22, paddingTop: 6, flexShrink: 0 }}>
      {tabs.map(t => {
        const on = t.id === tab;
        const isPressed = pressed === t.id;
        const color = on ? 'var(--accent)' : isPressed ? 'var(--accent)' : 'var(--ink-3)';
        return (
          <button
            key={t.id}
            onPointerDown={() => setPressed(t.id)}
            onPointerUp={() => { setPressed(null); setTab(t.id); }}
            onPointerLeave={() => setPressed(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 0 5px', background: 'none', border: 'none', cursor: 'pointer', color, position: 'relative', transform: isPressed ? 'scale(.92)' : 'scale(1)', transition: 'transform .1s ease' }}>
            {on && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 36, height: 3, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 10px 2px var(--accent)', opacity: .9 }} />}
            {isPressed && <span style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(255,80,41,.1)', pointerEvents: 'none' }} />}
            {t.id === 'listen' && playing && <span style={{ position: 'absolute', top: 8, right: 'calc(50% - 16px)', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-surface)', boxShadow: '0 0 6px var(--accent)' }} />}
            {t.icon(color, 26)}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: on ? 700 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Error boundary (class component for React compat)
class ErrorBoundary extends (require('react').Component) {
  state = { err: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { err: e }; }
  render(): React.ReactNode {
    if (this.state.err) return (
      <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>Something went wrong</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '.82rem', color: 'var(--ink-3)', maxWidth: '28ch', lineHeight: 1.6 }}>{String(this.state.err?.message || this.state.err)}</div>
        <button onClick={() => this.setState({ err: null })} style={{ padding: '9px 22px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.85rem', cursor: 'pointer' }}>Retry</button>
      </div>
    );
    return (this.props as any).children;
  }
}

// Main app shell
export function AppShell() {
  const { betaOk, onboarded, tab, sheet, hypeBudget, notifsRead, toastMsg, openSheet } = useApp();
  const [playerExpanded, setPlayerExpanded] = useState(false);

  if (!betaOk) return <BetaGate />;
  if (!onboarded) return <Onboarding />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--bg-surface)', cursor: 'default' }}>
          {[0, 1, 2].map(i => <span key={i} style={{ fontSize: 11, opacity: i < hypeBudget ? 1 : .15, transition: 'opacity .35s' }}>🔥</span>)}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.6rem', color: 'var(--ink-3)', marginLeft: 4, letterSpacing: '.05em' }}>/wk</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1rem', letterSpacing: '-.02em', color: 'var(--accent)' }}>iHYPE</div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => openSheet('global-search')} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </button>
          <button onClick={() => openSheet('notifications')} style={{ position: 'relative', background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            {!notifsRead && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-base)' }} />}
          </button>
        </div>
      </div>

      <BetaBanner />
      <MediaPlayerBar onExpand={() => setPlayerExpanded(true)} />

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* @ts-ignore */}
        {tab === 'listen' && <ErrorBoundary><ListenTab /></ErrorBoundary>}
        {/* @ts-ignore */}
        {tab === 'events' && <ErrorBoundary><EventsTab /></ErrorBoundary>}
        {/* @ts-ignore */}
        {tab === 'pages' && <ErrorBoundary><PagesTab /></ErrorBoundary>}
      </div>

      <BottomTabs />

      {/* Global sheets */}
      {sheet === 'artist-profile' && <ArtistProfileSheet />}
      {sheet === 'live-event' && <LiveEventOverlay />}
      {sheet === 'settings' && <SettingsSheet />}
      {sheet === 'earnings' && <EarningsSheet />}
      {sheet === 'payout' && <PayoutSheet />}
      {sheet === 'post-purchase' && <PostPurchaseSheet />}
      {sheet === 'friend-activity' && <FriendActivitySheet />}
      {sheet === 'playlist-create' && <PlaylistCreateSheet />}
      {sheet === 'notifications' && <NotificationsSheet />}
      {sheet === 'global-search' && <GlobalSearchSheet />}

      {/* Expanded player */}
      {playerExpanded && <ExpandedPlayer onClose={() => setPlayerExpanded(false)} />}

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 18px', fontFamily: 'var(--font-mono)', fontSize: '.82rem', color: 'var(--ink-1)', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 100 }}>{toastMsg}</div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes wv { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
      `}</style>
    </div>
  );
}
