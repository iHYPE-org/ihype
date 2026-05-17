'use client';

import React, { useState, useEffect, useCallback, useRef, createContext, useContext, memo } from 'react';
import Image from 'next/image';
import { AccessibilityControls } from '@/components/AccessibilityControls';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import { SeedsSwipeStack, type SeedsSwipeStackSeed, type SeedsSwipeStackTrack } from '@/components/SeedsSwipeStack';
import { WorkbenchExtras } from '@/components/WorkbenchExtras';
import { CoHeadlinerSuggestions } from '@/components/CoHeadlinerSuggestions';
import { HypeHeatmap } from '@/components/HypeHeatmap';
import { PasskeyManager } from '@/components/AuthScreens';
import { useToast } from '@/components/Toast';

// ── Drag context ───────────────────────────────────────────────
const DragTrackCtx = createContext<{
  dragging: MediaTrack | null;
  setDragging: (t: MediaTrack | null) => void;
} | null>(null);

function useDragTrack() {
  return useContext(DragTrackCtx)!;
}

function DragTrackProvider({ children }: { children: React.ReactNode }) {
  const [dragging, setDragging] = useState<MediaTrack | null>(null);
  return <DragTrackCtx.Provider value={{ dragging, setDragging }}>{children}</DragTrackCtx.Provider>;
}

