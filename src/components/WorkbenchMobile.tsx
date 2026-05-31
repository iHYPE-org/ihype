'use client';

// ─── THIN ORCHESTRATOR ────────────────────────────────────────
// Screen components live in src/components/workbench/MobileScreen*.tsx
// Shared primitives live in src/components/workbench/MobilePrimitives.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkbenchData, WbTrack } from '@/types/workbench';
import { SearchOverlay } from '@/components/workbench/SearchOverlay';
import { ViewErrorBoundary } from '@/components/workbench/ErrorBoundary';
import {
  T,
  WMTrackSheet,
  WMShowHypersSheet,
  WMSetlistVoteSheet,
  WMGenreQuizSheet,
  WMFeedbackSheet,
} from '@/components/workbench/MobilePrimitives';
import { MobileScreenMe } from '@/components/workbench/MobileScreenMe';
import { MobileScreenSeeds } from '@/components/workbench/MobileScreenSeeds';
import { MobileScreenRadio } from '@/components/workbench/MobileScreenRadio';
import { MobileScreenStudio } from '@/components/workbench/MobileScreenStudio';
import { MobileScreenTicketing } from '@/components/workbench/MobileScreenTicketing';

type MobileTab = 'me' | 'seeds' | 'radio' | 'studio' | 'tick';

// ─── Icons ────────────────────────────────────────────────────
const WMIcon = {
  me:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="6" r="2.5"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>,
  seeds:  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/></svg>,
  radio:  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r=".6" fill="currentColor"/></svg>,
  studio: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8h1M8 6v4M11 7v2"/></svg>,
  tick:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 6a1.5 1.5 0 0 0 0 3v3h12V9a1.5 1.5 0 0 0 0-3V3H2v3Z"/><path d="M9 3v10" strokeDasharray="1.4 1.4"/></svg>,
};


