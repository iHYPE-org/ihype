'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Re-export types that home/page.tsx imports ────────────────
export type { WbStat, WbTrack, WbShow, WbActivity, WbNotification, WbRadioShow, WorkbenchData, Prefs, StarterPackItem, WbTrendingProfile } from '@/types/workbench';

import type { WorkbenchData, StarterPackItem } from '@/types/workbench';

import { DEFAULT_PREFS, loadPrefs, shiftAccent } from './workbench/types';
import type { View } from './workbench/types';
import { AppTopbar } from './workbench/AppTopbar';
import { PlayerDock } from './workbench/PlayerDock';
import { QueueRail } from './workbench/QueueRail';
import { ViewMyPage } from './workbench/ViewMyPage';
import { ViewSeeds } from './workbench/ViewSeeds';
import { ViewRadio } from './workbench/ViewRadio';
import { ViewTickets } from './workbench/ViewTickets';
import { ViewStudio } from './workbench/ViewStudio';
import { ViewSettings } from './workbench/ViewSettings';
import { ViewTour } from './workbench/ViewTour';
import { ViewArtistPage } from './workbench/ViewArtistPage';
import { ViewVenuePage } from './workbench/ViewVenuePage';
import ViewPageStudio from './workbench/ViewPageStudio';
import { Toast, WelcomeDialog, KeyboardShortcutsDialog } from './workbench/Overlays';
import { ViewErrorBoundary } from './workbench/ErrorBoundary';
import { SearchOverlay } from './workbench/SearchOverlay';
import { PasskeyNudge } from './workbench/PasskeyNudge';
import { WMGenreQuizSheet } from './workbench/MobilePrimitives';
import { AgentShell } from './AgentShell';
import { SkeletonMeView } from './workbench/SkeletonMeView';