function DraggableTrack({ track, children, className, style, onClick }: {
  track: MediaTrack;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const { setDragging } = useDragTrack();
  return (
    <div
      draggable
      className={className}
      style={{ ...style, cursor: 'grab' }}
      onClick={onClick}
      onDragStart={e => {
        setDragging(track);
        e.dataTransfer.setData('application/ihype-track', JSON.stringify(track));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={() => setDragging(null)}
    >
      {children}
    </div>
  );
}

function QueueDropZone({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { addToQueue } = useMediaPlayer();
  const [over, setOver] = useState(false);
  return (
    <div
      className={className}
      style={{ ...style, outline: over ? '2px solid var(--wb-accent)' : undefined, borderRadius: over ? 8 : undefined, transition: 'outline 0.1s' }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        try {
          const track: MediaTrack = JSON.parse(e.dataTransfer.getData('application/ihype-track'));
          addToQueue(track);
        } catch { /* ignore */ }
      }}
    >
      {children}
    </div>
  );
}

function PlaylistDropZone({ name, children, className, style, onClick }: { name: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState(false);
  return (
    <div
      className={className}
      style={{ ...style, outline: over ? '2px solid #b983ff' : undefined, borderRadius: over ? 10 : undefined, transition: 'outline 0.1s' }}
      onClick={onClick}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
        // In production this would POST to /api/playlists
        void name; void flash;
      }}
    >
      {children}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────
export type WbTrack = {
  id: string;
  title: string;
  artistName: string;
  duration: string;
  durationSec: number;
  hypeCount: number;
  color: string;
  album: string;
  mediaUrl: string;
  artistSlug?: string | null;
};

export type WbShow = {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  hype: number;
  sold: number;
  capacity: number;
  price: number;
  status: 'TONIGHT' | 'THIS WEEK' | 'UPCOMING' | 'NEAR SOLD';
};

export type WbStat = {
  label: string;
  value: string;
  delta: string;
  color: string;
};

export type WbTicket = {
  id: string;
  showName: string;
  date: string;
  seat: string;
  price: number;
  status: string;
  code: string;
};

export type WbActivity = {
  text: string;
  time: string;
  kind: 'hype' | 'show' | 'radio' | 'payout' | 'request' | 'security';
};

export type WbNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: WbActivity['kind'];
  actionLabel?: string;
  view?: View;
  href?: string;
  unread?: boolean;
};

export type WbRadioShow = {
  id: string;
  name: string;
  host: string;
  time: string;
  next: string;
  live: boolean;
  listeners: number;
  color: string;
  desc: string;
};

export type WorkbenchData = {
  userName: string;
  userInitials: string;
  city: string;
  greeting: string;
  stats: WbStat[];
  tracks: WbTrack[];
  shows: WbShow[];
  tickets: WbTicket[];
  activity: WbActivity[];
  radioShows: WbRadioShow[];
  /** Profile types the logged-in user has: 'ARTIST' | 'VENUE' | 'LISTENER' | 'DJ' */
  activeProfileTypes: string[];
  profileType?: string;
  profileId?: string;
  profileHexId?: string;
  profilePath?: string;
  pendingVenueRequestCount?: number;
  profileCompletion?: { percent: number; missing: string[]; checks?: Array<{ label: string; ok: boolean }> };
  notifications?: WbNotification[];
  referralStats?: { clicks: number; buyers: number; grossCents: number; payoutCents: number };
  listeningNow: number;
  hypedToday: number;
  showsTonight: number;
  isVerified?: boolean;
  verificationRequested?: boolean;
  lifeStats?: { totalHype: number; totalEarnings: number; songsPlayed: number; eventsAttended: number };
};

// ── Default prefs ──────────────────────────────────────────────
const DEFAULT_PREFS = {
  accent: '#ff5029',
  density: 'cozy' as 'compact' | 'cozy' | 'comfy',
  queueRail: true,
  stickyDock: true,
  pinned: ['library', 'radio', 'tickets', 'studio'] as string[],
  panel_stats: true,
  panel_tonight: true,
  panel_activity: true,
  panel_hyped: true,
  city: 'Chicago, IL',
  greeting: 'warm' as 'warm' | 'minimal' | 'data',
};
type Prefs = typeof DEFAULT_PREFS;

// ── CSS variable helper ────────────────────────────────────────
function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  root.style.setProperty('--wb-accent', prefs.accent);
  const densMap = { compact: 0.85, cozy: 1, comfy: 1.15 };
  root.style.setProperty('--wb-density', String(densMap[prefs.density]));
  root.style.setProperty('--wb-rail-w', prefs.density === 'compact' ? '52px' : '56px');
  root.style.setProperty('--wb-queue-w', prefs.queueRail ? (prefs.density === 'compact' ? '270px' : '300px') : '0px');
  root.style.setProperty('--wb-player-h', prefs.density === 'compact' ? '58px' : '64px');
}

// ── Icons ──────────────────────────────────────────────────────
const Ic = ({ s = 16, sw = 1.6, children }: { s?: number; sw?: number; children: React.ReactNode }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const IcHome     = (p: {s?:number}) => <Ic s={p.s}><path d="M3 11l9-8 9 8"/><path d="M5 9v12h14V9"/></Ic>;
const IcLibrary  = (p: {s?:number}) => <Ic s={p.s}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M14 3v18"/></Ic>;
const IcRadio    = (p: {s?:number}) => <Ic s={p.s}><circle cx="12" cy="12" r="3"/><path d="M5.5 8.5a8 8 0 0 1 13 0M3 6a11 11 0 0 1 18 0M5.5 15.5a8 8 0 0 0 13 0M3 18a11 11 0 0 0 18 0"/></Ic>;
const IcTicket   = (p: {s?:number}) => <Ic s={p.s}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" strokeDasharray="2 2"/></Ic>;
const IcDiscover = (p: {s?:number}) => <Ic s={p.s}><circle cx="12" cy="12" r="9"/><polygon points="15 9 13 13 9 15 11 11" fill="currentColor" stroke="none"/></Ic>;
const IcShows    = (p: {s?:number}) => <Ic s={p.s}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></Ic>;
const IcSeeds    = (p: {s?:number}) => <Ic s={p.s}><path d="M12 22V12M12 12C12 7 7 4 2 4c0 5 3 8 10 8zM12 12c0-5 5-8 10-8-0 5-3 8-10 8z"/></Ic>;
const IcArtist   = (p: {s?:number}) => <Ic s={p.s}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M20 8l2 2-2 2M20 10h2"/></Ic>;
const IcStudio   = (p: {s?:number}) => <Ic s={p.s}><path d="M6 3v18M18 3v18M3 6h18M3 12h18M3 18h18"/></Ic>;
const IcSettings = (p: {s?:number}) => <Ic s={p.s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Ic>;
const IcPlay     = ({ s = 14 }: {s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>;
const IcPause    = ({ s = 14 }: {s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
const IcSkipP    = (p: {s?:number}) => <Ic {...p} sw={2}><polygon points="19 4 9 12 19 20" fill="currentColor"/><rect x="5" y="4" width="2" height="16" fill="currentColor"/></Ic>;
const IcSkipN    = (p: {s?:number}) => <Ic {...p} sw={2}><polygon points="5 4 15 12 5 20" fill="currentColor"/><rect x="17" y="4" width="2" height="16" fill="currentColor"/></Ic>;
const IcShuffle  = (p: {s?:number}) => <Ic {...p}><path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5"/></Ic>;
const IcRepeat   = (p: {s?:number}) => <Ic {...p}><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></Ic>;
const IcHeart    = ({ s = 14, c = 'currentColor' }: {s?:number; c?:string}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcQueue    = (p: {s?:number}) => <Ic {...p}><path d="M3 6h13M3 12h13M3 18h9M17 14v7l5-3.5z" fill="currentColor"/></Ic>;
const IcVol      = (p: {s?:number}) => <Ic {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor"/><path d="M15 9a3 3 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></Ic>;
const IcSearch   = (p: {s?:number}) => <Ic {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
const IcBolt     = (p: {s?:number}) => <Ic {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10" fill="currentColor"/></Ic>;
const IcCheck    = (p: {s?:number}) => <Ic {...p}><polyline points="20 6 9 17 4 12"/></Ic>;
const IcArrow    = ({ s = 14 }: {s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IcDot      = ({ c = 'currentColor', s = 8 }: {c?:string; s?:number}) => <svg width={s} height={s} viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill={c}/></svg>;

// ── Skeleton loader ────────────────────────────────────────────
function WbSkeleton({ width, height, style }: { width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <div className="wb-skeleton" style={{ width: width ?? '100%', height: height ?? 16, ...style }} />;
}

type View = 'home' | 'discover' | 'seeds' | 'tickets' | 'studio' | 'artist' | 'venue' | 'settings' | 'inbox';

// ── Onboarding modal ───────────────────────────────────────────
function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'Welcome to iHYPE',
      body: 'Your workbench is ready. iHYPE is a nonprofit music platform — 0% ticket fees, real fan demand, no algorithms.',
      cta: 'Next →',
    },
    {
      title: 'Create your first event',
      body: 'List a show, set your ticket price, and sell directly to fans. We take nothing.',
      cta: 'Got it →',
    },
    {
      title: 'Invite your fans',
      body: 'Share your iHYPE profile link with your audience. Every hype they give you is a real signal of demand.',
      cta: "Let's go →",
    },
  ];
  const current = steps[step];

  function handleCta() {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      try { localStorage.setItem('ihype-onboarded', '1'); } catch {}
      onDone();
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 14, padding: '36px 40px', maxWidth: 460, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,.5)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', color: 'var(--wb-accent)', marginBottom: 12 }}>
          STEP {step + 1} OF {steps.length}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: 28, height: 3, borderRadius: 2, background: i <= step ? 'var(--wb-accent)' : 'var(--wb-line-2)' }} />
          ))}
        </div>
        <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--wb-ink)', margin: '0 0 14px' }}>{current.title}</h2>
        <p style={{ fontFamily: 'var(--f-m)', fontSize: 14, color: 'var(--wb-ink-2)', lineHeight: 1.65, margin: '0 0 28px' }}>{current.body}</p>
        <button
          onClick={handleCta}
          style={{ background: 'var(--wb-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontFamily: 'var(--f-m)', fontSize: 13, letterSpacing: '.04em', cursor: 'pointer', width: '100%' }}
        >
          {current.cta}
        </button>
      </div>
    </div>
  );
}

// ── Main shell ─────────────────────────────────────────────────
export type StarterPackItem = {
  id: string;
  name: string;
  slug: string;
  hypeCount: number;
  city: string | null;
  genre: string | null;
};

export function WorkbenchShell({ data, starterPack = [] }: { data: WorkbenchData; starterPack?: StarterPackItem[] }) {
  const [view, setView] = useState<View>('home');
  const [liveStats, setLiveStats] = useState({
    listeningNow: data.listeningNow,
    hypedToday: data.hypedToday,
  });
  const [onboarded, setOnboarded] = useState(true); // true until mount check
  const [prefs, setPrefs] = useState<Prefs>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS;
    try {
      const stored = localStorage.getItem('ihype-wb-prefs');
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch { return DEFAULT_PREFS; }
  });

  const prefsPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    applyPrefs(prefs);
    if (prefsPersistRef.current) clearTimeout(prefsPersistRef.current);
    prefsPersistRef.current = setTimeout(() => {
      try { localStorage.setItem('ihype-wb-prefs', JSON.stringify(prefs)); } catch {}
    }, 400);
  }, [prefs]);

  // Apply on mount
  useEffect(() => { applyPrefs(prefs); }, []); // eslint-disable-line

  useEffect(() => {
    setLiveStats({
      listeningNow: data.listeningNow,
      hypedToday: data.hypedToday,
    });
  }, [data.listeningNow, data.hypedToday]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const response = await fetch('/api/stats/live');
        if (!response.ok) return;
        const stats = await response.json() as Partial<Pick<WorkbenchData, 'listeningNow' | 'hypedToday'>>;
        if (!active) return;
        setLiveStats((current) => ({
          listeningNow: typeof stats.listeningNow === 'number' ? stats.listeningNow : current.listeningNow,
          hypedToday: typeof stats.hypedToday === 'number' ? stats.hypedToday : current.hypedToday,
        }));
      } catch {
        // Keep the server-rendered stats if the live poll is unavailable.
      }
    };

    void poll();
    const id = setInterval(poll, 30000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Check onboarding state on mount
  useEffect(() => {
    try {
      const done = localStorage.getItem('ihype-onboarded');
      setOnboarded(!!done);
    } catch {
      setOnboarded(true);
    }
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

  const showQueue = prefs.queueRail;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const liveData: WorkbenchData = { ...data, ...liveStats };

  return (
    <DragTrackProvider>
      <div className="wb-root">
        {!onboarded && <OnboardingModal onDone={() => setOnboarded(true)} />}
        {sidebarOpen && <div className="wb-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
        <WbSidebar view={view} setView={(v) => { setView(v); setSidebarOpen(false); }} pinned={['home', ...prefs.pinned]} initials={liveData.userInitials} accent={prefs.accent} activeProfileTypes={liveData.activeProfileTypes} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} isVerified={liveData.isVerified} />
        <WbTopbar view={view} data={liveData} onHamburger={() => setSidebarOpen(s => !s)} setView={setView} />
        <main className="wb-main">
          {view === 'home'     && <ViewHome data={liveData} prefs={prefs} setView={setView} starterPack={starterPack} />}
          {view === 'discover' && <ViewDiscover data={liveData} />}
          {view === 'seeds'    && <ViewSeeds data={liveData} />}
          {view === 'tickets'  && <ViewTicketing data={liveData} activeProfileTypes={liveData.activeProfileTypes} />}
          {view === 'studio'   && <ViewRadioStudio />}
          {view === 'artist'   && <ViewArtist data={liveData} />}
          {view === 'venue'    && <ViewVenue data={liveData} />}
          {view === 'settings' && <ViewSettings prefs={prefs} setPref={setPref} />}
          {view === 'inbox'    && <ViewInbox data={liveData} setView={setView} />}
        </main>
        {showQueue && <WbQueueRail data={liveData} />}
        <WbPlayerDock queueRailOn={prefs.queueRail} onToggleQueue={() => setPref('queueRail', !prefs.queueRail)} />
      </div>
    </DragTrackProvider>
  );
}

// ── Sidebar ────────────────────────────────────────────────────
const NAV_ITEMS: { k: View; label: string; Icon: React.FC<{s?:number}> }[] = [
  { k: 'home',     label: 'Home',      Icon: IcHome },
  { k: 'discover', label: 'Discover',  Icon: IcDiscover },
  { k: 'seeds',    label: 'Seeds',     Icon: IcSeeds },
  { k: 'tickets',  label: 'Live Events', Icon: IcTicket },
  { k: 'studio',   label: 'Studio',    Icon: IcStudio },
];

function WbSidebar({ view, setView, initials, accent, activeProfileTypes, mobileOpen, isVerified }: { view: View; setView: (v: View) => void; pinned: string[]; initials: string; accent: string; activeProfileTypes: string[]; mobileOpen?: boolean; onMobileClose?: () => void; isVerified?: boolean }) {
  const isArtist = activeProfileTypes.includes('ARTIST');
  const isVenue  = activeProfileTypes.includes('VENUE');
  return (
    <aside className={`wb-sidebar${mobileOpen ? ' wb-sidebar-mobile-open' : ''}`}>
      <div className="wb-sb-logo">iH</div>
      <div className="wb-sb-stack">
        {NAV_ITEMS.map(({ k, label, Icon }) => (
          <SidebarBtn key={k} active={view === k} onClick={() => setView(k)} label={label} accent={accent}>
            <Icon s={18} />
          </SidebarBtn>
        ))}
        {isArtist && (
          <SidebarBtn active={view === 'artist'} onClick={() => setView('artist')} label="Artist" accent={accent}>
            <IcArtist s={18} />
          </SidebarBtn>
        )}
        {isVenue && (
          <SidebarBtn active={view === 'venue'} onClick={() => setView('venue')} label="Venue" accent={accent}>
            <IcShows s={18} />
          </SidebarBtn>
        )}
      </div>
      {!isArtist && !isVenue && (
        <SidebarBtn active={false} onClick={() => window.location.href = '/register'} label="Register as Artist/Venue" accent="#22e5d4">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </SidebarBtn>
      )}
      <div className="wb-sb-foot">
        <SidebarBtn active={view === 'settings'} onClick={() => setView('settings')} label="Settings" accent="rgba(255,255,255,.4)">
          <IcSettings s={18} />
        </SidebarBtn>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <div className="wb-sb-avatar" title={`${initials}`}>{initials}</div>
          {isVerified && (
            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid var(--wb-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, color: '#fff', fontWeight: 700 }}>✓</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function SidebarBtn({ active, onClick, label, children, accent }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode; accent: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="wb-sb-btn"
      style={{
        color: active ? accent : hover ? 'var(--wb-ink)' : 'var(--wb-ink-3)',
        background: active ? `${accent}18` : 'transparent',
      }}
    >
      {active && <span className="wb-sb-indicator" style={{ background: accent }} />}
      {children}
      {hover && <span className="wb-sb-tooltip">{label}</span>}
    </button>
  );
}

// ── Topbar ─────────────────────────────────────────────────────
const VIEW_TITLES: Record<View, string> = {
  home: 'Home', discover: 'Discover', seeds: 'Seeds', tickets: 'Ticketing',
  studio: 'Studio', artist: 'Artist', venue: 'Venue', settings: 'Settings', inbox: 'Inbox',
};

type SearchHit = { type: string; id: string; name: string; subtitle: string; slug?: string };
const TYPE_LABELS: Record<string, string> = { artist: 'Artist', venue: 'Venue', promoter: 'DJ', song: 'Track', show: 'Show' };

function WbTopbar({ view, data, onHamburger, setView }: { view: View; data: WorkbenchData; onHamburger: () => void; setView: (v: View) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playTrack } = useMediaPlayer();
  const unreadCount = data.notifications?.filter(n => n.unread).length ?? 0;

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=10`);
        const d = await res.json() as { results: SearchHit[] };
        setResults((d.results ?? []).filter(r => r.type !== 'genre'));
        setOpen(true);
      } catch { setResults([]); } finally { setBusy(false); }
    }, 220);
  }, [q]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape') { setOpen(false); setQ(''); inputRef.current?.blur(); }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function getHref(r: SearchHit) {
    if (!r.slug) return null;
    if (r.type === 'artist') return `/artists/${r.slug}`;
    if (r.type === 'venue') return `/venues/${r.slug}`;
    if (r.type === 'promoter') return `/promoters/${r.slug}`;
    if (r.type === 'show') return `/shows/${r.slug}`;
    return null;
  }

  function handleSelect(r: SearchHit) {
    if (r.type === 'song') {
      playTrack({ id: r.id, title: r.name, artistName: r.subtitle.replace(/^by /, '').split(' / ')[0], url: `/api/media/${r.id}`, mediaId: r.id, artistProfileSlug: r.slug ?? null });
    } else {
      const href = getHref(r);
      if (href) { window.location.href = href; return; }
    }
    setOpen(false); setQ('');
  }

  return (
    <header className="wb-topbar">
      <button className="wb-hamburger" onClick={onHamburger} aria-label="Toggle navigation">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div className="wb-top-logo">
        <span className="wb-top-logo-mark"><span style={{ color: 'var(--wb-ink)' }}>i</span><span style={{ color: 'var(--wb-accent)' }}>HYPE</span></span>
      </div>
      <div className="wb-top-mid">
        <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', letterSpacing: '.04em' }}>{VIEW_TITLES[view]}</span>
        <span className="wb-top-dot" />
        <span style={{ color: '#22e5d4', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}><IcDot c="#22e5d4" s={6} /> {data.listeningNow.toLocaleString()} listening</span>
        <span className="wb-top-dot" />
        <span style={{ fontSize: 11, color: 'var(--wb-ink-3)' }}>{data.hypedToday} hyped today</span>
        <button
          type="button"
          onClick={() => setView('inbox')}
          style={{ marginLeft: 8, border: '1px solid var(--wb-line-2)', borderRadius: 999, background: view === 'inbox' ? 'var(--wb-bg-3)' : 'transparent', color: 'var(--wb-ink-2)', fontFamily: 'var(--f-m)', fontSize: 10, padding: '5px 9px', cursor: 'pointer' }}
        >
          Inbox{unreadCount ? ` ${unreadCount}` : ''}
        </button>
      </div>
      <div className="wb-search" ref={wrapRef} style={{ position: 'relative' }}>
        <IcSearch s={13} />
        <input
          ref={inputRef}
          placeholder="Search artists, shows, venues, tracks…"
          className="wb-search-input"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {busy
          ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--wb-line-2)', borderTopColor: 'var(--wb-accent)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          : <><span className="wb-kbd">⌘</span><span className="wb-kbd">K</span></>
        }
        {open && results.length > 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,.5)', zIndex: 500, overflow: 'hidden', minWidth: 320 }}>
            {results.map(r => {
              const href = getHref(r);
              const inner = (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer' }}
                  onClick={() => handleSelect(r)}>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', color: 'var(--wb-accent)', border: '1px solid var(--wb-line-2)', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
                    {TYPE_LABELS[r.type] ?? r.type}
                  </span>
                  <span style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--wb-ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', flexShrink: 0 }}>{r.subtitle}</span>
                </div>
              );
              return href
                ? <a key={`${r.type}-${r.id}`} href={href} style={{ display: 'block', textDecoration: 'none', borderBottom: '1px solid var(--wb-line)' }} onClick={() => setOpen(false)}>{inner}</a>
                : <div key={`${r.type}-${r.id}`} style={{ borderBottom: '1px solid var(--wb-line)' }}>{inner}</div>;
            })}
          </div>
        )}
        {open && !busy && q.trim() && results.length === 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 10, padding: '12px 14px', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)', zIndex: 500 }}>
            No results for &ldquo;{q}&rdquo;
          </div>
        )}
      </div>
    </header>
  );
}

// ── Player dock ────────────────────────────────────────────────
function WbPlayerDock({ queueRailOn, onToggleQueue }: { queueRailOn: boolean; onToggleQueue: () => void }) {
  const { currentTrack, isPlaying, currentTime, duration, volume, togglePlayback, playNext, playPrevious, seekTo, setVolume, queue } = useMediaPlayer();

  const progress = duration > 0 ? currentTime / duration : 0;
  const fmtTime = (s: number) => {
    const sec = Math.floor(s);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  function handleScrub(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
  }

  function handleVolume(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setVolume(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  }

  return (
    <footer className="wb-dock">
      <div className="wb-dock-l">
        <div className="wb-dock-art" style={{ background: currentTrack ? 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)' : 'var(--wb-bg-3)' }}>
          {currentTrack?.artworkUrl && <Image src={currentTrack.artworkUrl} alt="" fill sizes="44px" style={{ objectFit: 'cover', borderRadius: 6 }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="wb-dock-title">{currentTrack?.title ?? 'Nothing playing'}</div>
          <div className="wb-dock-artist">{currentTrack?.artistName ?? 'Pick a track to start'}</div>
        </div>
        {currentTrack && (
          <button className="wb-heart-btn" title="Hype this track"><IcHeart s={14} c="#ff3e9a" /></button>
        )}
      </div>
      <div className="wb-dock-c">
        <div className="wb-dock-ctrls">
          <button className="wb-dock-btn"><IcShuffle s={14} /></button>
          <button className="wb-dock-btn" onClick={playPrevious}><IcSkipP s={14} /></button>
          <button className="wb-dock-play" onClick={togglePlayback}>{isPlaying ? <IcPause s={14} /> : <IcPlay s={14} />}</button>
          <button className="wb-dock-btn" onClick={playNext}><IcSkipN s={14} /></button>
          <button className="wb-dock-btn"><IcRepeat s={14} /></button>
        </div>
        <div className="wb-scrub-row">
          <span className="wb-time">{fmtTime(currentTime)}</span>
          <div className="wb-scrub-track" onClick={handleScrub}>
            <div className="wb-scrub-fill" style={{ width: `${progress * 100}%` }} />
            <div className="wb-scrub-knob" style={{ left: `${progress * 100}%` }} />
          </div>
          <span className="wb-time">{fmtTime(duration)}</span>
        </div>
      </div>
      <div className="wb-dock-r">
        <button
          className="wb-dock-btn"
          onClick={onToggleQueue}
          title="Toggle queue"
          style={{ color: queueRailOn ? 'var(--wb-accent)' : undefined, position: 'relative' }}
        >
          <IcQueue s={14} />
          {queue.length > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: 'var(--wb-accent)' }} />
          )}
        </button>
        <button className="wb-dock-btn" title={`Volume ${Math.round(volume * 100)}%`}><IcVol s={14} /></button>
        <div
          className="wb-vol-track"
          onClick={handleVolume}
          style={{ cursor: 'pointer' }}
          title={`Volume ${Math.round(volume * 100)}%`}
        >
          <div className="wb-vol-fill" style={{ width: `${volume * 100}%` }} />
        </div>
      </div>
    </footer>
  );
}

// ── Queue rail ─────────────────────────────────────────────────
function WbQueueRail({ data }: { data: WorkbenchData }) {
  const { currentTrack, currentIndex, queue, playTrack, removeFromQueue } = useMediaPlayer();
  const upcoming = queue.slice(currentIndex + 1);
  const played = queue.slice(0, currentIndex);

  return (
    <QueueDropZone className="wb-queue">
      <div className="wb-queue-head">
        <div>
          <div className="wb-queue-title">Queue</div>
          <div className="wb-queue-sub">
            {queue.length === 0 ? 'Drag tracks here to queue them' : `${upcoming.length} up next · ${played.length} played`}
          </div>
        </div>
        {queue.length > 0 && (
          <button className="wb-link-btn" onClick={() => queue.forEach(t => removeFromQueue(t.id))}>Clear</button>
        )}
      </div>
      <div className="wb-queue-list">
        {queue.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', lineHeight: 1.6 }}>
            Drag any track here from the radio set list, library, or search results.
          </div>
        ) : (
          queue.map((t, i) => {
            const active = currentTrack?.id === t.id && i === currentIndex;
            const isPast = i < currentIndex;
            return (
              <DraggableTrack key={`${t.id}-${i}`} track={t} className={`wb-q-item${active ? ' wb-q-item-active' : ''}`} onClick={() => playTrack(t, queue)}
                style={{ opacity: isPast ? 0.4 : 1 }}>
                <div className="wb-q-art" style={{ background: 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)', flexShrink: 0 }}>
                  {active && <span className="wb-q-playing"><IcDot c="var(--wb-accent)" s={6} /></span>}
                </div>
                <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <div className="wb-q-title">{t.title}</div>
                  <div className="wb-q-artist">{t.artistName}</div>
                </div>
                {active && <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', color: 'var(--wb-accent)' }}>NOW</span>}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--wb-ink-3)', cursor: 'pointer', padding: '2px 4px', fontSize: 14, lineHeight: 1 }}
                  onClick={e => { e.stopPropagation(); removeFromQueue(t.id); }}
                  title="Remove"
                >×</button>
              </DraggableTrack>
            );
          })
        )}
      </div>
      {queue.length === 0 && (
        <div className="wb-queue-foot">
          <span className="wb-eyebrow-xs">CURATED BY</span>
          <div style={{ fontStyle: 'italic', fontSize: 16, marginTop: 4, color: 'var(--wb-ink)' }}>iHYPE · {data.city}</div>
        </div>
      )}
    </QueueDropZone>
  );
}

// ── View: Home ─────────────────────────────────────────────────
function WbFirstSteps({ data, setView }: { data: WorkbenchData; setView: (v: View) => void }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem('ihype-firststeps-dismissed') === '1') setDismissed(true);
    } catch {}
  }, []);
  const completionPercent = data.profileCompletion?.percent ?? 0;
  // Auto-collapse if everything is done.
  if (dismissed || completionPercent >= 100) return null;
  const type = data.profileType ?? data.activeProfileTypes[0] ?? 'LISTENER';
  const roleName = type === 'DJ' ? 'promoter' : type === 'VENUE' ? 'venue' : type === 'ARTIST' ? 'artist' : 'fan';
  const completion = data.profileCompletion ?? { percent: 0, missing: ['Add profile details'] };
  const nextMissing = completion.missing.slice(0, 2).join(' + ') || 'Keep momentum going';
  const roleAction = type === 'ARTIST'
    ? { label: 'Add media', text: 'Upload or feature the track fans should hear first.', view: 'artist' as View }
    : type === 'VENUE'
    ? { label: 'Open ticketing', text: 'Put the first bookable night in motion.', view: 'venue' as View }
    : type === 'DJ'
    ? { label: 'Create a show', text: 'Start a show lane artists and fans can follow.', view: 'studio' as View }
    : { label: 'Discover seeds', text: 'Save three artists to tune the feed.', view: 'seeds' as View };
  const roleProfileText = type === 'VENUE'
    ? 'Add room details, contact, hours, and booking context.'
    : type === 'ARTIST'
    ? 'Add story, image, genres, contact, and a first media/show signal.'
    : type === 'DJ'
    ? 'Add the nights, scenes, artists, and contact details you champion.'
    : 'Add taste signals so recommendations become personal.';

  return (
    <section className="wb-panel wb-first-steps">
      <div className="wb-panel-head">
        <div>
          <div className="wb-panel-title">First 3 moves for your {roleName} lane</div>
          <div className="wb-small-muted">{completion.percent}% page strength - {nextMissing}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="wb-completion-ring" aria-label={`Profile completion ${completion.percent}%`}>
            <span>{completion.percent}%</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss getting-started checklist"
            onClick={() => {
              try { localStorage.setItem('ihype-firststeps-dismissed', '1'); } catch {}
              setDismissed(true);
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--wb-ink-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
      </div>
      {completion.checks?.length ? (
        <div className="wb-quality-list" aria-label="Public page readiness">
          {completion.checks.map((check) => (
            <span className={check.ok ? 'complete' : ''} key={check.label}>{check.label}</span>
          ))}
        </div>
      ) : null}
      <div className="wb-first-step-grid">
        <button className="wb-first-step" onClick={() => setView('settings')} type="button">
          <strong>Complete profile</strong>
          <span>{roleProfileText}</span>
        </button>
        <button className="wb-first-step" onClick={() => setView(roleAction.view)} type="button">
          <strong>{roleAction.label}</strong>
          <span>{roleAction.text}</span>
        </button>
        <a className="wb-first-step" href={data.profilePath ?? '/home'}>
          <strong>View public page</strong>
          <span>Check the page others see.</span>
        </a>
      </div>
    </section>
  );
}

function StarterPackPanel({ items }: { items: StarterPackItem[] }) {
  const [hypedIds, setHypedIds] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem('ihype-starter-dismissed') === '1') setDismissed(true); } catch {}
  }, []);
  if (dismissed || !items.length) return null;
  async function hype(id: string) {
    if (hypedIds.has(id)) return;
    setHypedIds((s) => new Set(s).add(id));
    try {
      await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'profile', targetId: id }),
      });
    } catch {}
  }
  return (
    <section className="wb-panel" style={{ marginBottom: 16 }}>
      <div className="wb-panel-head">
        <div>
          <div className="wb-panel-title">Starter pack — seed your feed</div>
          <div className="wb-small-muted">Tap HYPE on a few artists to personalize recommendations.</div>
        </div>
        <button
          type="button"
          onClick={() => { try { localStorage.setItem('ihype-starter-dismissed', '1'); } catch {} setDismissed(true); }}
          aria-label="Dismiss starter pack"
          style={{ background: 'transparent', border: 'none', color: 'var(--wb-ink-3)', cursor: 'pointer', fontSize: 18 }}
        >×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
        {items.map((a) => {
          const hyped = hypedIds.has(a.id);
          return (
            <div key={a.id} style={{ padding: 12, border: '1px solid var(--wb-line, #2a2622)', borderRadius: 10, background: 'var(--wb-bg-2, #181513)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: 'var(--wb-ink-3)', marginTop: 2 }}>
                {[a.genre, a.city].filter(Boolean).join(' · ') || 'Independent'}
              </div>
              <button
                type="button"
                onClick={() => hype(a.id)}
                disabled={hyped}
                className="wb-btn-prime"
                style={{ marginTop: 10, padding: '6px 12px', fontSize: 11, width: '100%' }}
              >
                {hyped ? '✓ Hyped' : `HYPE · ${a.hypeCount}`}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VerificationRequestBanner({ profileId }: { profileId: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function request() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/profile/verify-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
      if (res.ok) setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="wb-card" style={{ marginBottom: 16, padding: '12px 16px', borderLeft: '3px solid #22e5d4' }}>
        <span style={{ fontSize: 13 }}>Verification request submitted. Our team will review it shortly.</span>
      </div>
    );
  }

  return (
    <div className="wb-card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13 }}>Get verified to unlock booker-visible signals and the verified badge.</span>
      <button className="wb-btn-prime" disabled={busy} onClick={() => void request()} style={{ flexShrink: 0, fontSize: 12 }}>
        {busy ? 'Sending…' : 'Request Verification'}
      </button>
    </div>
  );
}

function ShareAndGrowCard({ data }: { data: WorkbenchData }) {
  const [copied, setCopied] = useState(false);
  const types = data.activeProfileTypes || [];
  const isArtistOrDJ = types.includes('ARTIST') || types.includes('DJ');
  if (!data.profilePath) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ihype.org';
  const referralUrl = `${origin}/register?ref=${data.profileHexId}`;
  const profileUrl = `${origin}${data.profilePath ?? ''}`;
  const primaryUrl = isArtistOrDJ && data.profileHexId ? referralUrl : profileUrl;
  const primaryLabel = isArtistOrDJ ? 'Copy referral' : 'Copy profile';
  const primaryCopy = isArtistOrDJ
    ? 'Share your referral link for attribution. Promoter payouts only happen when the referred person buys a ticketed show.'
    : types.includes('VENUE')
    ? 'Share your venue page so artists, promoters, and fans can find shows and booking context.'
    : 'Share your fan page to show the artists, venues, and events shaping your scene.';
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <section className="wb-panel" style={{ marginTop: 16, padding: '18px 22px', background: 'linear-gradient(135deg, rgba(185,131,255,0.08), rgba(34,229,212,0.05))', border: '1px solid rgba(185,131,255,0.25)' }}>
      <div className="wb-eyebrow" style={{ color: '#b983ff', marginBottom: 6 }}>● SHARE &amp; GROW</div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--wb-ink)', marginBottom: 4 }}>Invite fans &amp; build your network</div>
      <p className="wb-page-sub" style={{ marginBottom: 12, fontSize: 13 }}>{primaryCopy}</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input readOnly value={primaryUrl} style={{ flex: 1, padding: '8px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-accent)', outline: 'none' }} onClick={(e) => (e.target as HTMLInputElement).select()} />
        <button className="wb-btn-prime" onClick={() => copy(primaryUrl)} style={{ whiteSpace: 'nowrap' }}>{copied ? 'Copied ✓' : primaryLabel}</button>
      </div>
      {isArtistOrDJ ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input readOnly value={profileUrl} style={{ flex: 1, padding: '8px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-2)', outline: 'none' }} onClick={(e) => (e.target as HTMLInputElement).select()} />
        <button className="wb-btn-ghost" onClick={() => copy(profileUrl)} style={{ whiteSpace: 'nowrap' }}>Copy profile</button>
      </div> : null}
    </section>
  );
}

function VenueIncomingRequestsCard({ data }: { data: WorkbenchData }) {
  const types = data.activeProfileTypes || [];
  if (!types.includes('VENUE')) return null;
  const count = data.pendingVenueRequestCount ?? 0;
  if (count <= 0) return null;
  return (
    <section className="wb-panel" style={{ marginTop: 16, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(34,229,212,0.06)', border: '1px solid rgba(34,229,212,0.25)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,229,212,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-d)', fontWeight: 700, color: '#22e5d4', fontSize: 16 }}>{count}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>Incoming connection request{count === 1 ? '' : 's'}</div>
        <div className="wb-page-sub" style={{ margin: 0, fontSize: 12 }}>Artists and fans want to recommend acts to your venue.</div>
      </div>
      {data.profilePath ? (
        <a className="wb-btn-prime" href={`${data.profilePath}?section=request`} style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>Review →</a>
      ) : null}
    </section>
  );
}

const ACTIVITY_COLORS: Record<WbActivity['kind'], string> = {
  hype: '#ff3e9a',
  show: '#22e5d4',
  radio: '#b983ff',
  payout: '#ffb84a',
  request: '#7fb3ff',
  security: '#ff5029'
};

function RoleNextActionHub({ data, setView }: { data: WorkbenchData; setView: (v: View) => void }) {
  const type = data.profileType ?? data.activeProfileTypes[0] ?? 'LISTENER';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ihype.org';
  const profileUrl = data.profilePath ? `${origin}${data.profilePath}` : origin;
  const referralUrl = data.profileHexId ? `${origin}/register?ref=${data.profileHexId}` : profileUrl;
  const cards: Array<{ title: string; copy: string; action: string; view?: View; href?: string; run?: () => void | Promise<void> }> = type === 'ARTIST'
    ? [
        { title: 'Promote this week', copy: 'Share your profile, push a track, and point fans at the next show.', action: 'Share profile', run: () => navigator.clipboard?.writeText(profileUrl) },
        { title: 'Fan insights', copy: `${data.lifeStats?.totalHype ?? 0} total hypes and ${data.lifeStats?.songsPlayed ?? 0} listens are shaping your audience.`, action: 'Open artist tools', view: 'artist' as View },
        { title: 'Press kit', copy: 'Use your public page as the lightweight media kit for venues and promoters.', action: 'View page', href: data.profilePath }
      ]
    : type === 'DJ'
    ? [
        { title: 'Referral performance', copy: `${data.referralStats?.buyers ?? 0} buyers, $${((data.referralStats?.payoutCents ?? 0) / 100).toFixed(0)} estimated promoter payout.`, action: 'Open referrals', view: 'tickets' as View },
        { title: 'Curate radio', copy: 'Start a free live or prerecorded show to grow demand before ticketed events.', action: 'Create show', view: 'studio' as View },
        { title: 'Event templates', copy: 'Reuse show copy, announce links, and post-event recap language.', action: 'Create event', view: 'tickets' as View }
      ]
    : type === 'VENUE'
    ? [
        { title: 'Booking inbox', copy: `${data.pendingVenueRequestCount ?? 0} pending request${(data.pendingVenueRequestCount ?? 0) === 1 ? '' : 's'} from artists and fans.`, action: 'Review requests', view: 'venue' as View },
        { title: 'Open nights', copy: 'Use ticketing to turn available dates into confirmed shows.', action: 'Create event', view: 'tickets' as View },
        { title: 'Door tools', copy: 'QR scanning, guest list, sales, and payout status live together.', action: 'Open scanner', view: 'tickets' as View }
      ]
    : [
        { title: 'My Scene', copy: 'Hyped artists, followed venues, radio picks, and upcoming shows in one loop.', action: 'Tune feed', view: 'seeds' as View },
        { title: 'Show reminders', copy: data.shows[0] ? `Next nearby pick: ${data.shows[0].name}.` : 'Hype artists and shows to build reminders.', action: 'Browse events', view: 'tickets' as View },
        { title: 'Share discoveries', copy: 'Send a profile, show, or radio set to help the scene travel.', action: 'Discover', view: 'discover' as View }
      ];

  return (
    <section className="wb-panel" style={{ marginBottom: 16, padding: '18px 20px' }}>
      <div className="wb-panel-head">
        <div>
          <div className="wb-panel-title">Next best actions</div>
          <div className="wb-small-muted">Role-aware moves that keep discovery, sharing, tickets, and creation connected.</div>
        </div>
      </div>
      <div className="wb-first-step-grid">
        {cards.map((card) => {
          const content = (
            <>
              <strong>{card.title}</strong>
              <span>{card.copy}</span>
              <em style={{ color: 'var(--wb-accent)', fontStyle: 'normal', fontFamily: 'var(--f-m)', fontSize: 10, marginTop: 6 }}>{card.action}</em>
            </>
          );
          if (card.href) return <a className="wb-first-step" href={card.href} key={card.title}>{content}</a>;
          return <button className="wb-first-step" key={card.title} onClick={() => card.run ? card.run() : card.view ? setView(card.view) : undefined} type="button">{content}</button>;
        })}
      </div>
      {type === 'DJ' || type === 'ARTIST' ? (
        <div className="wb-small-muted" style={{ marginTop: 12 }}>
          Referral payouts apply only when a buyer uses your referral code on a ticketed show. Radio shows remain free community curation.
        </div>
      ) : null}
    </section>
  );
}

function ViewInbox({ data, setView }: { data: WorkbenchData; setView: (v: View) => void }) {
  const notifications = data.notifications ?? [];
  return (
    <div className="wb-view-pad" style={{ maxWidth: 900 }}>
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#7fb3ff' }}>● INBOX · ACTIONS</div>
          <h1 className="wb-page-title">Notifications</h1>
          <p className="wb-page-sub">Ticket updates, booking requests, referrals, verification, and show reminders.</p>
        </div>
      </div>
      <section className="wb-panel">
        {notifications.length === 0 ? (
          <div className="wb-empty">Nothing needs attention right now.</div>
        ) : notifications.map((n) => (
          <div key={n.id} className="wb-act-row" style={{ alignItems: 'flex-start' }}>
            <div className="wb-act-dot" style={{ background: ACTIVITY_COLORS[n.kind] }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wb-act-txt" style={{ color: 'var(--wb-ink)' }}>{n.title}</div>
              <div className="wb-small-muted" style={{ marginTop: 3 }}>{n.body}</div>
            </div>
            <div className="wb-act-time">{n.time}</div>
            {n.view ? <button className="wb-btn-ghost-sm" onClick={() => setView(n.view!)}>{n.actionLabel ?? 'Open'}</button> : null}
            {n.href ? <a className="wb-btn-ghost-sm" href={n.href} style={{ textDecoration: 'none' }}>{n.actionLabel ?? 'Open'}</a> : null}
          </div>
        ))}
      </section>
    </div>
  );
}

function ViewHome({ data, prefs, setView, starterPack = [] }: { data: WorkbenchData; prefs: Prefs; setView: (v: View) => void; starterPack?: StarterPackItem[] }) {
  const { playTrack, currentTrack } = useMediaPlayer();
  const [copied, setCopied] = useState(false);
  const now = new Date();
  const hour = now.getHours();
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greeting = prefs.greeting === 'minimal' ? data.userName : prefs.greeting === 'data'
    ? `${data.stats[0]?.value ?? '—'} hypes this week.`
    : `Good ${tod}, ${data.userName}.`;
  const shareProfile = () => {
    const profileUrl = new URL(data.profilePath ?? '/', window.location.origin).toString();
    navigator.clipboard.writeText(profileUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="wb-view-pad">
      {/* Greeting */}
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-ink-3)' }}>
            ● {now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} · {(prefs.city || data.city).toUpperCase()} · {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <h1 className="wb-page-title">{greeting}</h1>
          {data.greeting && <p className="wb-page-sub">{data.greeting}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button className="wb-btn-prime" onClick={() => setView('studio')}><IcBolt s={12} /> Start a radio show</button>
          <button className="wb-btn-ghost" onClick={() => setView('tickets')}>Browse events →</button>
          <button className="wb-btn-ghost" onClick={shareProfile}>{copied ? 'Copied!' : 'Share your profile →'}</button>
        </div>
      </div>

      <WbFirstSteps data={data} setView={setView} />
      {data.profileId && !data.isVerified && !data.verificationRequested && (data.activeProfileTypes ?? []).some(t => t === 'ARTIST' || t === 'DJ') && (
        <VerificationRequestBanner profileId={data.profileId} />
      )}
      <RoleNextActionHub data={data} setView={setView} />
      <ShareAndGrowCard data={data} />
      <VenueIncomingRequestsCard data={data} />
      <WorkbenchExtras
        activeProfileTypes={data.activeProfileTypes ?? []}
        profileId={data.profileId ?? null}
        profilePath={data.profilePath ?? null}
        userEmail={null}
      />
      <StarterPackPanel items={starterPack} />

      {/* Stats */}
      {prefs.panel_stats && data.stats.length > 0 && (
        <div className="wb-stat-row">
          {data.stats.map(s => (
            <div key={s.label} className="wb-stat-card">
              <div className="wb-stat-l">{s.label}</div>
              <div className="wb-stat-v">{s.value}</div>
              <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two-col row */}
      {(prefs.panel_tonight || prefs.panel_activity) && (
        <div className="wb-col-row">
          {prefs.panel_tonight && (
            <section className="wb-panel">
              <div className="wb-panel-head">
                <div className="wb-panel-title">Tonight in {prefs.city || data.city}</div>
                <button className="wb-link-btn" onClick={() => setView('tickets')}>All events →</button>
              </div>
              <div>
                {data.shows.slice(0, 3).map(s => (
                  <div key={s.id} className="wb-show-row">
                    <div className="wb-show-stripe" style={{ background: s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : 'var(--wb-ink-3)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="wb-show-name">{s.name} <span className="wb-show-venue">· {s.venue}</span></div>
                      <div className="wb-show-meta">{s.date} · {s.time} · ♡ {s.hype}</div>
                    </div>
                    <div className="wb-cap">
                      <div className="wb-cap-bar"><div className="wb-cap-fill" style={{ width: `${(s.sold / s.capacity) * 100}%`, background: s.sold / s.capacity > 0.85 ? '#ffb84a' : '#22e5d4' }} /></div>
                      <div className="wb-cap-txt">{s.sold}/{s.capacity}</div>
                    </div>
                    <button className="wb-row-btn"><IcArrow s={12} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {prefs.panel_activity && (
            <section className="wb-panel">
              <div className="wb-panel-head">
                <div className="wb-panel-title">Activity</div>
                <button className="wb-link-btn">Mark read</button>
              </div>
              <div>
                {data.activity.map((a, i) => (
                  <div key={i} className="wb-act-row">
                    <div className="wb-act-dot" style={{ background: ACTIVITY_COLORS[a.kind] }} />
                    <div style={{ flex: 1 }}>
                      <div className="wb-act-txt">{a.text}</div>
                    </div>
                    <div className="wb-act-time">{a.time}</div>
                  </div>
                ))}
                {data.activity.length === 0 && (
                  <div className="wb-act-row" style={{ color: 'var(--wb-ink-3)', fontSize: 13 }}>No recent activity</div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Hyped tracks */}
      {prefs.panel_hyped && data.tracks.length === 0 && (
        <section className="wb-panel" style={{ marginTop: 14 }}>
          <div className="wb-panel-head">
            <div className="wb-panel-title">Hyped this week</div>
          </div>
          <div className="wb-tracks-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <WbSkeleton height={80} style={{ borderRadius: 8 }} />
                <WbSkeleton height={12} width="80%" />
                <WbSkeleton height={10} width="60%" />
              </div>
            ))}
          </div>
        </section>
      )}
      {prefs.panel_hyped && data.tracks.length > 0 && (
        <section className="wb-panel" style={{ marginTop: 14 }}>
          <div className="wb-panel-head">
            <div className="wb-panel-title">Hyped this week</div>
            <button className="wb-link-btn" onClick={() => setView('seeds')}>Discover more →</button>
          </div>
          <div className="wb-tracks-grid">
            {data.tracks.slice(0, 6).map(t => {
              const active = currentTrack?.id === t.id;
              const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
              return (
                <button key={t.id} onClick={() => playTrack(mt)} className="wb-track-card" style={{ borderColor: active ? t.color : 'var(--wb-line)' }}>
                  <div className="wb-track-art" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }}>
                    <div className="wb-track-play"><IcPlay s={12} /></div>
                    <div className="wb-track-hype"><IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}</div>
                  </div>
                  <div className="wb-track-name">{t.title}</div>
                  <div className="wb-track-artist">{t.artistName} · {t.duration}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Lifetime heuristics */}
      <div className="wb-stat-row" style={{ marginTop: 14 }}>
        {[
          { l: 'TOTAL HYPE GIVEN', v: (data.lifeStats?.totalHype ?? 3841).toLocaleString(),   d: 'all time',          c: '#ff3e9a' },
          { l: 'TOTAL EARNINGS',   v: `$${(data.lifeStats?.totalEarnings ?? 9240).toLocaleString()}`, d: 'lifetime payouts', c: '#ffb84a' },
          { l: 'SONGS PLAYED',     v: (data.lifeStats?.songsPlayed ?? 12447).toLocaleString(), d: 'all time listens',  c: '#b983ff' },
          { l: 'EVENTS ATTENDED',  v: String(data.lifeStats?.eventsAttended ?? 28),            d: 'past tickets',      c: '#22e5d4' },
        ].map(s => (
          <div key={s.l} className="wb-stat-card">
            <div className="wb-stat-l">{s.l}</div>
            <div className="wb-stat-v">{s.v}</div>
            <div className="wb-stat-d" style={{ color: s.c }}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* Favorites row */}
      <div className="wb-col-row" style={{ marginTop: 14 }}>
        <section className="wb-panel">
          <div className="wb-panel-head">
            <div className="wb-panel-title">Top artists</div>
            <button className="wb-link-btn" onClick={() => setView('discover')}>All →</button>
          </div>
          {[
            { name: 'Maya Reyes',    plays: 341, c: '#ff5029' },
            { name: 'Cobalt Hour',   plays: 218, c: '#b983ff' },
            { name: 'Vela',          plays: 177, c: '#22e5d4' },
            { name: 'The Lowriders', plays: 134, c: '#ff3e9a' },
          ].map(a => (
            <div key={a.name} className="wb-act-row">
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${a.c}, ${a.c}80)`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><div className="wb-act-txt">{a.name}</div></div>
              <div className="wb-act-time">{a.plays} plays</div>
            </div>
          ))}
        </section>
        <section className="wb-panel">
          <div className="wb-panel-head">
            <div className="wb-panel-title">Favorite venues</div>
            <button className="wb-link-btn" onClick={() => setView('discover')}>All →</button>
          </div>
          {[
            { name: 'Empty Bottle',   shows: 7, c: '#22e5d4' },
            { name: 'Sleeping Village', shows: 4, c: '#ff3e9a' },
            { name: 'Subterranean',   shows: 3, c: '#b983ff' },
            { name: 'Hideout',        shows: 2, c: '#ffb84a' },
          ].map(v => (
            <div key={v.name} className="wb-act-row">
              <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg, ${v.c}, ${v.c}80)`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><div className="wb-act-txt">{v.name}</div></div>
              <div className="wb-act-time">{v.shows} shows</div>
            </div>
          ))}
        </section>
      </div>

    </div>
  );
}

// ── View: Radio ────────────────────────────────────────────────
const ViewRadio = memo(function ViewRadio({ data, setView }: { data: WorkbenchData; setView: (v: View) => void }) {
  const [activeId, setActiveId] = useState(data.radioShows[0]?.id ?? '');
  const { playTrack } = useMediaPlayer();
  const show = data.radioShows.find(r => r.id === activeId) ?? data.radioShows[0];

  if (!show) return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#ff3e9a' }}>● RADIO</div>
      <h1 className="wb-page-title">Radio</h1>
      <p className="wb-page-sub">No radio shows available yet. Be the first to start one.</p>
    </div>
  );

  const freqs = ['88.3', '94.1', '101.7', '107.9', '104.5'];
  const idx = data.radioShows.findIndex(r => r.id === activeId);

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#ff3e9a' }}>● ON AIR · {data.radioShows.length} CHANNELS · {data.listeningNow.toLocaleString()} LISTENING NOW</div>
          <h1 className="wb-page-title">Radio</h1>
          <p className="wb-page-sub">Curated shows from promoters, DJs, and artists. No ads, no algorithm — just real people picking music.</p>
        </div>
        <button className="wb-btn-outline" style={{ borderColor: 'var(--wb-accent)', color: 'var(--wb-accent)' }} onClick={() => setView('studio')}>
          <IcBolt s={12} /> Start your show →
        </button>
      </div>

      <div className="wb-radio-body">
        <div className="wb-channels">
          <div className="wb-channels-head">CHANNELS</div>
          {data.radioShows.map(r => (
            <button key={r.id} onClick={() => setActiveId(r.id)} className="wb-channel" style={{
              background: r.id === activeId ? `${r.color}10` : 'transparent',
              borderLeft: `2px solid ${r.id === activeId ? `${r.color}50` : 'transparent'}`,
            }}>
              <div className="wb-c-bar" style={{ background: r.color, opacity: r.live ? 1 : 0.3 }} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="wb-c-name">
                  {r.name}
                  {r.live && <span className="wb-live-dot">● LIVE</span>}
                </div>
                <div className="wb-c-meta">{r.host} · {r.time}</div>
              </div>
              <div className="wb-c-listen">{r.listeners}</div>
            </button>
          ))}
        </div>

        <div className="wb-radio-detail">
          <div className="wb-detail-hero" style={{ background: `linear-gradient(135deg, ${show.color}30 0%, transparent 60%), var(--wb-bg-2)` }}>
            <div className="wb-dh-top">
              {show.live
                ? <span className="wb-on-air"><IcDot c="#ff3e9a" s={8} /> ON AIR · {show.listeners} listening</span>
                : <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', letterSpacing: '.14em' }}>NEXT BROADCAST · {show.next}</span>
              }
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--wb-ink-2)' }}>{freqs[idx] ?? '—'} MHz</span>
            </div>
            <h2 className="wb-dh-title">{show.name}</h2>
            <div className="wb-dh-host">Hosted by <strong>{show.host}</strong> · {show.time}</div>
            <p className="wb-dh-desc">{show.desc}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="wb-btn-prime" style={{ background: show.live ? show.color : 'var(--wb-ink)', color: 'var(--wb-bg)' }}><IcPlay s={12} /> {show.live ? 'Tune in' : 'Archive'}</button>
              <button className="wb-btn-ghost">＋ Subscribe</button>
              <button className="wb-btn-ghost"><IcHeart s={12} c="#ff3e9a" /> Hype show</button>
            </div>
          </div>

          <div className="wb-panel">
            <div className="wb-panel-head">
              <div>
                <div className="wb-panel-title">Set list · this broadcast</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 3 }}>{show.live ? 'Played in the last hour' : 'Played last show'}</div>
              </div>
              <button className="wb-link-btn">Save all to playlist →</button>
            </div>
            <div>
              {data.tracks.slice(0, 6).map((t, i) => {
                const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
                return (
                  <DraggableTrack key={t.id} track={mt} className="wb-q-row" onClick={() => playTrack(mt)}>
                    <div className="wb-q-idx">{String(i + 1).padStart(2, '0')}</div>
                    <div className="wb-q-art-sm" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="wb-q-name">{t.title}</div>
                      <div className="wb-q-artist-sm">{t.artistName} · {t.album}</div>
                    </div>
                    <div className="wb-q-chip">{i === 0 && show.live ? 'NOW' : i < 2 ? 'JUST PLAYED' : `-${i * 4}m`}</div>
                    <div className="wb-q-hype-sm"><IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}</div>
                  </DraggableTrack>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ── View: Ticketing ────────────────────────────────────────────
const ViewTicketing = memo(function ViewTicketing({ data, activeProfileTypes }: { data: WorkbenchData; activeProfileTypes: string[] }) {
  const canCreateEvents = activeProfileTypes.some(r => r === 'ARTIST' || r === 'VENUE');
  const isDJ = activeProfileTypes.includes('DJ');
  const isVenue = activeProfileTypes.includes('VENUE');
  const [tab, setTab] = useState<'browse' | 'recommended' | 'mine' | 'selling' | 'scan' | 'create' | 'referral' | 'venue'>('browse');
  const upcoming = data.tickets[0];
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferSent, setTransferSent] = useState(false);

  return (
    <div className="wb-view-pad">
      {showTransfer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 14, padding: '32px 36px', maxWidth: 420, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,.5)' }}>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', color: 'var(--wb-ink)', margin: '0 0 6px' }}>Transfer ticket</h2>
            {transferSent ? (
              <>
                <p style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: '#22e5d4', lineHeight: 1.6, margin: '16px 0 24px' }}>Transfer sent — the recipient will get an email to claim their ticket.</p>
                <button onClick={() => setShowTransfer(false)} className="wb-btn-prime" style={{ width: '100%' }}>Close</button>
              </>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink-3)', lineHeight: 1.6, margin: '6px 0 20px' }}>The recipient will receive an email to claim this ticket. Your ticket will be invalidated immediately.</p>
                <label style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: 'var(--wb-ink-3)', display: 'block', marginBottom: 6 }}>RECIPIENT'S EMAIL ADDRESS</label>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={e => setTransferEmail(e.target.value)}
                  placeholder="fan@example.com"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink)', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button className="wb-btn-prime" style={{ flex: 1 }} onClick={() => setTransferSent(true)}>Send transfer →</button>
                  <button className="wb-btn-ghost" onClick={() => setShowTransfer(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● {data.showsTonight} TONIGHT · {data.city.toUpperCase()} · NO QUEUES, NO SCALPERS</div>
          <h1 className="wb-page-title">Events & Tickets</h1>
          <p className="wb-page-sub">Browse events, buy and hold tickets, and verify at the door — all within iHYPE. Every dollar settles directly to artists and venues.</p>
        </div>
        <div className="wb-tabs">
          <button onClick={() => setTab('browse')} className={`wb-tab${tab === 'browse' ? ' wb-tab-active' : ''}`}>Browse</button>
          <button onClick={() => setTab('recommended')} className={`wb-tab${tab === 'recommended' ? ' wb-tab-active' : ''}`}>Recommended</button>
          <button onClick={() => setTab('mine')} className={`wb-tab${tab === 'mine' ? ' wb-tab-active' : ''}`}>My tickets</button>
          <button onClick={() => setTab('selling')} className={`wb-tab${tab === 'selling' ? ' wb-tab-active' : ''}`}>Selling</button>
          <button onClick={() => setTab('scan')} className={`wb-tab${tab === 'scan' ? ' wb-tab-active' : ''}`}>Scan / verify</button>
          {canCreateEvents && (
            <button onClick={() => setTab('create')} className={`wb-tab${tab === 'create' ? ' wb-tab-active' : ''}`}>＋ Create event</button>
          )}
          {isVenue && (
            <button onClick={() => setTab('venue')} className={`wb-tab${tab === 'venue' ? ' wb-tab-active' : ''}`}>Venue overview</button>
          )}
          {isDJ && (
            <button onClick={() => setTab('referral')} className={`wb-tab${tab === 'referral' ? ' wb-tab-active' : ''}`}>Referral link</button>
          )}
        </div>
      </div>

      {tab === 'recommended' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--wb-ink-3)', marginBottom: 4 }}>BASED ON YOUR HYPES + LOCATION</div>
          {[
            { id: 'r1', name: 'Maya Reyes', venue: 'Empty Bottle', date: 'Thu Jun 18', time: '9PM', price: 18, hype: 412, reason: 'You hyped this artist 3× this week' },
            { id: 'r2', name: 'Cobalt Hour', venue: 'Sleeping Village', date: 'Sat Jun 20', time: '8PM', price: 15, hype: 287, reason: 'Fans like you are going' },
            { id: 'r3', name: 'Vela', venue: 'Subterranean', date: 'Tue Jun 23', time: '8PM', price: 12, hype: 156, reason: 'Trending in Chicago' },
          ].map(s => (
            <div key={s.id} className="wb-shows-row">
              <div style={{ width: 56, height: 56, borderRadius: 6, background: 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16 }}>{s.name} <span style={{ color: 'var(--wb-ink-3)', fontWeight: 500 }}>· {s.venue}</span></div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)', marginTop: 4 }}>{s.date} · {s.time} · ♡ {s.hype}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#22e5d4', marginTop: 3 }}>{s.reason}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-d)', fontSize: 20, fontWeight: 700 }}>${s.price}</div>
              <button className="wb-btn-prime">Get ticket</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {data.shows.map(s => (
            <div key={s.id} className="wb-shows-row">
              <div style={{ width: 56, height: 56, borderRadius: 6, background: 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16 }}>{s.name} <span style={{ color: 'var(--wb-ink-3)', fontWeight: 500 }}>· {s.venue}</span></div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)', marginTop: 4 }}>{s.date} · {s.time} · ♡ {s.hype}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-d)', fontSize: 20, fontWeight: 700 }}>{s.price > 0 ? `$${s.price}` : 'Free'}</div>
              <button className="wb-btn-prime" onClick={() => setTab('mine')}>Get ticket</button>
            </div>
          ))}
          {data.shows.length === 0 && (
            <div className="wb-empty">No shows found for {data.city}. Check back soon or explore another city in Settings.</div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <>
          {upcoming && (
            <div style={{ marginBottom: 18 }}>
              <div className="wb-eyebrow-xs" style={{ marginBottom: 10 }}>NEXT UP</div>
              <div className="wb-hero-ticket">
                <div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#22e5d4', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcDot c="#22e5d4" s={7} /> CONFIRMED
                  </div>
                  <h2 className="wb-hero-name">{upcoming.showName}</h2>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-2)', letterSpacing: '.06em' }}>{upcoming.date}</div>
                  <div className="wb-hero-facts">
                    <div><div className="wb-fact-l">SEAT</div><div className="wb-fact-v">{upcoming.seat}</div></div>
                    <div><div className="wb-fact-l">PAID</div><div className="wb-fact-v">${upcoming.price.toFixed(2)}</div></div>
                    <div><div className="wb-fact-l">CODE</div><div className="wb-fact-v" style={{ fontFamily: 'var(--f-m)' }}>{upcoming.code}</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
                    <button className="wb-btn-prime">Show at door →</button>
                    <button className="wb-btn-ghost" onClick={() => { setShowTransfer(true); setTransferSent(false); setTransferEmail(''); }}>Transfer</button>
                    <button className="wb-btn-ghost">Add to Wallet</button>
                    <button className="wb-btn-danger">Request refund</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div className="wb-qr-box">
                    <svg width={100} height={100} viewBox="0 0 80 80" fill="currentColor">
                      {[[0,0],[60,0],[0,60]].map(([x,y],i)=>(
                        <g key={i}><rect x={x} y={y} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3"/><rect x={x+6} y={y+6} width="8" height="8"/></g>
                      ))}
                      {Array.from({length:80}).map((_,i)=>{
                        const x = 24+(i%10)*4, y = 24+Math.floor(i/10)*4;
                        return (i*13+7)%3===0 ? <rect key={i} x={x} y={y} width="3" height="3"/> : null;
                      })}
                    </svg>
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)', textAlign: 'center', maxWidth: 120 }}>Signed by iHYPE · scan with venue app</div>
                </div>
              </div>
            </div>
          )}
          <div className="wb-panel">
            <div className="wb-panel-head">
              <div className="wb-panel-title">All my tickets</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{data.tickets.length} active</div>
            </div>
            {data.tickets.map(tk => (
              <div key={tk.id} className="wb-ticket-row">
                <div className="wb-ticket-stripe" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-show-name">{tk.showName}</div>
                  <div className="wb-show-meta">{tk.date}</div>
                </div>
                <div className="wb-ticket-col"><div className="wb-fact-l">SEAT</div><div className="wb-fact-v">{tk.seat}</div></div>
                <div className="wb-ticket-col"><div className="wb-fact-l">PAID</div><div className="wb-fact-v">${tk.price}</div></div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)' }}>{tk.code}</div>
                <div className="wb-status-pill" style={{ color: tk.status === 'CONFIRMED' ? '#22e5d4' : '#ffb84a', borderColor: tk.status === 'CONFIRMED' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)' }}>{tk.status}</div>
                <button className="wb-row-btn"><IcArrow s={12} /></button>
              </div>
            ))}
            {data.tickets.length === 0 && (
              <div className="wb-act-row" style={{ color: 'var(--wb-ink-3)', fontSize: 13 }}>No tickets yet — browse shows to get started.</div>
            )}
          </div>
          {data.tickets.length > 0 ? (
            <div className="wb-panel" style={{ marginTop: 14, padding: '16px 18px' }}>
              <div className="wb-panel-title">Post-show recap</div>
              <p className="wb-page-sub" style={{ fontSize: 12, margin: '6px 0 12px' }}>After the show, save the artists discovered, songs played, and a shareable memory for your scene.</p>
              <button className="wb-btn-ghost" onClick={() => setTab('recommended')}>Find related artists</button>
            </div>
          ) : null}
        </>
      )}

      {tab === 'selling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="wb-stat-row">
            {[
              { label: 'TICKETS SOLD', value: String(data.shows.reduce((a, s) => a + s.sold, 0)), delta: 'across ' + data.shows.length + ' shows', color: '#22e5d4' },
              { label: 'GROSS', value: '$' + data.shows.reduce((a, s) => a + s.sold * s.price, 0).toLocaleString(), delta: 'this month', color: '#22e5d4' },
              { label: 'PLATFORM FEE', value: '0%', delta: 'always', color: '#b983ff' },
              { label: 'PAYOUT PENDING', value: data.stats.find(s => s.label.includes('PAYOUT'))?.value ?? '—', delta: 'next payout date', color: '#ffb84a' },
            ].map(s => (
              <div key={s.label} className="wb-stat-card">
                <div className="wb-stat-l">{s.label}</div>
                <div className="wb-stat-v">{s.value}</div>
                <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
              </div>
            ))}
          </div>
          <div className="wb-panel">
            <div className="wb-panel-head">
              <div className="wb-panel-title">Shows on sale</div>
              <button className="wb-btn-prime">＋ New show</button>
            </div>
            {data.shows.map(s => (
              <div key={s.id} className="wb-ticket-row">
                <div className="wb-show-stripe" style={{ background: '#22e5d4' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-show-name">{s.name} <span className="wb-show-venue">· {s.venue}</span></div>
                  <div className="wb-show-meta">{s.date} · {s.time}</div>
                </div>
                <div className="wb-ticket-col">
                  <div className="wb-fact-l">SOLD</div>
                  <div className="wb-cap-bar" style={{ width: 80, marginTop: 4 }}>
                    <div className="wb-cap-fill" style={{ width: `${(s.sold / s.capacity) * 100}%`, background: s.sold / s.capacity > 0.85 ? '#ffb84a' : '#22e5d4' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-2)', marginTop: 5 }}>{s.sold} / {s.capacity}</div>
                </div>
                <div className="wb-ticket-col"><div className="wb-fact-l">PRICE</div><div className="wb-fact-v">${s.price}</div></div>
                <div className="wb-ticket-col"><div className="wb-fact-l">GROSS</div><div className="wb-fact-v">${(s.sold * s.price).toLocaleString()}</div></div>
                <button className="wb-btn-ghost-sm">Manage →</button>
              </div>
            ))}
            {data.shows.length === 0 && (
              <div className="wb-act-row" style={{ color: 'var(--wb-ink-3)', fontSize: 13 }}>No shows on sale — create your first show above.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'scan' && (
        <div className="wb-scan-card">
          <div>
            <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● VENUE MODE · DOOR SCANNER</div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '8px 0' }}>Door scanner</h2>
            <p className="wb-page-sub">Point a phone camera at the QR. Valid tickets show green; transferred tickets reveal the chain. Replays are blocked at the protocol layer.</p>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { code: 'iH-MR18-K3X9', meta: 'GA · admitted 21:04', valid: true },
                { code: 'iH-MR18-7QQR', meta: 'Transferred 14m ago · GA · admitted 21:06', valid: true },
                { code: 'iH-MR18-9BLN', meta: 'Already scanned at 20:51 · blocked', valid: false },
              ].map((r, i) => (
                <div key={i} className="wb-scan-row" style={{ borderLeft: `2px solid ${r.valid ? '#22e5d4' : '#ff5029'}` }}>
                  {r.valid ? <IcCheck s={14} /> : <span style={{ fontSize: 14 }}>⨯</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink)' }}>{r.code}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{r.meta}</div>
                  </div>
                  <div style={{ color: r.valid ? '#22e5d4' : '#ff5029', fontFamily: 'var(--f-m)', fontSize: 11 }}>{r.valid ? 'VALID' : 'REPLAY'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="wb-scan-viewport">
            <div className="wb-scan-laser" />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', letterSpacing: '.1em' }}>Ready for QR…</div>
          </div>
        </div>
      )}

      {tab === 'create' && canCreateEvents && <ViewEventCreator />}

      {tab === 'venue' && isVenue && (() => {
        const totalSold = data.shows.reduce((a, s) => a + s.sold, 0);
        const totalGross = data.shows.reduce((a, s) => a + s.sold * s.price, 0);
        return (
          <>
            <div className="wb-stat-row" style={{ marginTop: 8 }}>
              {[
                { label: 'SHOWS HOSTED',   value: String(data.shows.length),              delta: 'this season',       color: '#22e5d4' },
                { label: 'TICKETS SOLD',   value: String(totalSold),                       delta: 'across all shows',  color: '#22e5d4' },
                { label: 'GROSS REVENUE',  value: `$${totalGross.toLocaleString()}`,       delta: 'at face value',     color: '#ffb84a' },
                { label: 'PLATFORM FEE',   value: '0%',                                    delta: 'always',            color: '#b983ff' },
              ].map(s => (
                <div key={s.label} className="wb-stat-card">
                  <div className="wb-stat-l">{s.label}</div>
                  <div className="wb-stat-v">{s.value}</div>
                  <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
                </div>
              ))}
            </div>
            <div className="wb-panel" style={{ marginTop: 12, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 8, background: 'rgba(34,229,212,.12)', color: '#22e5d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-d)', fontWeight: 800 }}>
                {data.pendingVenueRequestCount ?? 0}
              </div>
              <div style={{ flex: 1 }}>
                <div className="wb-panel-title">Booking request inbox</div>
                <div className="wb-small-muted">Review artist requests, fan recommendations, pending holds, and open-night opportunities.</div>
              </div>
              {data.profilePath ? <a className="wb-btn-prime" href={`${data.profilePath}?section=request`} style={{ textDecoration: 'none' }}>Open requests</a> : null}
            </div>
            <div className="wb-panel" style={{ marginTop: 12 }}>
              <div className="wb-panel-head">
                <div className="wb-panel-title">All shows</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{data.shows.length} total</div>
              </div>
              {data.shows.length === 0 && <div className="wb-empty">No shows yet — create your first event.</div>}
              {data.shows.map(s => (
                <div key={s.id} className="wb-ticket-row">
                  <div className="wb-show-stripe" style={{ background: s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : 'var(--wb-ink-3)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="wb-show-name">{s.name}</div>
                    <div className="wb-show-meta">{s.date} · {s.time}</div>
                  </div>
                  <div className="wb-cap">
                    <div className="wb-cap-bar"><div className="wb-cap-fill" style={{ width: `${(s.sold / s.capacity) * 100}%`, background: s.sold / s.capacity > 0.85 ? '#ffb84a' : '#22e5d4' }} /></div>
                    <div className="wb-cap-txt">{s.sold}/{s.capacity}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--wb-ink)', minWidth: 60, textAlign: 'right' }}>${(s.sold * s.price).toLocaleString()}</div>
                  <div className="wb-status-pill" style={{ color: s.status === 'TONIGHT' ? '#22e5d4' : '#ffb84a', borderColor: s.status === 'TONIGHT' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)' }}>{s.status}</div>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {tab === 'referral' && isDJ && (
        <div className="wb-panel" style={{ marginTop: 20, padding: '24px 28px' }}>
          <div className="wb-eyebrow" style={{ color: '#b983ff', marginBottom: 10 }}>● PROMOTER / DJ · REFERRAL LINKS · 10% ON TICKETS YOU DRIVE</div>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', color: 'var(--wb-ink)', margin: '0 0 8px' }}>Your referral link</h2>
          <p className="wb-page-sub" style={{ marginBottom: 18 }}>Share your link for ticketed events. When fans buy tickets through it, you earn your promoter portion of the ticket payout. Free radio shows do not create payouts.</p>
          <div className="wb-stat-row" style={{ marginBottom: 18 }}>
            {[
              { label: 'LINK CLICKS', value: String(data.referralStats?.clicks ?? 0), delta: 'tracked joins', color: '#b983ff' },
              { label: 'TICKET BUYERS', value: String(data.referralStats?.buyers ?? 0), delta: 'orders attributed', color: '#22e5d4' },
              { label: 'GROSS DRIVEN', value: `$${((data.referralStats?.grossCents ?? 0) / 100).toFixed(0)}`, delta: 'ticket sales', color: '#ff3e9a' },
              { label: 'EST. PAYOUT', value: `$${((data.referralStats?.payoutCents ?? 0) / 100).toFixed(0)}`, delta: 'promoter portion', color: '#ffb84a' }
            ].map(s => (
              <div key={s.label} className="wb-stat-card">
                <div className="wb-stat-l">{s.label}</div>
                <div className="wb-stat-v">{s.value}</div>
                <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <input readOnly value={`https://ihype.org/register?ref=${data.profileHexId ?? data.userInitials?.toLowerCase() ?? 'you'}`} style={{ flex: 1, padding: '10px 14px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-accent)', outline: 'none' }} />
            <button className="wb-btn-prime" onClick={() => navigator.clipboard?.writeText(`https://ihype.org/register?ref=${data.profileHexId ?? data.userInitials?.toLowerCase() ?? 'you'}`)}>Copy</button>
          </div>
          <div className="wb-panel" style={{ background: 'var(--wb-bg-3)' }}>
            <div className="wb-panel-head"><div className="wb-panel-title">Events you're attached to</div></div>
            {data.shows.length === 0 ? (
              <div className="wb-empty">No events linked yet — share your referral link with organizers to get attached.</div>
            ) : data.shows.map(s => (
              <div key={s.id} className="wb-ticket-row">
                <div className="wb-show-stripe" style={{ background: '#b983ff' }} />
                <div style={{ flex: 1 }}><div className="wb-show-name">{s.name}</div><div className="wb-show-meta">{s.date} · {s.venue}</div></div>
                <div className="wb-status-pill" style={{ color: '#b983ff', borderColor: 'rgba(185,131,255,.3)' }}>ATTACHED</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ── View: Radio studio ─────────────────────────────────────────
const ViewRadioStudio = memo(function ViewRadioStudio() {
  const [mode, setMode] = useState<'scheduled' | 'live'>('scheduled');
  const [showName, setShowName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [desc, setDesc] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDesc, setStreamDesc] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const field: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink)', outline: 'none', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: 'var(--wb-ink-3)', marginBottom: 6, display: 'block' };
  const grp: React.CSSProperties = { display: 'flex', flexDirection: 'column' as const };

  async function handleSubmit() {
    const requiredName = mode === 'scheduled' ? showName : streamTitle;
    if (!requiredName.trim()) { setErrMsg('Show name is required.'); return; }
    setErrMsg('');
    setSubmitStatus('loading');
    await new Promise(r => setTimeout(r, 600));
    setSubmitStatus('success');
  }

  function handleReset() {
    setSubmitStatus('idle');
    setShowName(''); setSchedule(''); setDesc('');
    setStreamTitle(''); setStreamDesc('');
  }

  if (submitStatus === 'success') return (
    <div className="wb-view-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>{mode === 'live' ? '🔴' : '📻'}</div>
      <h2 className="wb-page-title" style={{ fontSize: 28 }}>{mode === 'live' ? (streamTitle || 'Live stream') : (showName || 'Your show')}</h2>
      <p className="wb-page-sub">{mode === 'live' ? 'You\'re live. Fans can tune in now from the Radio tab.' : 'Your show is scheduled. Fans can find it in the Radio tab.'}</p>
      <button className="wb-btn-prime" onClick={handleReset}>Create another</button>
    </div>
  );

  return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#ff3e9a' }}>● RADIO STUDIO · ALL ROLES CAN BROADCAST</div>
      <h1 className="wb-page-title">Create a show</h1>
      <p className="wb-page-sub">Launch a live or prerecorded radio show. Anyone can curate music, tell people what they love, and share it with the scene. Radio shows are free community programming, not a payout product.</p>

      <div className="wb-tabs" style={{ marginBottom: 20, marginTop: 16 }}>
        <button onClick={() => { setMode('scheduled'); setErrMsg(''); }} className={`wb-tab${mode === 'scheduled' ? ' wb-tab-active' : ''}`}>Scheduled show</button>
        <button onClick={() => { setMode('live'); setErrMsg(''); }} className={`wb-tab${mode === 'live' ? ' wb-tab-active' : ''}`}><IcDot c="#ff3e9a" s={7} /> Go live</button>
      </div>

      {mode === 'scheduled' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          <div className="wb-panel">
            <div className="wb-panel-head"><div className="wb-panel-title">Show details</div></div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={grp}><label style={lbl}>SHOW NAME</label><input style={field} value={showName} onChange={e => setShowName(e.target.value)} placeholder="e.g. Late Night with Maya" /></div>
              <div style={grp}><label style={lbl}>BROADCAST SCHEDULE</label><input style={field} value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="e.g. Fridays 10pm CT" /></div>
              <div style={grp}><label style={lbl}>DESCRIPTION</label><textarea rows={4} style={{ ...field, resize: 'vertical' as const }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's the vibe? Genre, format, guests…" /></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="wb-panel" style={{ padding: '18px 16px' }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--wb-ink-3)', marginBottom: 12 }}>PREVIEW</div>
              <div style={{ aspectRatio: '1', borderRadius: 8, background: 'linear-gradient(135deg, #ff3e9a, #b983ff80)', marginBottom: 14, maxHeight: 120 }} />
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--wb-ink)' }}>{showName || 'Your show name'}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', marginTop: 4 }}>{schedule || 'Schedule TBD'}</div>
            </div>
            <div className="wb-panel" style={{ padding: '18px 16px', display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--wb-ink)' }}>Community curation</div>
                <p style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', lineHeight: 1.6, margin: '8px 0 0' }}>
                  Build a playlist-style show, spotlight artists, or host a live listening room. These broadcasts help music travel through real people.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  ['Curate', 'Add the songs and artists you want others to hear.'],
                  ['Share', 'Send listeners to the Radio tab or your public show archive.'],
                  ['Refer tickets separately', 'Referral payouts only apply when someone buys a ticket to a ticketed show with your referral code.']
                ].map(([label, copy]) => (
                  <div key={label} style={{ padding: '10px 12px', border: '1px solid var(--wb-line-2)', borderRadius: 8, background: 'var(--wb-bg-3)' }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: '#ff3e9a', marginBottom: 4 }}>{label.toUpperCase()}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)', lineHeight: 1.55 }}>{copy}</div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleSubmit} className="wb-btn-prime" style={{ width: '100%', justifyContent: 'center' }}>
                Schedule &amp; publish â†’
              </button>
            </div>
            {errMsg && <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff5029', padding: '8px 12px', border: '1px solid rgba(255,80,41,.3)', borderRadius: 6 }}>{errMsg}</div>}
          </div>
        </div>
      )}

      {mode === 'live' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          <div className="wb-panel">
            <div className="wb-panel-head"><div className="wb-panel-title">Stream details</div></div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={grp}><label style={lbl}>STREAM TITLE</label><input style={field} value={streamTitle} onChange={e => setStreamTitle(e.target.value)} placeholder="e.g. Deep house — Friday night session" /></div>
              <div style={grp}><label style={lbl}>DESCRIPTION</label><textarea rows={3} style={{ ...field, resize: 'vertical' as const }} value={streamDesc} onChange={e => setStreamDesc(e.target.value)} placeholder="Let listeners know what to expect…" /></div>
              <div style={{ padding: '14px 16px', background: 'var(--wb-bg-3)', borderRadius: 8, border: '1px solid var(--wb-line-2)' }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: 'var(--wb-ink-3)', marginBottom: 8 }}>STREAM KEY</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input readOnly value="sk_live_••••••••••••••••" style={{ ...field, flex: 1, color: 'var(--wb-ink-3)', letterSpacing: '.1em' }} />
                  <button className="wb-btn-ghost" style={{ flexShrink: 0 }}>Reveal</button>
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 8, lineHeight: 1.6 }}>Use with OBS, Twitch Studio, or any RTMP-compatible software. Point your encoder to <span style={{ color: 'var(--wb-ink-2)' }}>rtmp://live.ihype.org/stream</span></div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="wb-panel" style={{ padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <IcDot c="#ff3e9a" s={8} />
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: '#ff3e9a' }}>LIVE PREVIEW</span>
              </div>
              <div style={{ aspectRatio: '16/9', borderRadius: 8, background: '#0a0a0a', border: '1px solid var(--wb-line-2)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', letterSpacing: '.1em' }}>Waiting for stream…</span>
              </div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 16, color: 'var(--wb-ink)' }}>{streamTitle || 'Your stream title'}</div>
            </div>
            {errMsg && <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff5029', padding: '8px 12px', border: '1px solid rgba(255,80,41,.3)', borderRadius: 6 }}>{errMsg}</div>}
            <button type="button" onClick={handleSubmit} disabled={submitStatus === 'loading'} className="wb-btn-prime" style={{ width: '100%', padding: '12px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#ff3e9a', opacity: submitStatus === 'loading' ? 0.6 : 1 }}>
              <IcDot c="#fff" s={8} /> {submitStatus === 'loading' ? 'Starting…' : 'Go live →'}
            </button>
            <p style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', textAlign: 'center', lineHeight: 1.6 }}>Your stream will appear instantly in the Radio tab once your encoder connects.</p>
          </div>
        </div>
      )}
    </div>
  );
});