// ─── Top bar ─────────────────────────────────────────────────
function WMTopBar({ tab, onTab, listeningNow, userName, initials, onSearch, notifCount, onFeedback, radioLive }: {
  tab: MobileTab; onTab: (t: MobileTab) => void;
  listeningNow: number; userName: string; initials: string;
  onSearch?: () => void;
  notifCount?: number;
  onFeedback?: () => void;
  radioLive?: boolean;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [searchBarOpen, setSearchBarOpen] = React.useState(false);
  const [searchVal, setSearchVal] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const titles: Record<MobileTab, string> = {
    me: 'My Page', seeds: 'Seeds', radio: 'Radio', studio: 'Studio', tick: 'Tickets',
  };
  const close = () => setMenuOpen(false);
  const openSearch = () => { setMenuOpen(false); setSearchBarOpen(true); };
  const closeSearch = () => { setSearchBarOpen(false); setSearchVal(''); };
  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); closeSearch(); onSearch?.(); };
  React.useEffect(() => {
    if (searchBarOpen) { const t = setTimeout(() => searchInputRef.current?.focus(), 50); return () => clearTimeout(t); }
  }, [searchBarOpen]);

  return (
    <>
    <header style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8,
      padding: '10px 18px 12px', background: T.bg2, borderBottom: `1px solid ${T.line}`,
      flexShrink: 0, position: 'relative', zIndex: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg,${T.accent},${T.pink})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fd, fontWeight: 800, fontSize: 12, color: T.bg, letterSpacing: '-.02em', position: 'relative',
        }}>
          iH
          <span style={{ position: 'absolute', top: 4, right: 6, width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 15, letterSpacing: '-.03em', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 1, color: T.ink }}>
            iHYPE<span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: T.accent, transform: 'translateY(-7px)' }} />
          </span>
          <span style={{ display: 'block', fontFamily: T.fm, fontSize: 13, fontWeight: 600, color: T.ink2, letterSpacing: '.12em', marginTop: 2, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titles[tab]}
          </span>
        </span>
      </div>
      <button aria-label="Search" onClick={openSearch} style={{ width: 44, height: 44, borderRadius: 8, background: searchBarOpen ? T.bg3 : 'transparent', border: `1px solid ${searchBarOpen ? T.line2 : T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background .15s', color: T.ink2 }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </button>
      <button aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => { setSearchBarOpen(false); setMenuOpen(o => !o); }} style={{ width: 44, height: 44, borderRadius: 8, background: menuOpen ? T.bg3 : 'transparent', border: `1px solid ${menuOpen ? T.line2 : T.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', padding: 0, position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
        <span style={{ display: 'block', width: 16, height: 1.5, background: T.ink, borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'translateY(6.5px) rotate(45deg)' : 'none' }} />
        <span style={{ display: 'block', width: 16, height: 1.5, background: T.ink, borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: 'opacity .15s' }} />
        <span style={{ display: 'block', width: 16, height: 1.5, background: T.ink, borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none' }} />
        {(notifCount ?? 0) > 0 && !menuOpen && (
          <span style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: T.accent, border: `1.5px solid ${T.bg2}` }} />
        )}
      </button>
    </header>
    {searchBarOpen && (
      <div onClick={e => { if (e.target === e.currentTarget) closeSearch(); }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column', padding: '16px 14px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 10, padding: '0 12px' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input ref={searchInputRef} value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Search artists, shows, tracks…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '12px 0', fontFamily: T.fb, fontSize: 16, color: T.ink }} />
            {searchVal && <button type="button" onClick={() => setSearchVal('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, padding: 0, fontSize: 16, lineHeight: 1 }}>✕</button>}
          </div>
          <button type="button" onClick={closeSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink2, fontFamily: T.fb, fontSize: 14, padding: '0 4px', whiteSpace: 'nowrap' }}>Cancel</button>
        </form>
      </div>
    )}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 19, transform: menuOpen ? 'translateY(66px)' : 'translateY(calc(-100% - 66px))', transition: 'transform .24s cubic-bezier(.4,0,.2,1)', background: T.bg3, borderBottom: `1px solid ${T.line2}`, boxShadow: '0 16px 48px rgba(0,0,0,.7)', maxHeight: 'calc(100dvh - 66px)', overflowY: 'auto', willChange: 'transform' }}>
      <div style={{ padding: '8px 0' }}>
        <div style={{ padding: '8px 20px 6px', fontFamily: T.fm, fontSize: 11, letterSpacing: '.18em', color: T.ink3, textTransform: 'uppercase' }}>Navigate</div>
        {([
          { id: 'me',     icon: '👤', label: 'My Page' },
          { id: 'seeds',  icon: '🌱', label: 'Seeds' },
          { id: 'radio',  icon: '📻', label: 'Radio',   badge: radioLive ? 'LIVE' : undefined },
          { id: 'studio', icon: '🎙️', label: 'Studio' },
          { id: 'tick',   icon: '🎟️', label: 'Tickets' },
        ] as { id: MobileTab; icon: string; label: string; badge?: string }[]).map(it => {
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => { onTab(it.id); close(); }} style={{ width: '100%', padding: '13px 20px', background: active ? 'rgba(255,80,41,.07)' : 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{it.icon}</span>
              <span style={{ fontFamily: T.fb, fontSize: 15, color: active ? T.accent : T.ink, flex: 1 }}>{it.label}</span>
              {it.badge && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 99, fontFamily: T.fm, background: 'rgba(255,80,41,.18)', color: T.accent, border: '1px solid rgba(255,80,41,.4)', letterSpacing: '.08em' }}>{it.badge}</span>}
              {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
      <div style={{ height: 1, background: T.line, margin: '0 20px' }} />
      <div style={{ padding: '8px 0' }}>
        {[
          { icon: '🔔', label: `Notifications${(notifCount ?? 0) > 0 ? ` · ${notifCount}` : ''}`, action: close, accent: (notifCount ?? 0) > 0 },
          { icon: '🔗', label: 'Share my page', action: () => { close(); navigator.share?.({ title: 'iHYPE', url: window.location.href }).catch(() => {}); } },
        ].map(item => (
          <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '13px 20px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ fontFamily: T.fb, fontSize: 15, color: item.accent ? T.accent : T.ink }}>{item.label}</span>
          </button>
        ))}
      </div>
      <div style={{ height: 1, background: T.line, margin: '0 20px' }} />
      <div style={{ padding: '8px 0' }}>
        <div style={{ padding: '8px 20px 6px', fontFamily: T.fm, fontSize: 11, letterSpacing: '.18em', color: T.ink3, textTransform: 'uppercase' }}>Help</div>
        {([{ icon: 'ℹ️', label: 'About iHYPE', href: '/about' }, { icon: '🔍', label: 'Transparency', href: '/transparency' }] as { icon: string; label: string; href: string }[]).map(item => (
          <a key={item.label} href={item.href} onClick={close} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ fontFamily: T.fb, fontSize: 15, color: T.ink }}>{item.label}</span>
          </a>
        ))}
        <button onClick={() => { close(); window.dispatchEvent(new CustomEvent('ihype:open-bug-report')); }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🐛</span>
          <span style={{ fontFamily: T.fb, fontSize: 15, color: T.ink }}>Report a bug</span>
        </button>
      </div>
      <div style={{ height: 1, background: T.line, margin: '0 20px' }} />
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${T.pink},${T.accent})`, color: T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>
          <div>
            <div style={{ fontFamily: T.fb, fontSize: 14, color: T.ink }}>{userName}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>iHYPE member</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>
          <span className="wm-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal, boxShadow: `0 0 8px ${T.teal}` }} />
          {listeningNow.toLocaleString()} live
        </div>
      </div>
    </div>
    {menuOpen && (
      <div onClick={() => { close(); }} style={{ position: 'absolute', inset: 0, zIndex: 18, background: 'rgba(0,0,0,.55)' }} />
    )}
    </>
  );
}

// ─── Mini Player ─────────────────────────────────────────────
function WMMiniPlayer({ track, playing, onToggle, progress, onAlbumTap }: {
  track: WbTrack; playing: boolean; onToggle: () => void; progress: number; onAlbumTap?: () => void;
}) {
  return (
    <div style={{ position: 'relative', padding: '8px 12px', background: T.bg2, borderTop: `1px solid ${T.line2}`, display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 10, alignItems: 'center', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${T.accent},${T.pink},transparent)`, opacity: .6 }} />
      <div onClick={onAlbumTap} style={{ width: 40, height: 40, borderRadius: 7, background: `linear-gradient(135deg,${track.color},${track.color}80)`, position: 'relative', overflow: 'hidden', flexShrink: 0, cursor: onAlbumTap ? 'pointer' : 'default' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%,rgba(255,255,255,.3),transparent 60%)' }} />
        {playing && (
          <div style={{ position: 'absolute', bottom: 5, left: 5, display: 'flex', gap: 2, alignItems: 'flex-end', height: 9 }}>
            {[0, 1, 2].map(i => <span key={i} className="wm-eq-bar" style={{ width: 2, background: '#fff', borderRadius: 99, display: 'block', height: 4 }} />)}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13, letterSpacing: '-.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{track.title}</div>
        <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, marginTop: 2, letterSpacing: '.04em' }}>{track.artistName} <span style={{ color: T.ink4 }}>·</span> {track.album}</div>
        <div style={{ marginTop: 5, height: 2, borderRadius: 99, background: 'rgba(255,255,255,.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: `linear-gradient(90deg,${T.accent},${T.pink})`, borderRadius: 99 }} />
        </div>
      </div>
      <button aria-label="Hype this track" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', border: 'rgba(255,62,154,.3) 1px solid', borderRadius: 99, color: T.pink, fontFamily: T.fm, fontSize: 12, fontWeight: 600, background: 'rgba(255,62,154,.05)', cursor: 'pointer', minHeight: 44, minWidth: 44 }}>♥ {track.hypeCount}</button>
      <button onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: '50%', background: T.ink, color: T.bg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        {playing
          ? <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>
          : <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 3v10l10-5z"/></svg>}
      </button>
    </div>
  );
}

// ─── Tooltip components ───────────────────────────────────────
function SeedsTooltip({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ position: 'fixed', bottom: 100, left: 18, right: 18, zIndex: 70, background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}>
      <span style={{ fontFamily: T.fb, fontSize: 14, color: T.ink }}>Swipe right to hype, left to skip, up to save</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: T.ink3, cursor: 'pointer', fontSize: 18, padding: '0 0 0 10px' }}>✕</button>
    </div>
  );
}

function RadioTooltip({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ position: 'fixed', bottom: 100, left: 18, right: 18, zIndex: 70, background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}>
      <span style={{ fontFamily: T.fb, fontSize: 14, color: T.ink }}>Tune into live shows and upcoming events</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: T.ink3, cursor: 'pointer', fontSize: 18, padding: '0 0 0 10px' }}>✕</button>
    </div>
  );
}