// ─────────────────────────────────────────────────────────────
// Main WorkbenchShell export
// ─────────────────────────────────────────────────────────────
export function WorkbenchShell({ data, starterPack = [] }: { data: WorkbenchData; starterPack?: StarterPackItem[] }) {
  void starterPack;
  const [liveData, setLiveData] = useState<WorkbenchData>(data);
  const [revalidating, setRevalidating] = useState(data.degraded === true);
  const [view, setView] = useState<View>('me');
  const [prevView, setPrevView] = useState<View>('me');
  const mainRef = useRef<HTMLDivElement>(null);
  const navigateTo = (v: View) => {
    if (v !== view) setPrevView(view);
    setView(v);
    // Reset scroll position on tab switch
    setTimeout(() => {
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }, 0);
  };
  const [prefs, setPrefs] = useState<typeof DEFAULT_PREFS>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Tracks for player
  const tracks = liveData.tracks.length > 0 ? liveData.tracks : [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Audio ref for real playback
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load prefs from localStorage after mount
  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
    const seen = localStorage.getItem('ihype-welcome-seen');
    if (!seen) setShowWelcome(true);
  }, []);

  // Client-side revalidation — fixes persistent degraded/cached-view banner
  // after a DB cold-start. Runs once on mount and silently refreshes data.
  useEffect(() => {
    fetch('/api/workbench')
      .then(r => r.ok ? r.json() : null)
      .then((freshData: WorkbenchData | null) => {
        if (freshData) {
          // Always apply fresh data: clears degraded state if DB recovered,
          // and keeps data current even when the initial SSR load succeeded.
          setLiveData(freshData);
        }
        setRevalidating(false);
      })
      .catch(() => {
        // Network failure — keep whatever SSR data we have (degraded or real).
        setRevalidating(false);
      });
  }, []);

  // 30-second hype count polling — silently updates counts in place
  useEffect(() => {
    function poll() {
      if (document.visibilityState !== 'visible') return;
      const trackIds = liveData.tracks.map(t => t.id);
      const showIds = liveData.shows.map(s => s.id);
      if (trackIds.length === 0 && showIds.length === 0) return;
      const params = new URLSearchParams();
      if (trackIds.length > 0) params.set('trackIds', trackIds.join(','));
      if (showIds.length > 0) params.set('showIds', showIds.join(','));
      fetch(`/api/hype/counts?${params.toString()}`)
        .then(r => r.ok ? r.json() : null)
        .then((freshCounts: { tracks: Record<string, number>; shows: Record<string, number> } | null) => {
          if (!freshCounts) return;
          setLiveData(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => ({ ...t, hypeCount: freshCounts.tracks[t.id] ?? t.hypeCount })),
            shows: prev.shows.map(s => ({ ...s, hype: freshCounts.shows[s.id] ?? s.hype })),
          }));
        })
        .catch(() => {
          // Network failure — keep existing counts
        });
    }

    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [liveData.tracks, liveData.shows]);

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
    root.style.setProperty('--player-h', prefs.density === 'compact' ? '68px' : prefs.density === 'comfy' ? '88px' : '78px');
    root.style.setProperty('--top-h', '60px');
  }, [prefs, mounted]);

  // Sync audio element with playing state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const track = tracks[currentIdx];
    if (!track?.mediaUrl) {
      // No real audio — fall back to fake tick (handled below)
      return;
    }
    if (audio.src !== track.mediaUrl) {
      audio.src = track.mediaUrl;
      audio.load();
    }
    if (playing) {
      audio.play().catch(() => {}); // catch autoplay policy errors silently
    } else {
      audio.pause();
    }
  }, [playing, currentIdx, tracks]);

  // Sync progress from audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onEnded = () => {
      setCurrentIdx(ci => (ci + 1) % tracks.length);
      setProgress(0);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [tracks.length]);

  // Player tick — only used as fallback when mediaUrl is empty
  useEffect(() => {
    const track = tracks[currentIdx];
    if (!playing || tracks.length === 0 || !track) return;
    if (track.mediaUrl) return; // real audio handles progress
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

  // Record play events via /api/media-listens
  const lastRecordedIdx = useRef<number>(-1);
  useEffect(() => {
    if (!playing) return;
    const track = tracks[currentIdx];
    if (!track || lastRecordedIdx.current === currentIdx) return;
    lastRecordedIdx.current = currentIdx;
    fetch('/api/media-listens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaId: track.id,
        title: track.title,
        mediaUrl: track.mediaUrl || 'https://ihype.org',
        artistName: track.artistName,
      }),
    }).catch(() => {});
  }, [playing, currentIdx, tracks]);

  useEffect(() => {
    if (!playing) lastRecordedIdx.current = -1;
  }, [playing]);

  // Seek when progress is set externally (scrubber click)
  const onSeekProgress = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (audio?.duration) audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  }, []);

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
  const onNext = useCallback(() => {
    if (audioRef.current) audioRef.current.currentTime = 0;
    setCurrentIdx(ci => (ci + 1) % tracks.length);
    setProgress(0);
  }, [tracks.length]);
  const onPrev = useCallback(() => {
    if (audioRef.current) audioRef.current.currentTime = 0;
    setCurrentIdx(ci => (ci - 1 + tracks.length) % tracks.length);
    setProgress(0);
  }, [tracks.length]);

  // Seeds state
  const [seedPlaying, setSeedPlaying] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const onSeedSave = useCallback((idx: number) => {
    const saved = tracks[idx];
    if (idx >= 0 && saved) {
      setCurrentIdx(idx);
      setPlaying(true);
    }
    setSeedPlaying(false);
    if (saved) showToast(`"${saved.title}" saved to queue`);
  }, [tracks, showToast]);

  // Notification count
  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<Array<{ id: string; body: string; link?: string; type: string; createdAt: string }>>([]);
  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.notifications) {
          setNotifCount(d.notifications.length);
          setNotifications(d.notifications);
        }
      })
      .catch(() => {});
  }, []);

  // Genre quiz — shown after 2 s if profile has no genres and not dismissed
  const [showGenreQuiz, setShowGenreQuiz] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = !!localStorage.getItem('ihype_genre_quiz_dismissed');
    if (!dismissed && liveData.needsGenreQuiz === true) {
      const t = setTimeout(() => setShowGenreQuiz(true), 2000);
      return () => clearTimeout(t);
    }
  }, [liveData.needsGenreQuiz]);

  // Search overlay state
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcuts dialog state
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(p => !p);
        return;
      }
      if (e.key === 'Escape') {
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
      }
      if (e.key === '?' && !searchOpen && !shortcutsOpen) {
        e.preventDefault();
        setShortcutsOpen(p => !p);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      // Seeds keyboard shortcuts are handled inside ViewSeeds
      if (view !== 'seeds') {
        if (e.key === ' ')          { e.preventDefault(); setPlaying(p => !p); }
        if (e.key === 'ArrowRight') { onNext(); }
        if (e.key === 'ArrowLeft')  { onPrev(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, onNext, onPrev, searchOpen, shortcutsOpen]);

  const track = tracks[currentIdx] ?? tracks[0];
  const showDock = prefs.stickyDock && track;

  const isSeeds = view === 'seeds';
  const isTour = view === 'tour';
  const isPageStudio = view === 'pagestudio' || view === 'artistpage' || view === 'venuepage';
  const showQueue = prefs.queueRail && tracks.length > 0 && !isSeeds;
  const colTemplate = showQueue ? 'minmax(0, 1fr) var(--queue-w)' : '1fr';
  const shellMaxWidth = showQueue ? 1300 : 1600;
  const rowTemplate = showDock ? 'var(--top-h) 1fr var(--player-h)' : 'var(--top-h) 1fr';

  const viewEl = (() => {
    switch (view) {
      case 'me':       return revalidating
        ? <SkeletonMeView />
        : <ViewErrorBoundary viewName="My Page"><ViewMyPage data={liveData} onPickTrack={onPickTrack} currentIdx={currentIdx} /></ViewErrorBoundary>;
      case 'seeds':    return <ViewErrorBoundary viewName="Seeds"><ViewSeeds data={liveData} seedPlaying={seedPlaying} setSeedPlaying={setSeedPlaying} onSave={onSeedSave} /></ViewErrorBoundary>;
      case 'radio':    return <ViewErrorBoundary viewName="Radio"><ViewRadio data={liveData} onPickTrack={onPickTrack} /></ViewErrorBoundary>;
      case 'studio':   return <ViewErrorBoundary viewName="Studio"><ViewStudio data={liveData} /></ViewErrorBoundary>;
      case 'tickets':  return <ViewErrorBoundary viewName="Live Events"><ViewTickets data={liveData} /></ViewErrorBoundary>;
      case 'settings':     return <ViewErrorBoundary viewName="Settings"><ViewSettings prefs={prefs} setPref={setPref} data={liveData} onBack={() => navigateTo(prevView)} /></ViewErrorBoundary>;
      case 'tour':         return <ViewErrorBoundary viewName="Tour Planner"><ViewTour data={liveData} /></ViewErrorBoundary>;
      case 'pagestudio':   return <ViewErrorBoundary viewName="Fan Page"><ViewPageStudio data={liveData} /></ViewErrorBoundary>;
      case 'artistpage':   return <ViewErrorBoundary viewName="Artist Page"><ViewArtistPage data={liveData} /></ViewErrorBoundary>;
      case 'venuepage':    return <ViewErrorBoundary viewName="Venue Page"><ViewVenuePage data={liveData} /></ViewErrorBoundary>;
      default:             return <ViewErrorBoundary viewName="My Page"><ViewMyPage data={liveData} onPickTrack={onPickTrack} currentIdx={currentIdx} /></ViewErrorBoundary>;
    }
  })();

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes eq { 0%,100% { height: 3px; } 50% { height: 10px; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        .wb-view-anim { animation: fadeIn .35s ease-out both; }
        *:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
        button, [role="button"] { min-height: 44px; }
        .wb-tab-btn { min-height: 44px !important; }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', fontFamily: 'var(--f-b)', color: 'var(--ink)' }}>
      <div
        className="wb-shell"
        style={{
          position: 'absolute', top: 0, bottom: 0,
          left: '50%', transform: 'translateX(-50%)',
          // Keep the queue inside the same page/header frame instead of
          // creating a wide, detached rail on the far right of large screens.
          width: '100%', maxWidth: shellMaxWidth,
          display: 'grid',
          gridTemplateColumns: colTemplate,
          gridTemplateRows: rowTemplate,
        }}
      >
        {/* Topbar — spans all columns */}
        <div style={{ gridColumn: '1 / -1', gridRow: 1 }}>
          <AppTopbar
            view={view}
            setView={navigateTo}
            listeningNow={liveData.listeningNow}
            initials={liveData.userInitials}
            userName={liveData.userName}
            activeProfileTypes={liveData.activeProfileTypes}
            onSettings={() => navigateTo('settings')}
            onSearch={() => setSearchOpen(true)}
            onShortcuts={() => setShortcutsOpen(true)}
            badges={{
              seeds: liveData.tracks.length > 0 ? String(liveData.tracks.length) : undefined,
              radio: liveData.radioShows.some(r => r.live) ? 'LIVE' : undefined,
              tickets: liveData.tickets.length > 0 ? String(liveData.tickets.length) : undefined,
            }}
            notifCount={notifCount}
            notifications={notifications}
          />
        </div>

        {/* Main content */}
        <main ref={mainRef} role="main" style={{
          gridColumn: 1, gridRow: 2,
          overflowY: isSeeds || isTour || isPageStudio ? 'hidden' : 'auto',
          overflowX: 'hidden',
          background: 'var(--bg)', minHeight: 0, minWidth: 0,
          fontSize: `calc(14px * var(--density, 1))`,
          position: 'relative',
        }}>
          {/* Ambient orb canvas — matches iHYPE Prototype.html design */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
            <div className="wb-bg-orb" style={{ width: 580, height: 580, top: -160, left: -80, background: 'radial-gradient(circle, rgba(255,80,41,.16), transparent 70%)', animationDelay: '0s' }} />
            <div className="wb-bg-orb" style={{ width: 650, height: 650, top: 80, right: -140, background: 'radial-gradient(circle, rgba(34,229,212,.09), transparent 70%)', animationDelay: '-8s' }} />
            <div className="wb-bg-orb" style={{ width: 380, height: 380, bottom: '10%', left: '35%', background: 'radial-gradient(circle, rgba(255,62,154,.07), transparent 70%)', animationDelay: '-16s' }} />
            <div className="wb-bg-grid" />
          </div>
          <div key={view} className="wb-view-anim" style={{ position: isTour || isPageStudio ? 'absolute' : 'relative', zIndex: 1, ...(isTour || isPageStudio ? { inset: 0 } : {}) }}>
            <React.Suspense fallback={
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, #1a1612 25%, #221c16 50%, #1a1612 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s infinite',
              }} />
            }>
              {viewEl}
            </React.Suspense>
          </div>
        </main>

        {/* Queue rail */}
        {showQueue && (
          <QueueRail tracks={tracks} currentIdx={currentIdx} onPick={onPickTrack} onClear={() => { setCurrentIdx(0); setPlaying(false); }} />
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
            onSeek={onSeekProgress}
          />
        )}
      </div>
      </div>
      {/* Hidden audio element for real playback */}
      <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />
      {toast && <Toast message={toast} onUndo={() => { setPlaying(false); setCurrentIdx(0); setToast(null); }} />}
      {showWelcome && <WelcomeDialog onDismiss={() => { localStorage.setItem('ihype-welcome-seen', '1'); setShowWelcome(false); }} />}
      {shortcutsOpen && <KeyboardShortcutsDialog onDismiss={() => setShortcutsOpen(false)} />}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <PasskeyNudge />
      <AgentShell
        data={liveData}
        currentView={view}
        onNavigate={(v) => navigateTo(v as Parameters<typeof navigateTo>[0])}
        onOpenSearch={() => setSearchOpen(true)}
      />
      {showGenreQuiz && liveData.profileId && (
        <WMGenreQuizSheet
          profileId={liveData.profileId}
          onComplete={() => { setShowGenreQuiz(false); localStorage.setItem('ihype_genre_quiz_dismissed', '1'); }}
        />
      )}
    </>
  );
}