// ── View: Event creator ────────────────────────────────────────
function ViewEventCreator() {
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [doorsTime, setDoorsTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const previewDate = date && startTime
    ? new Date(`${date}T${startTime}`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Date · Time';
  const previewPrice = price && Number(price) > 0 ? `$${Number(price).toFixed(2)}` : 'Free';
  const previewCap = capacity ? `0 / ${capacity} capacity` : '0 / — capacity';

  async function handleSubmit() {
    if (!name.trim()) { setErrMsg('Event name is required.'); return; }
    if (!date) { setErrMsg('Date is required.'); return; }
    setErrMsg('');
    setStatus('loading');
    try {
      const startsAt = startTime ? new Date(`${date}T${startTime}`).toISOString() : new Date(`${date}T20:00`).toISOString();
      const body: Record<string, unknown> = {
        title: name.trim(),
        description: desc.trim() || undefined,
        startsAt,
        isTicketed: Number(price) > 0,
        ticketPriceCents: Number(price) > 0 ? Math.round(Number(price) * 100) : 0,
        ticketCapacity: capacity ? Number(capacity) : 200,
        status: 'SCHEDULED',
      };
      const res = await fetch('/api/shows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setStatus('success');
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  const field: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink)', outline: 'none', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: 'var(--wb-ink-3)', marginBottom: 6, display: 'block' };
  const grp: React.CSSProperties = { display: 'flex', flexDirection: 'column' as const };

  if (status === 'success') return (
    <div className="wb-view-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>🎉</div>
      <h2 className="wb-page-title" style={{ fontSize: 28 }}>{name}</h2>
      <p className="wb-page-sub">Your event is live. Fans can now find and ticket it.</p>
      <button className="wb-btn-prime" onClick={() => { setStatus('idle'); setName(''); setVenue(''); setDate(''); setStartTime(''); setPrice(''); setCapacity(''); setDesc(''); }}>
        Create another event
      </button>
    </div>
  );

  return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#ff5029' }}>● CREATE · YOUR SCENE · NO PLATFORM FEE</div>
      <h1 className="wb-page-title">Create an event</h1>
      <p className="wb-page-sub">Publish a show, set your ticket price, and sell directly to fans. iHYPE takes nothing.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start', marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="wb-panel">
            <div className="wb-panel-head"><div className="wb-panel-title">Event details</div></div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={grp}><label style={lbl}>EVENT NAME</label><input style={field} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maya Reyes — Halflight Release Show" /></div>
              <div style={grp}><label style={lbl}>VENUE</label><input style={field} value={venue} onChange={e => setVenue(e.target.value)} placeholder="Empty Bottle, Chicago IL" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={grp}><label style={lbl}>DATE</label><input type="date" style={field} value={date} onChange={e => setDate(e.target.value)} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={grp}><label style={lbl}>DOORS</label><input type="time" style={field} value={doorsTime} onChange={e => setDoorsTime(e.target.value)} /></div>
                  <div style={grp}><label style={lbl}>START</label><input type="time" style={field} value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={grp}><label style={lbl}>TICKET PRICE ($)</label><input type="number" min="0" style={field} value={price} onChange={e => setPrice(e.target.value)} placeholder="0 = free" /></div>
                <div style={grp}><label style={lbl}>CAPACITY</label><input type="number" min="1" style={field} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="200" /></div>
              </div>
              <div style={grp}><label style={lbl}>DESCRIPTION</label><textarea rows={4} style={{ ...field, resize: 'vertical' as const }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What should fans know? Vibe, lineup notes, age restriction, parking…" /></div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="wb-panel" style={{ padding: '18px 16px' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--wb-ink-3)', marginBottom: 12 }}>PREVIEW</div>
            <div style={{ aspectRatio: '16/9', borderRadius: 8, background: 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)', marginBottom: 14 }} />
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--wb-ink)' }}>{name || 'Your event name'}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', marginTop: 4 }}>{venue || 'Venue'} · {previewDate}</div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--wb-line)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)' }}>{previewCap}</span>
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--wb-ink)' }}>{previewPrice}</span>
            </div>
          </div>
          {errMsg && <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff5029', padding: '8px 12px', border: '1px solid rgba(255,80,41,.3)', borderRadius: 6 }}>{errMsg}</div>}
          <button type="button" onClick={handleSubmit} disabled={status === 'loading'} className="wb-btn-prime" style={{ width: '100%', padding: '12px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: status === 'loading' ? 0.6 : 1 }}>
            <IcBolt s={13} /> {status === 'loading' ? 'Publishing…' : 'Publish event →'}
          </button>
          <p style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', textAlign: 'center', lineHeight: 1.6 }}>
            iHYPE takes 0% of ticket revenue. Fans pay face value, you keep everything.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── View: Library ──────────────────────────────────────────────
const ViewLibrary = memo(function ViewLibrary({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'saved' | 'discover'>('saved');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { playTrack, currentTrack } = useMediaPlayer();

  const playlists = [
    { n: 'Hyped tracks',      color: '#ff3e9a', count: 247 },
    { n: 'Top 5 — this week', color: '#ff5029', count: 5 },
    { n: 'Writing room',      color: '#b983ff', count: 42 },
    { n: 'Tour van',          color: '#22e5d4', count: 88 },
  ];

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenuId]);

  const MENU_ITEMS = ['Play', 'Shuffle', 'Add to queue', 'Share', 'Rename', 'Delete'];

  function handleMenuItem(item: string) {
    setOpenMenuId(null);
    if ((item === 'Play' || item === 'Shuffle') && data.tracks.length > 0) {
      const tracks = item === 'Shuffle' ? [...data.tracks].sort(() => Math.random() - 0.5) : data.tracks;
      const mt: MediaTrack = { id: tracks[0].id, title: tracks[0].title, artistName: tracks[0].artistName, url: tracks[0].mediaUrl, artistProfileSlug: tracks[0].artistSlug };
      const queue = tracks.map(t => ({ id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug }));
      playTrack(mt, queue);
    }
  }

  return (
    <div className="wb-view-pad">
      <div style={{ marginBottom: 18 }}>
        <div className="wb-eyebrow" style={{ color: '#b983ff' }}>● YOUR SAVED TRACKS · {data.tracks.length} SONGS · PLAYLISTS</div>
        <h1 className="wb-page-title">Library</h1>
        <p className="wb-page-sub">Everything you've hyped, saved, or curated. Your library is yours.</p>
      </div>
      <div className="wb-tabs" style={{ marginBottom: 20 }}>
        {(['saved', 'discover'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} className={`wb-tab${tab === k ? ' wb-tab-active' : ''}`}>
            {k === 'saved' ? 'Saved' : 'Discover'}
          </button>
        ))}
      </div>

      {tab === 'saved' && (
        <>
          <div className="wb-tracks-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
            {playlists.map(p => (
              <PlaylistDropZone key={p.n} name={p.n} style={{ position: 'relative', padding: 14, border: '1px solid var(--wb-line)', borderRadius: 10, background: 'var(--wb-bg-2)', cursor: 'pointer' }}
                onClick={() => setOpenMenuId(openMenuId === p.n ? null : p.n)}>
                <div style={{ aspectRatio: '1', borderRadius: 6, background: `linear-gradient(135deg, ${p.color}, ${p.color}80)`, marginBottom: 10 }} />
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{p.n}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 3 }}>{p.count} tracks</div>
                {openMenuId === p.n && (
                  <div ref={menuRef} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 8, minWidth: 160, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
                    {MENU_ITEMS.map(item => (
                      <button key={item} type="button" onClick={e => { e.stopPropagation(); handleMenuItem(item); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontFamily: 'var(--f-m)', fontSize: 12, color: item === 'Delete' ? '#ff5029' : 'var(--wb-ink)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.02em' }}>
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </PlaylistDropZone>
            ))}
          </div>
          <div className="wb-panel">
            <div className="wb-panel-head"><div className="wb-panel-title">Recently played</div><button className="wb-link-btn">See all</button></div>
            <div className="wb-tracks-grid" style={{ padding: '14px 16px' }}>
              {data.tracks.slice(0, 4).map(t => {
                const active = currentTrack?.id === t.id;
                const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
                return (
                  <DraggableTrack key={t.id} track={mt} className="wb-track-card" style={{ borderColor: active ? t.color : 'var(--wb-line)' }} onClick={() => playTrack(mt)}>
                    <div className="wb-track-art" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }}>
                      <div className="wb-track-play"><IcPlay s={12} /></div>
                    </div>
                    <div className="wb-track-name">{t.title}</div>
                    <div className="wb-track-artist">{t.artistName}</div>
                  </DraggableTrack>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === 'discover' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div className="wb-eyebrow" style={{ color: '#ff5029' }}>● HYPED THIS WEEK · CHICAGO IS HOT</div>
            <p className="wb-page-sub">Trending tracks from the artists, venues, and DJs in your scene.</p>
          </div>
          <div className="wb-tracks-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {data.tracks.map(t => {
              const active = currentTrack?.id === t.id;
              const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
              return (
                <DraggableTrack key={t.id} track={mt} className="wb-track-card" style={{ borderColor: active ? t.color : 'var(--wb-line)', padding: 12, borderRadius: 10 }} onClick={() => playTrack(mt)}>
                  <div className="wb-track-art" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, borderRadius: 7 }}>
                    <div className="wb-track-play"><IcPlay s={12} /></div>
                    <div className="wb-track-hype"><IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}</div>
                  </div>
                  <div className="wb-track-name" style={{ fontSize: 14 }}>{t.title}</div>
                  <div className="wb-track-artist">{t.artistName} · {t.duration}</div>
                </DraggableTrack>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// ── View: Venue dashboard ──────────────────────────────────────
const ViewVenue = memo(function ViewVenue({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'overview' | 'shows' | 'scan'>('overview');
  const totalSold = data.shows.reduce((a, s) => a + s.sold, 0);
  const totalGross = data.shows.reduce((a, s) => a + s.sold * s.price, 0);
  const venueStats: WbStat[] = [
    { label: 'SHOWS HOSTED', value: String(data.shows.length), delta: 'this season', color: '#22e5d4' },
    { label: 'TICKETS SOLD', value: String(totalSold), delta: 'across all shows', color: '#22e5d4' },
    { label: 'GROSS REVENUE', value: `$${totalGross.toLocaleString()}`, delta: 'at face value', color: '#ffb84a' },
    { label: 'PLATFORM FEE', value: '0%', delta: 'always', color: '#b983ff' },
  ];
  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● VENUE DASHBOARD · {data.city.toUpperCase()}</div>
          <h1 className="wb-page-title">Venue</h1>
          <p className="wb-page-sub">Manage your shows, verify tickets at the door, and settle payouts — all without leaving iHYPE.</p>
        </div>
        <div className="wb-tabs">
          {(['overview', 'shows', 'scan'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)} className={`wb-tab${tab === k ? ' wb-tab-active' : ''}`}>
              {k === 'overview' ? 'Overview' : k === 'shows' ? 'Shows' : 'Scan'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'overview' && (
        <>
          <div className="wb-stat-row">
            {venueStats.map(s => (
              <div key={s.label} className="wb-stat-card">
                <div className="wb-stat-l">{s.label}</div>
                <div className="wb-stat-v">{s.value}</div>
                <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
              </div>
            ))}
          </div>
          <div className="wb-panel">
            <div className="wb-panel-head">
              <div className="wb-panel-title">Upcoming shows</div>
              <button className="wb-link-btn" onClick={() => setTab('shows')}>All shows →</button>
            </div>
            {data.shows.filter(s => s.status !== 'NEAR SOLD' || true).slice(0, 5).map(s => (
              <div key={s.id} className="wb-show-row">
                <div className="wb-show-stripe" style={{ background: s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : 'var(--wb-ink-3)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-show-name">{s.name}</div>
                  <div className="wb-show-meta">{s.date} · {s.time}</div>
                </div>
                <div className="wb-cap">
                  <div className="wb-cap-bar"><div className="wb-cap-fill" style={{ width: `${(s.sold / s.capacity) * 100}%`, background: s.sold / s.capacity > 0.85 ? '#ffb84a' : '#22e5d4' }} /></div>
                  <div className="wb-cap-txt">{s.sold}/{s.capacity}</div>
                </div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--wb-ink)', minWidth: 60, textAlign: 'right' }}>${(s.sold * s.price).toLocaleString()}</div>
              </div>
            ))}
            {data.shows.length === 0 && (
              <div className="wb-empty">No shows yet — create your first event.</div>
            )}
          </div>
        </>
      )}
      {tab === 'shows' && (
        <div className="wb-panel">
          <div className="wb-panel-head">
            <div className="wb-panel-title">All shows</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{data.shows.length} total</div>
          </div>
          {data.shows.map(s => (
            <div key={s.id} className="wb-ticket-row">
              <div className="wb-show-stripe" style={{ background: '#22e5d4' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="wb-show-name">{s.name}</div>
                <div className="wb-show-meta">{s.date} · {s.time}</div>
              </div>
              <div className="wb-ticket-col"><div className="wb-fact-l">SOLD</div><div className="wb-fact-v">{s.sold}/{s.capacity}</div></div>
              <div className="wb-ticket-col"><div className="wb-fact-l">GROSS</div><div className="wb-fact-v">${(s.sold * s.price).toLocaleString()}</div></div>
              <div className="wb-status-pill" style={{ color: s.status === 'TONIGHT' ? '#22e5d4' : '#ffb84a', borderColor: s.status === 'TONIGHT' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)' }}>{s.status}</div>
            </div>
          ))}
          {data.shows.length === 0 && <div className="wb-empty">No shows yet.</div>}
        </div>
      )}
      {tab === 'scan' && (
        <div className="wb-scan-card">
          <div>
            <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● VENUE MODE · DOOR SCANNER</div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '8px 0' }}>Door scanner</h2>
            <p className="wb-page-sub">Point a phone camera at the QR. Valid tickets show green; replays are blocked at the protocol layer.</p>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { code: 'iH-MR18-K3X9', meta: 'GA · admitted 21:04', valid: true },
                { code: 'iH-MR18-7QQR', meta: 'Transferred 14m ago · GA · admitted 21:06', valid: true },
                { code: 'iH-MR18-9BLN', meta: 'Already scanned at 20:51 · blocked', valid: false },
              ].map((r, i) => (
                <div key={i} className="wb-scan-row" style={{ borderLeft: `2px solid ${r.valid ? '#22e5d4' : '#ff5029'}` }}>
                  <span aria-label={r.valid ? 'Valid' : 'Invalid'} style={{ color: r.valid ? '#22e5d4' : '#ff5029', fontWeight: 700 }}>{r.valid ? '✓' : '✗'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink)' }}>{r.code}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{r.meta}</div>
                  </div>
                  <div style={{ color: r.valid ? '#22e5d4' : '#ff5029', fontFamily: 'var(--f-m)', fontSize: 11 }}>{r.valid ? 'VALID' : 'REPLAY'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="wb-scan-viewport">
            <div className="wb-scan-laser" />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', letterSpacing: '.1em' }}>Ready for QR…</div>
          </div>
        </div>
      )}
    </div>
  );
});

// ── View: Stub ─────────────────────────────────────────────────
function ViewStub({ name, eyebrow, accent, sub }: { name: string; eyebrow: string; accent: string; sub: string }) {
  return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: accent }}>● {eyebrow}</div>
      <h1 className="wb-page-title">{name}</h1>
      <p className="wb-page-sub">{sub}</p>
      <div className="wb-empty" style={{ marginTop: 32 }}>Coming soon — this section is in active development.</div>
    </div>
  );
}

// ── View: Discover ─────────────────────────────────────────────
type DiscoverProfile = {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  stateRegion?: string | null;
  hypeCount: number;
  genres: string[];
  avatarImage?: string | null;
};

type DiscoverData = {
  artists: DiscoverProfile[];
  venues: DiscoverProfile[];
  djs: DiscoverProfile[];
};

const PROFILE_COLORS = ['#ff3e9a', '#b983ff', '#22e5d4', '#ff5029', '#7fb3ff', '#ffb84a'];

function profileColor(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i)) % PROFILE_COLORS.length;
  return PROFILE_COLORS[n];
}

function ViewDiscover({ data: _data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'artists'|'venues'|'djs'>('artists');
  const [discoverData, setDiscoverData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/discover')
      .then(r => r.json())
      .then((res: DiscoverData) => { setDiscoverData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const artists = discoverData?.artists ?? [];
  const venues = discoverData?.venues ?? [];
  const djs = discoverData?.djs ?? [];

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-accent)' }}>● PERSONALIZED · BASED ON YOUR HYPES + LOCATION</div>
          <h1 className="wb-page-title">Discover</h1>
          <p className="wb-page-sub">Artists, venues, and DJs curated from your listen history, hypes, and scene.</p>
        </div>
      </div>
      <div className="wb-tabs" style={{ marginBottom: 20 }}>
        {(['artists','venues','djs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`wb-tab${tab===t?' wb-tab-active':''}`} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      {loading && (
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)', padding: '20px 0' }}>Loading recommendations…</div>
      )}

      {!loading && tab === 'artists' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {artists.length === 0 && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)' }}>No artist recommendations yet.</div>}
          {artists.map(a => {
            const c = profileColor(a.id);
            const location = [a.city, a.stateRegion].filter(Boolean).join(', ');
            return (
              <div key={a.id} className="wb-panel" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${c}, ${c}80)`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{a.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>
                      {a.genres.slice(0, 2).join(' / ') || 'Music'}{location ? ` · ${location}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: '#ff3e9a' }}>{a.hypeCount.toLocaleString()} <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 400, color: 'var(--wb-ink-3)' }}>hype</span></span>
                  <button className="wb-btn-prime" style={{ padding: '6px 14px', fontSize: 11 }}>＋ Follow</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === 'venues' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {venues.length === 0 && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)' }}>No venue recommendations yet.</div>}
          {venues.map(v => {
            const c = profileColor(v.id);
            const location = [v.city, v.stateRegion].filter(Boolean).join(', ');
            return (
              <div key={v.id} className="wb-show-row" style={{ background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line)', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ width: 8, height: 40, borderRadius: 3, flexShrink: 0, background: c }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-show-name">{v.name}{location ? <span className="wb-show-venue"> · {location}</span> : null}</div>
                  <div className="wb-show-meta">{v.genres.slice(0, 2).join(' / ') || 'Venue'}</div>
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{v.hypeCount.toLocaleString()} hypes</div>
                <button className="wb-btn-ghost" style={{ fontSize: 11 }}>View →</button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === 'djs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {djs.length === 0 && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)' }}>No DJ recommendations yet.</div>}
          {djs.map(d => {
            const c = profileColor(d.id);
            const location = [d.city, d.stateRegion].filter(Boolean).join(', ');
            return (
              <div key={d.id} className="wb-panel" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: `linear-gradient(135deg, ${c}, ${c}80)`, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{d.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{location || d.genres.slice(0, 1).join('')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)' }}>{d.hypeCount.toLocaleString()} hypes</span>
                  <button className="wb-btn-prime" style={{ padding: '6px 14px', fontSize: 11 }}>Tune in</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── View: Seeds ─────────────────────────────────────────────────
function ViewSeeds({ data }: { data: WorkbenchData }) {
  const [seeds, setSeeds] = useState<SeedsSwipeStackSeed[]>([]);
  const [tracks, setTracks] = useState<SeedsSwipeStackTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('ihype:seed-genres');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('ihype:seed-genres', JSON.stringify(selectedGenres));
    } catch {
      // ignore
    }
  }, [selectedGenres]);

  useEffect(() => {
    const fallbackTracks = data.tracks.map(t => ({
      id: t.id, title: t.title, artistName: t.artistName, album: t.album,
      color: t.color, durationLabel: t.duration, hypeCount: t.hypeCount,
    }));
    const fallbackSeeds = fallbackTracks.map(t => ({
      id: t.id,
      trackId: t.id,
      reason: 'From your discover feed',
    }));

    const qs = selectedGenres.length ? `?genres=${encodeURIComponent(selectedGenres.join(','))}` : '';
    setLoading(true);
    fetch(`/api/discover/seeds${qs}`)
      .then(r => {
        if (!r.ok) throw new Error('Could not load seeds');
        return r.json();
      })
      .then((res: { seeds: Array<{ id: string; trackId: string; title?: string; artistName?: string; reason?: string }> }) => {
        const seedRows = Array.isArray(res.seeds) ? res.seeds : [];
        const fetchedSeeds: SeedsSwipeStackSeed[] = seedRows.map(s => ({
          id: s.id,
          trackId: s.trackId,
          reason: s.reason,
        }));
        const fetchedTracks: SeedsSwipeStackTrack[] = seedRows.map(s => ({
          id: s.trackId,
          title: s.title ?? 'Untitled',
          artistName: s.artistName ?? 'Unknown Artist',
          color: '#b983ff',
          durationLabel: '–:––',
          hypeCount: 0,
        }));
        setSeeds(fetchedSeeds);
        setTracks(fetchedTracks);
      })
      .catch(() => {
        setSeeds(fallbackSeeds);
        setTracks(fallbackTracks);
      })
      .finally(() => setLoading(false));
  }, [data.tracks, selectedGenres]);

  const toast = useToast();
  if (loading) {
    return (
      <div style={{ padding: '24px 32px 32px' }}>
        <div className="animate-pulse" style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
          <div style={{ width: 340, height: 440, borderRadius: 16, background: 'var(--bg-2, #1a1612)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div style={{ height: 44, borderRadius: 10, background: 'var(--bg-2, #1a1612)' }} />
            <div style={{ height: 44, borderRadius: 10, background: 'var(--bg-2, #1a1612)' }} />
            <div style={{ height: 44, borderRadius: 10, background: 'var(--bg-2, #1a1612)' }} />
            <div style={{ height: 100, borderRadius: 10, background: 'var(--bg-2, #1a1612)', marginTop: 8 }} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <SeedsSwipeStack
      seeds={seeds}
      tracks={tracks}
      selectedGenres={selectedGenres}
      onGenresChange={setSelectedGenres}
      onSave={seed => { toast.push('Saved to library', 'success'); void fetch(`/api/discover/seeds/${seed.id}/save`, { method: 'POST' }); }}
      onSkip={seed => { toast.push('Skipped'); void fetch(`/api/discover/seeds/${seed.id}/skip`, { method: 'POST' }); }}
      onHype={seed => { toast.push('Hyped!', 'success'); void fetch(`/api/discover/seeds/${seed.id}/hype`, { method: 'POST' }); }}
    />
  );
}

// ── View: Artist ────────────────────────────────────────────────
function ViewArtist({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'overview'|'touring'|'merch'|'page'>('overview');
  const [touringCities, setTouringCities] = useState<import('@/components/HypeHeatmap').HypeHeatmapCity[]>([]);

  useEffect(() => {
    if (tab === 'touring') {
      fetch('/api/artist/touring-demand')
        .then(r => r.json())
        .then((res: { cities: Array<{ city: string; stateRegion?: string | null; hype: number }> }) => {
          const maxHype = Math.max(...res.cities.map(c => c.hype), 1);
          // Map to HypeHeatmapCity with rough US coordinate approximation
          const CITY_COORDS: Record<string, { x: number; y: number }> = {
            chicago: { x: .55, y: .42 }, brooklyn: { x: .81, y: .42 }, 'new york': { x: .81, y: .40 },
            austin: { x: .45, y: .74 }, 'los angeles': { x: .13, y: .56 }, la: { x: .13, y: .56 },
            seattle: { x: .10, y: .28 }, nashville: { x: .62, y: .58 }, denver: { x: .32, y: .44 },
            atlanta: { x: .65, y: .65 }, miami: { x: .70, y: .85 }, portland: { x: .10, y: .30 },
            boston: { x: .85, y: .35 }, detroit: { x: .65, y: .38 }, houston: { x: .47, y: .78 },
            phoenix: { x: .25, y: .65 }, minneapolis: { x: .50, y: .32 }, 'san francisco': { x: .09, y: .50 },
          };
          const mapped: import('@/components/HypeHeatmap').HypeHeatmapCity[] = res.cities.map((c, i) => {
            const key = c.city.toLowerCase();
            const coords = CITY_COORDS[key] ?? { x: 0.3 + (i * 0.07) % 0.5, y: 0.3 + (i * 0.05) % 0.4 };
            return {
              name: c.city,
              x: coords.x,
              y: coords.y,
              hype: c.hype,
              venuesAsking: 0,
              hot: c.hype >= maxHype * 0.5,
            };
          });
          setTouringCities(mapped);
        })
        .catch(() => {});
    }
  }, [tab]);
  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#ff3e9a' }}>● ARTIST DASHBOARD</div>
          <h1 className="wb-page-title">Artist</h1>
          <p className="wb-page-sub">Your heuristics, fan demand, touring signals, and page customization.</p>
        </div>
      </div>
      <div className="wb-tabs" style={{ marginBottom: 20 }}>
        {(['overview','touring','merch','page'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`wb-tab${tab===t?' wb-tab-active':''}`} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="wb-stat-row">
            {[
              { l: 'TOTAL HYPE',    v: data.hypedToday > 0 ? data.hypedToday.toLocaleString() : '4,219', d: '↑ 18% this month', c: '#ff3e9a' },
              { l: 'FANS',          v: '847',   d: '↑ 23 this week',  c: '#22e5d4' },
              { l: 'RADIO PLAYS',   v: '12.3k', d: 'this month',       c: '#b983ff' },
              { l: 'EARNINGS',      v: '$2,460', d: 'pending payout',  c: '#ffb84a' },
            ].map(s => (
              <div key={s.l} className="wb-stat-card">
                <div className="wb-stat-l">{s.l}</div>
                <div className="wb-stat-v">{s.v}</div>
                <div className="wb-stat-d" style={{ color: s.c }}>{s.d}</div>
              </div>
            ))}
          </div>
          <div className="wb-col-row" style={{ marginTop: 14 }}>
            <section className="wb-panel">
              <div className="wb-panel-head"><div className="wb-panel-title">Top tracks</div></div>
              {data.tracks.slice(0, 5).map(t => (
                <div key={t.id} className="wb-act-row">
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}><div className="wb-act-txt">{t.title}</div></div>
                  <div className="wb-act-time" style={{ color: '#ff3e9a' }}>♡ {t.hypeCount}</div>
                </div>
              ))}
            </section>
            <section className="wb-panel">
              <div className="wb-panel-head"><div className="wb-panel-title">Recommendations</div></div>
              {[
                { txt: 'Submit to Chicago Underground radio', action: 'DJ Vex is spinning your genre' },
                { txt: 'Reach out to Empty Bottle for August', action: '3 venues asking about bookings' },
                { txt: 'Release your next track this Thursday', action: 'Hype velocity peaks Thu–Fri' },
              ].map((r, i) => (
                <div key={i} className="wb-act-row">
                  <div className="wb-act-dot" style={{ background: '#22e5d4' }} />
                  <div style={{ flex: 1 }}>
                    <div className="wb-act-txt">{r.txt}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{r.action}</div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </>
      )}

      {tab === 'touring' && (
        <>
          <HypeHeatmap cities={touringCities} venuePings={[]} suggestedRoute={touringCities.length >= 2 ? touringCities.slice(0, 3).map(c => c.name.slice(0, 3).toUpperCase()).join(' → ') : undefined} />
          {data.profileId && <CoHeadlinerSuggestions profileId={data.profileId} />}
        </>
      )}

      {tab === 'merch' && (
        <div className="wb-panel" style={{ padding: '24px' }}>
          <div className="wb-eyebrow" style={{ marginBottom: 12 }}>● MERCH · COMING SOON</div>
          <p className="wb-page-sub" style={{ maxWidth: 480 }}>Direct-to-fan merch drops with 0% platform fees. List items, set prices, ship or pick up at shows. Launching Q3.</p>
          <button className="wb-btn-prime" style={{ marginTop: 16 }}>Join the waitlist →</button>
        </div>
      )}

      {tab === 'page' && (
        <div>
          <p className="wb-page-sub" style={{ marginBottom: 20 }}>Customize your public artist page — drag to reorder, upload media, choose colors.</p>
          <PageBuilder />
        </div>
      )}
    </div>
  );
}

// ── View: Settings ─────────────────────────────────────────────
// ── Page builder types ──────────────────────────────────────────
type PageWidget = { id: string; label: string; desc: string; wide: boolean; locked?: boolean };
const DEFAULT_WIDGETS: PageWidget[] = [
  { id: 'bio',      label: 'Bio',              desc: 'Your story in your words',          wide: true,  locked: true },
  { id: 'featured', label: 'Featured track',   desc: 'One track pinned at the top',       wide: false },
  { id: 'shows',    label: 'Upcoming shows',   desc: 'Next 3 events with ticket links',   wide: false },
  { id: 'radio',    label: 'Radio shows',      desc: 'Your channels + archive',           wide: false },
  { id: 'photos',   label: 'Photo grid',       desc: '3×2 grid of uploaded images',       wide: true  },
  { id: 'links',    label: 'Links',            desc: 'Social, website, press kit',        wide: false },
];

const LAYOUT_KEY = 'ihype_page_layout_v1';

function PageBuilder() {
  const [widgets, setWidgets] = useState<PageWidget[]>(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        const ordered = ids.map(id => DEFAULT_WIDGETS.find(w => w.id === id)).filter(Boolean) as PageWidget[];
        const missing = DEFAULT_WIDGETS.filter(w => !ids.includes(w.id));
        return [...ordered, ...missing];
      }
    } catch { /* ignore */ }
    return DEFAULT_WIDGETS;
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [bannerImg, setBannerImg] = useState<string | null>(null);
  const profileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setter(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function onDragStart(id: string) { setDragId(id); }
  function onDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setOverId(id); }
  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setWidgets(prev => {
      const from = prev.findIndex(w => w.id === dragId);
      const to = prev.findIndex(w => w.id === targetId);
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
    setOverId(null);
  }

  const fieldStyle: React.CSSProperties = { display: 'none' };
  const uploadZone: React.CSSProperties = { border: '1.5px dashed var(--wb-line-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', background: 'var(--wb-bg-3)', transition: 'border-color 0.15s' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Media uploads */}
      <div className="wb-sett-section" style={{ gridColumn: 'span 2' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15 }}>Media</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 4 }}>Upload your profile photo and banner. PNG or JPG, max 5 MB each.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'start' }}>
          {/* Profile photo */}
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.1em', color: 'var(--wb-ink-3)', marginBottom: 6 }}>PROFILE PHOTO</div>
            <div
              style={{ ...uploadZone, width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', position: 'relative' }}
              onClick={() => profileRef.current?.click()}
            >
              {profileImg
                ? <img src={profileImg} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <><div style={{ fontSize: 24, color: 'var(--wb-ink-3)' }}>+</div><div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)' }}>Upload</div></>
              }
            </div>
            <input ref={profileRef} type="file" accept="image/*" style={fieldStyle} onChange={e => handleFile(e, setProfileImg)} />
          </div>
          {/* Banner */}
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.1em', color: 'var(--wb-ink-3)', marginBottom: 6 }}>BANNER IMAGE</div>
            <div
              style={{ ...uploadZone, height: 120, borderRadius: 8, position: 'relative', overflow: 'hidden' }}
              onClick={() => bannerRef.current?.click()}
            >
              {bannerImg
                ? <img src={bannerImg} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <><div style={{ fontSize: 24, color: 'var(--wb-ink-3)' }}>+</div><div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)' }}>Upload banner · 3:1 recommended</div></>
              }
            </div>
            <input ref={bannerRef} type="file" accept="image/*" style={fieldStyle} onChange={e => handleFile(e, setBannerImg)} />
          </div>
        </div>
      </div>

      {/* Widget layout */}
      <div className="wb-sett-section" style={{ gridColumn: 'span 2' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15 }}>Page layout</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 4 }}>Drag widgets to reorder. Wide widgets span the full row. Locked widgets stay fixed.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {widgets.map((w, i) => (
            <div
              key={w.id}
              draggable={!w.locked}
              onDragStart={() => !w.locked && onDragStart(w.id)}
              onDragOver={e => onDragOver(e, w.id)}
              onDragLeave={() => setOverId(null)}
              onDrop={() => onDrop(w.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              style={{
                gridColumn: w.wide ? 'span 2' : undefined,
                padding: '12px 14px',
                border: `1.5px solid ${overId === w.id && dragId !== w.id ? 'var(--wb-accent)' : dragId === w.id ? 'var(--wb-line-2)' : 'var(--wb-line)'}`,
                borderRadius: 8,
                background: dragId === w.id ? 'var(--wb-bg-3)' : 'var(--wb-bg-2)',
                cursor: w.locked ? 'default' : 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: dragId === w.id ? 0.4 : 1,
                transition: 'border-color 0.1s, opacity 0.1s',
                userSelect: 'none',
              }}
            >
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 18, color: w.locked ? 'var(--wb-line-2)' : 'var(--wb-ink-3)', flexShrink: 0 }}>
                {w.locked ? '⊞' : '⠿'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--wb-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {w.label}
                  {w.wide && <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', color: 'var(--wb-ink-3)', border: '1px solid var(--wb-line-2)', borderRadius: 3, padding: '1px 5px' }}>FULL WIDTH</span>}
                  {w.locked && <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', color: 'var(--wb-ink-3)', border: '1px solid var(--wb-line-2)', borderRadius: 3, padding: '1px 5px' }}>LOCKED</span>}
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{w.desc}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', flexShrink: 0 }}>#{i + 1}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button className="wb-btn-prime" style={{ flex: 1 }} onClick={() => { localStorage.setItem(LAYOUT_KEY, JSON.stringify(widgets.map(w => w.id))); setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
            {saved ? '✓ Saved' : 'Save page layout →'}
          </button>
          <button className="wb-btn-ghost" onClick={() => { setWidgets(DEFAULT_WIDGETS); localStorage.removeItem(LAYOUT_KEY); }}>Reset</button>
        </div>
      </div>
    </div>
  );
}

function ViewSettings({ prefs, setPref }: { prefs: Prefs; setPref: (k: string, v: unknown) => void }) {
  const [settTab, setSettTab] = useState<'appearance' | 'page' | 'security' | 'accessibility'>('page');
  const ACCENTS = [
    { v: '#ff5029', label: 'Ember' }, { v: '#ff3e9a', label: 'Hot pink' },
    { v: '#b983ff', label: 'Lilac' }, { v: '#22e5d4', label: 'Aqua' },
    { v: '#ffb84a', label: 'Amber' }, { v: '#7fb3ff', label: 'Sky' },
  ];

  return (
    <div className="wb-view-pad" style={{ maxWidth: 1100 }}>
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-ink-3)' }}>● PERSONAL · THIS BROWSER · SYNCS ACROSS DEVICES</div>
          <h1 className="wb-page-title">Settings <span style={{ color: 'var(--wb-ink-2)', fontWeight: 400 }}>· page customization</span></h1>
          <p className="wb-page-sub">Make iHYPE feel like yours. Changes apply live.</p>
        </div>
        {settTab === 'appearance' && <button className="wb-btn-ghost" onClick={() => setPref('__reset__', null)}>Reset to defaults</button>}
      </div>

      <div className="wb-tabs" style={{ marginBottom: 24 }}>
        <button onClick={() => setSettTab('page')} className={`wb-tab${settTab === 'page' ? ' wb-tab-active' : ''}`}>Profile page</button>
        <button onClick={() => setSettTab('appearance')} className={`wb-tab${settTab === 'appearance' ? ' wb-tab-active' : ''}`}>Appearance</button>
        <button onClick={() => setSettTab('accessibility')} className={`wb-tab${settTab === 'accessibility' ? ' wb-tab-active' : ''}`}>Accessibility</button>
        <button onClick={() => setSettTab('security')} className={`wb-tab${settTab === 'security' ? ' wb-tab-active' : ''}`}>Security</button>
      </div>

      {settTab === 'page' && <PageBuilder />}

      {settTab === 'appearance' && <div className="wb-settings-grid">
        <SettSection title="Accent color" sub="Used for highlights, the player, and active nav.">
          <div className="wb-swatch-row">
            {ACCENTS.map(c => (
              <button key={c.v} onClick={() => setPref('accent', c.v)} className="wb-swatch" style={{ borderColor: prefs.accent === c.v ? c.v : 'var(--wb-line)', boxShadow: prefs.accent === c.v ? `0 0 0 1px ${c.v}80` : 'none' }}>
                <div className="wb-swatch-chip" style={{ background: c.v }} />
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink)' }}>{c.label}</div>
                {prefs.accent === c.v && <div style={{ position: 'absolute', top: 6, right: 6, color: c.v }}><IcCheck s={11} /></div>}
              </button>
            ))}
          </div>
        </SettSection>

        <SettSection title="Density" sub="Tighter = more on screen. Comfortable = more breathing room.">
          <div className="wb-seg-row">
            {(['compact', 'cozy', 'comfy'] as const).map(k => (
              <button key={k} onClick={() => setPref('density', k)} className={`wb-seg${prefs.density === k ? ' wb-seg-active' : ''}`}>
                {k === 'compact' ? 'Compact' : k === 'cozy' ? 'Cozy' : 'Comfortable'}
              </button>
            ))}
          </div>
        </SettSection>

        <SettSection title="Queue rail" sub="Right-hand sidebar with the playlist. Off frees ~300px.">
          <Toggle on={prefs.queueRail} onChange={v => setPref('queueRail', v)} />
        </SettSection>

        <SettSection title="Sticky player dock" sub="Always show the player at the bottom.">
          <Toggle on={prefs.stickyDock} onChange={v => setPref('stickyDock', v)} />
        </SettSection>

        <SettSection title="Home panels" sub="What appears on Home below the greeting." span={2}>
          <div className="wb-pin-grid">
            {[
              { k: 'panel_stats', l: 'Stat row', d: 'Hype, sales, plays, payouts' },
              { k: 'panel_tonight', l: 'Tonight', d: 'Local shows + capacity bars' },
              { k: 'panel_activity', l: 'Activity feed', d: 'Hypes, payouts, bookings' },
              { k: 'panel_hyped', l: 'Hyped this week', d: '6-up grid of trending tracks' },
            ].map(p => (
              <label key={p.k} className="wb-check-row" style={{ borderColor: prefs[p.k as keyof Prefs] ? `${prefs.accent}40` : 'var(--wb-line)' }}>
                <Toggle on={!!prefs[p.k as keyof Prefs]} onChange={v => setPref(p.k, v)} small />
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13 }}>{p.l}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{p.d}</div>
                </div>
              </label>
            ))}
          </div>
        </SettSection>

        <SettSection title="City + scene" sub="Used for show discovery, radio picks, and the greeting.">
          <select className="wb-select" value={prefs.city} onChange={e => setPref('city', e.target.value)}>
            {['Chicago, IL', 'Brooklyn, NY', 'Los Angeles, CA', 'Austin, TX', 'Detroit, MI', 'Atlanta, GA'].map(c => <option key={c}>{c}</option>)}
          </select>
        </SettSection>

        <SettSection title="Greeting style" sub="The big line at the top of Home.">
          <div className="wb-seg-row">
            {(['warm', 'minimal', 'data'] as const).map(k => (
              <button key={k} onClick={() => setPref('greeting', k)} className={`wb-seg${prefs.greeting === k ? ' wb-seg-active' : ''}`}>
                {k === 'warm' ? 'Warm name' : k === 'minimal' ? 'Minimal' : 'Data first'}
              </button>
            ))}
          </div>
        </SettSection>
      </div>}

      {settTab === 'security' && (
        <div style={{ maxWidth: 480 }}>
          <SettSection title="Passkeys" sub="Sign in with Face ID, Touch ID, or your device PIN — no password or email code needed.">
            <PasskeyManager />
          </SettSection>
        </div>
      )}

      {settTab === 'accessibility' && (
        <div style={{ maxWidth: 720 }}>
          <AccessibilityControls inline />
        </div>
      )}

      <div className="wb-footnote">
        Preferences live in this browser's localStorage. Your data stays on your device — keys never leave your control.
      </div>
    </div>
  );
}

function SettSection({ title, sub, span, children }: { title: string; sub: string; span?: number; children: React.ReactNode }) {
  return (
    <section className="wb-sett-section" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15 }}>{title}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 4 }}>{sub}</div>
      </div>
      {children}
    </section>
  );
}

function Toggle({ on, onChange, small }: { on: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  const w = small ? 30 : 38, h = small ? 18 : 22;
  return (
    <button onClick={() => onChange(!on)} style={{ width: w, height: h, borderRadius: 99, background: on ? 'var(--wb-accent)' : 'rgba(255,255,255,.1)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: on ? w - h + 2 : 2, width: h - 4, height: h - 4, borderRadius: '50%', background: 'var(--wb-ink)', transition: 'left .2s' }} />
    </button>
  );
}