// ─── Main mobile export ───────────────────────────────────────
export function WorkbenchMobile({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<MobileTab>(() => {
    if (typeof window === 'undefined') return 'me';
    const saved = localStorage.getItem('ihype_mobile_tab') as MobileTab | null;
    return (saved && (['me', 'seeds', 'radio', 'studio', 'tick'] as MobileTab[]).includes(saved)) ? saved : 'me';
  });
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0.42);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [swipeHintSeen, setSwipeHintSeen] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem('ihype_swipe_hint_seen');
  });
  const [showSwipeHint, setShowSwipeHint] = React.useState(false);
  const [seedsTooltipSeen, setSeedsTooltipSeen] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem('ihype_tooltip_seeds_seen');
  });
  const [radioTooltipSeen, setRadioTooltipSeen] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem('ihype_tooltip_radio_seen');
  });

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.notifications) setNotifCount(d.notifications.length); })
      .catch(() => {});
  }, []);

  const currentTrack = data.tracks[currentTrackIdx % Math.max(data.tracks.length, 1)];
  const track = currentTrack ?? data.tracks[0];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.mediaUrl) return;
    if (audio.src !== currentTrack.mediaUrl) { audio.src = currentTrack.mediaUrl; audio.load(); }
    if (playing) { audio.play().catch(() => {}); } else { audio.pause(); }
  }, [playing, currentTrackIdx, currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => { if (audio.duration) setProgress(audio.currentTime / audio.duration); };
    const onEnded = () => { setCurrentTrackIdx(ci => (ci + 1) % Math.max(data.tracks.length, 1)); setProgress(0); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => { audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnded); };
  }, [data.tracks.length]);

  useEffect(() => {
    if (!playing || !track || track.mediaUrl) return;
    const iv = setInterval(() => {
      setProgress(p => { const next = p + 1 / track.durationSec; return next >= 1 ? 0 : next; });
    }, 1000);
    return () => clearInterval(iv);
  }, [playing, track]);

  useEffect(() => {
    localStorage.setItem('ihype_mobile_tab', tab);
  }, [tab]);

  useEffect(() => {
    if (swipeHintSeen || tab === 'seeds') return;
    const t1 = setTimeout(() => setShowSwipeHint(true), 800);
    const t2 = setTimeout(() => {
      setShowSwipeHint(false);
      localStorage.setItem('ihype_swipe_hint_seen', '1');
      setSwipeHintSeen(true);
    }, 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [swipeHintSeen, tab]);

  const [trackSheetOpen, setTrackSheetOpen] = useState(false);
  const [hypersSheetShowId, setHypersSheetShowId] = useState<string | null>(null);
  const [setlistSheetShowId, setSetlistSheetShowId] = useState<string | null>(null);
  const [showGenreQuiz, setShowGenreQuiz] = useState(data.needsGenreQuiz ?? false);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const pullDeltaRef = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

  const TABS_ORDER: MobileTab[] = ['me', 'seeds', 'radio', 'studio', 'tick'];
  const tabSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const tabSwipeLocked = useRef<'h' | 'v' | null>(null);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    await new Promise(r => setTimeout(r, 900));
    setRefreshing(false);
  }, [refreshing]);

  function handleMainTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    pullStartY.current = t.clientY;
    tabSwipeStart.current = { x: t.clientX, y: t.clientY };
    tabSwipeLocked.current = null;
  }

  function handleMainTouchMove(e: React.TouchEvent) {
    const t = e.touches[0];
    if (tab !== 'seeds') {
      const el = e.currentTarget as HTMLElement;
      if (el.scrollTop === 0) {
        const dy = t.clientY - pullStartY.current;
        if (dy > 0) { pullDeltaRef.current = Math.min(dy * 0.4, 70); setPullDelta(pullDeltaRef.current); }
      }
    }
    if (tabSwipeStart.current && !tabSwipeLocked.current) {
      const dx = t.clientX - tabSwipeStart.current.x;
      const dy = t.clientY - tabSwipeStart.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) { tabSwipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'; }
    }
  }

  function handleMainTouchEnd(e: React.TouchEvent) {
    if (pullDeltaRef.current > 50) handleRefresh();
    pullDeltaRef.current = 0;
    setPullDelta(0);
    if (tabSwipeLocked.current === 'h' && tabSwipeStart.current) {
      const dx = e.changedTouches[0].clientX - tabSwipeStart.current.x;
      if (Math.abs(dx) > 60 && tab !== 'seeds') {
        const idx = TABS_ORDER.indexOf(tab);
        if (dx < 0 && idx < TABS_ORDER.length - 1) setTab(TABS_ORDER[idx + 1]);
        if (dx > 0 && idx > 0) setTab(TABS_ORDER[idx - 1]);
      }
    }
    tabSwipeStart.current = null;
    tabSwipeLocked.current = null;
  }

  const screenEl = (() => {
    switch (tab) {
      case 'me':     return <MobileScreenMe data={data} />;
      case 'seeds':  return <MobileScreenSeeds data={data} onHypersSheet={setHypersSheetShowId} />;
      case 'radio':  return <MobileScreenRadio data={data} onSetlistSheet={setSetlistSheetShowId} onHypersSheet={setHypersSheetShowId} onSeedsTab={() => setTab('seeds')} />;
      case 'studio': return <MobileScreenStudio data={data} />;
      case 'tick':   return <MobileScreenTicketing data={data} onHypersSheet={setHypersSheetShowId} onRadioTab={() => setTab('radio')} />;
    }
  })();

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden' }}>
      {data.degraded && (
        <div style={{ background: '#f59e0b', color: '#000', textAlign: 'center', padding: '6px 12px', fontSize: 12, fontWeight: 600, position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          Having trouble connecting — some data may be outdated
        </div>
      )}
      <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />
      <WMTopBar tab={tab} onTab={setTab} listeningNow={data.listeningNow} userName={data.userName} initials={data.userInitials} onSearch={() => setResultsOpen(true)} notifCount={notifCount} onFeedback={() => setShowFeedbackSheet(true)} radioLive={data.radioShows.some(r => r.live)} />
      <div role="main" className="wm-scroll" style={{ flex: 1, overflowY: tab === 'seeds' ? 'hidden' : 'auto', overflowX: 'hidden', position: 'relative', scrollbarWidth: 'none' }} onTouchStart={handleMainTouchStart} onTouchMove={handleMainTouchMove} onTouchEnd={handleMainTouchEnd}>
        {tab !== 'seeds' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: pullDelta > 0 ? pullDelta : refreshing ? 44 : 0, overflow: 'hidden', transition: refreshing ? 'none' : 'height .2s' }}>
            {refreshing ? (
              <svg style={{ animation: 'wm-spin .8s linear infinite' }} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" opacity=".25"/><path d="M22 12A10 10 0 0 1 12 22"/></svg>
            ) : pullDelta > 10 ? (
              <svg style={{ transition: 'transform .15s', transform: pullDelta > 40 ? 'rotate(180deg)' : 'rotate(0deg)' }} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
            ) : null}
          </div>
        )}
        <ViewErrorBoundary key={tab} viewName={tab}>
          <div className="wm-tab-screen">{screenEl}</div>
        </ViewErrorBoundary>
      </div>
      {track && tab !== 'seeds' && <WMMiniPlayer track={track} playing={playing} onToggle={() => setPlaying(p => !p)} progress={progress} onAlbumTap={() => setTrackSheetOpen(true)} />}
      <WMTrackSheet track={track ?? null} open={trackSheetOpen} onClose={() => setTrackSheetOpen(false)} />
      <WMShowHypersSheet showId={hypersSheetShowId} onClose={() => setHypersSheetShowId(null)} />
      <WMSetlistVoteSheet showId={setlistSheetShowId} onClose={() => setSetlistSheetShowId(null)} />
      {showGenreQuiz && data.profileId && <WMGenreQuizSheet profileId={data.profileId} onComplete={() => setShowGenreQuiz(false)} />}
      <SearchOverlay open={resultsOpen} onClose={() => setResultsOpen(false)} />
      {showFeedbackSheet && <WMFeedbackSheet onClose={() => setShowFeedbackSheet(false)} />}
      {!seedsTooltipSeen && data.tracks.length === 0 && tab === 'seeds' && (
        <SeedsTooltip onDismiss={() => { localStorage.setItem('ihype_tooltip_seeds_seen', '1'); setSeedsTooltipSeen(true); }} />
      )}
      {!radioTooltipSeen && data.radioShows.length === 0 && tab === 'radio' && (
        <RadioTooltip onDismiss={() => { localStorage.setItem('ihype_tooltip_radio_seen', '1'); setRadioTooltipSeen(true); }} />
      )}
      {showSwipeHint && (
        <div className="wm-swipe-hint" style={{ position: 'fixed', bottom: 90, left: 0, right: 0, zIndex: 60, display: 'flex', justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(10px)', borderRadius: 99, padding: '8px 18px', fontFamily: T.fm, fontSize: 13, letterSpacing: '.06em', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.1)' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            swipe between tabs
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </span>
        </div>
      )}
    </div>
  );
}
