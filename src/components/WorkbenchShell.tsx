'use client';

import React, { useState, useEffect, useCallback, useRef, createContext, useContext, memo } from 'react';
import Image from 'next/image';
import { AccessibilityControls } from '@/components/AccessibilityControls';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import { WorkbenchExtras } from '@/components/WorkbenchExtras';
import { WidgetManager } from '@/components/WidgetManager';
import { CoHeadlinerSuggestions } from '@/components/CoHeadlinerSuggestions';
import { HypeHeatmap } from '@/components/HypeHeatmap';
import { CITY_COORDS } from '@/lib/city-coords';
import { PasskeyManager } from '@/components/AuthScreens';
import { useToast } from '@/components/Toast';
import { RadioShowCreator } from '@/components/RadioShowCreator';
import { SeedsGamifiedView, type SeedsGamifiedSeed } from '@/components/SeedsGamifiedView';
import { ViewAdmin } from '@/components/ViewAdmin';
import { ViewErrorBoundary } from '@/components/workbench/ErrorBoundary';

// ── Keyboard shortcut hook ─────────────────────────────────────
function useKey(key: string, handler: (e: KeyboardEvent) => void, deps: React.DependencyList = []) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      handler(e);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

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
      role="button"
      tabIndex={0}
      className={className}
      style={{ ...style, cursor: 'grab' }}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
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
  showId?: string;
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

type WbProfileLocation = {
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
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
  profileLocation?: WbProfileLocation;
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
  isAdmin?: boolean;
  uploadStreak?: number;
  needsGenreQuiz?: boolean;
  degraded?: boolean;
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
export type Prefs = typeof DEFAULT_PREFS;

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
const IcMap      = (p: {s?:number}) => <Ic s={p.s}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></Ic>;
const IcSettings = (p: {s?:number}) => <Ic s={p.s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Ic>;
export const IcPlay     = ({ s = 14 }: {s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>;
export const IcPause    = ({ s = 14 }: {s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
const IcSkipP    = (p: {s?:number}) => <Ic {...p} sw={2}><polygon points="19 4 9 12 19 20" fill="currentColor"/><rect x="5" y="4" width="2" height="16" fill="currentColor"/></Ic>;
const IcSkipN    = (p: {s?:number}) => <Ic {...p} sw={2}><polygon points="5 4 15 12 5 20" fill="currentColor"/><rect x="17" y="4" width="2" height="16" fill="currentColor"/></Ic>;
const IcShuffle  = (p: {s?:number}) => <Ic {...p}><path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5"/></Ic>;
const IcRepeat   = (p: {s?:number}) => <Ic {...p}><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></Ic>;
export const IcHeart    = ({ s = 14, c = 'currentColor' }: {s?:number; c?:string}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcQueue    = (p: {s?:number}) => <Ic {...p}><path d="M3 6h13M3 12h13M3 18h9M17 14v7l5-3.5z" fill="currentColor"/></Ic>;
const IcVol      = (p: {s?:number}) => <Ic {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor"/><path d="M15 9a3 3 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></Ic>;
const IcSearch   = (p: {s?:number}) => <Ic {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
export const IcBolt     = (p: {s?:number}) => <Ic {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10" fill="currentColor"/></Ic>;
export const IcCheck    = (p: {s?:number}) => <Ic {...p}><polyline points="20 6 9 17 4 12"/></Ic>;
export const IcArrow    = ({ s = 14 }: {s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
export const IcDot      = ({ c = 'currentColor', s = 8 }: {c?:string; s?:number}) => <svg width={s} height={s} viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill={c}/></svg>;

// ── QR placeholder SVG ─────────────────────────────────────────
function WbQrSvg() {
  return (
    <svg width={160} height={160} viewBox="0 0 80 80" fill="#000">
      {[[0,0],[60,0],[0,60]].map(([x,y],i)=>(
        <g key={i}><rect x={x} y={y} width="20" height="20" fill="none" stroke="#000" strokeWidth="3"/><rect x={x+6} y={y+6} width="8" height="8"/></g>
      ))}
      {Array.from({length:80}).map((_,i)=>{
        const x = 24+(i%10)*4, y = 24+Math.floor(i/10)*4;
        return (i*13+7)%3===0 ? <rect key={i} x={x} y={y} width="3" height="3"/> : null;
      })}
    </svg>
  );
}

// ── Profile color palette ──────────────────────────────────────
const PROFILE_COLORS = ['#ff3e9a', '#b983ff', '#22e5d4', '#ff5029', '#7fb3ff', '#ffb84a'];

function profileColor(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i)) % PROFILE_COLORS.length;
  return PROFILE_COLORS[n];
}

// ── Skeleton loader ────────────────────────────────────────────
export function WbSkeleton({ width, height, style }: { width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <div className="wb-skeleton" style={{ width: width ?? '100%', height: height ?? 16, ...style }} />;
}

export type View = 'home' | 'discover' | 'seeds' | 'tickets' | 'studio' | 'artist' | 'venue' | 'settings' | 'inbox' | 'hype-map' | 'scene-graph' | 'money-flow' | 'governance' | 'setlist' | 'news' | 'admin';

// ── Onboarding modal ───────────────────────────────────────────
function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'Welcome to iHYPE',
      body: 'A nonprofit music platform with no ticket fees. Every ticket goes 45% to the artist, 45% to the venue, and 10% to whoever brought the fan — zero to the platform.',
      cta: 'Next →',
    },
    {
      title: 'Seeds',
      body: 'Swipe right to hype, left to skip, up to save. Every swipe shapes your local scene and feeds real demand data to artists and venues.',
      cta: 'Next →',
    },
    {
      title: "You're all set",
      body: "Explore the menu, hype what moves you, and earn from every ticket you sell. Your workbench is ready.",
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

const VALID_VIEWS = new Set<View>(['home','discover','seeds','tickets','studio','artist','venue','settings','inbox','hype-map','scene-graph','money-flow','governance','setlist','news']);

function getRoleDefaultView(_activeProfileTypes: string[]): View {
  return 'seeds';
}

// ── Confetti burst (first hype) ────────────────────────────────
function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d')!;
    const colors = ['#ff5029','#ff3e9a','#b983ff','#22e5d4','#ffb84a','#7fb3ff'];
    const pieces = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width, y: -10,
      vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.2,
      w: 8 + Math.random() * 8, h: 4 + Math.random() * 4,
    }));
    let frame = 0;
    let raf: number;
    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / 90);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame++;
      if (frame < 100) raf = requestAnimationFrame(draw); else onDone();
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999 }} />;
}

// ── Scene leaderboard ticker ───────────────────────────────────
type LeaderEntry = { name: string; hype: number; color: string };
function SceneTicker({ city }: { city: string }) {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  useEffect(() => {
    fetch('/api/discover?limit=3')
      .then(r => r.json())
      .then((d: { artists?: Array<{ name: string; hypeCount: number; id: string }> }) => {
        if (!d.artists) return;
        setLeaders(d.artists.slice(0, 3).map(a => ({ name: a.name, hype: a.hypeCount, color: profileColor(a.id) })));
      })
      .catch(() => {});
  }, [city]);
  if (leaders.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, overflow: 'hidden', minWidth: 0 }}>
      <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.12em', color: 'var(--wb-ink-3)', flexShrink: 0 }}>HOT IN {city.split(',')[0].toUpperCase()}</span>
      {leaders.map((l, i) => (
        <span key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)' }}>#{i + 1}</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 11, color: 'var(--wb-ink)', whiteSpace: 'nowrap' }}>{l.name}</span>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: '#ff3e9a' }}>{l.hype.toLocaleString()}</span>
        </span>
      ))}
    </div>
  );
}

export function WorkbenchShell({ data, starterPack = [] }: { data: WorkbenchData; starterPack?: StarterPackItem[] }) {
  const [view, setView] = useState<View>(() => {
    if (typeof window === 'undefined') return 'seeds';
    const p = new URLSearchParams(window.location.search).get('view') as View | null;
    if (p && VALID_VIEWS.has(p)) return p;
    try { const saved = localStorage.getItem('ihype-wb-view') as View | null; if (saved && VALID_VIEWS.has(saved)) return saved; } catch {}
    return getRoleDefaultView(data.activeProfileTypes);
  });
  const [liveStats, setLiveStats] = useState({
    listeningNow: data.listeningNow,
    hypedToday: data.hypedToday,
  });
  const [onboarded, setOnboarded] = useState(true); // true until mount check
  const [showConfetti, setShowConfetti] = useState(false);
  const [hypedEver, setHypedEver] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
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

  // Persist last active view
  useEffect(() => { try { localStorage.setItem('ihype-wb-view', view); } catch {} }, [view]);

  // Prefetch API data for adjacent views in background
  useEffect(() => {
    const VIEW_APIS: Partial<Record<View, string>> = {
      discover: '/api/discover',
      tickets: '/api/shows?limit=20',
      seeds: '/api/seeds/recommendations',
    };
    const SWIPE: View[] = ['seeds','home','discover','tickets','studio','settings'];
    const idx = SWIPE.indexOf(view);
    const adjacent = [SWIPE[idx - 1], SWIPE[idx + 1]].filter(Boolean) as View[];
    adjacent.forEach(v => {
      const url = VIEW_APIS[v];
      if (url) fetch(url, { priority: 'low' } as RequestInit).catch(() => {});
    });
  }, [view]);

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
    const id = setInterval(poll, 60000);

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

  // Hype streak tracking
  useEffect(() => {
    try {
      const ever = localStorage.getItem('ihype-hyped-ever');
      setHypedEver(!!ever);
      const streakRaw = localStorage.getItem('ihype-streak');
      const streak = streakRaw ? JSON.parse(streakRaw) as { days: number; lastDate: string } : null;
      if (streak) {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (streak.lastDate === today || streak.lastDate === yesterday) setStreakDays(streak.days);
      }
    } catch {}
  }, []);

  const recordHype = useCallback(() => {
    try {
      const today = new Date().toDateString();
      if (!hypedEver) {
        localStorage.setItem('ihype-hyped-ever', '1');
        setHypedEver(true);
        setShowConfetti(true);
      }
      const streakRaw = localStorage.getItem('ihype-streak');
      const streak = streakRaw ? JSON.parse(streakRaw) as { days: number; lastDate: string } : null;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let newDays = 1;
      if (streak?.lastDate === today) newDays = streak.days;
      else if (streak?.lastDate === yesterday) newDays = streak.days + 1;
      localStorage.setItem('ihype-streak', JSON.stringify({ days: newDays, lastDate: today }));
      setStreakDays(newDays);
    } catch {}
  }, [hypedEver]);

  // Keyboard nav: J/K for tracks, H to hype, G+D to go Discover, G+H to go Home etc.
  const lastKeyRef = useRef<string>('');
  const { playNext, playPrevious, togglePlayback } = useMediaPlayer();
  useKey('j', () => playNext(), [playNext]);
  useKey('k', () => playPrevious(), [playPrevious]);
  useKey(' ', (e) => { e.preventDefault(); togglePlayback(); }, [togglePlayback]);
  useKey('g', () => { lastKeyRef.current = 'g'; setTimeout(() => { lastKeyRef.current = ''; }, 1000); }, []);
  useKey('d', () => { if (lastKeyRef.current === 'g') { setView('discover'); lastKeyRef.current = ''; } }, []);
  useKey('h', (e) => {
    if (lastKeyRef.current === 'g') { setView('home'); lastKeyRef.current = ''; return; }
    // H = hype current track (handled in dock; just record streak here)
    void e;
    recordHype();
  }, [recordHype]);

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

  const SWIPE_VIEWS: View[] = ['seeds', 'home', 'discover', 'tickets', 'studio', 'settings'];
  const touchStartRef = useRef<{ x: number; t: number } | null>(null);
  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = { x: e.touches[0].clientX, t: Date.now() };
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dt = Date.now() - touchStartRef.current.t;
    touchStartRef.current = null;
    if (Math.abs(dx) < 50 || dt > 300) return;
    const idx = SWIPE_VIEWS.indexOf(view as View);
    if (idx === -1) return;
    if (dx < 0 && idx < SWIPE_VIEWS.length - 1) setView(SWIPE_VIEWS[idx + 1]);
    if (dx > 0 && idx > 0) setView(SWIPE_VIEWS[idx - 1]);
  }

  return (
    <DragTrackProvider>
      <div className="wb-root">
        {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
        {!onboarded && <OnboardingModal onDone={() => setOnboarded(true)} />}
        {sidebarOpen && <div className="wb-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
        <WbSidebar view={view} setView={(v) => { setView(v); setSidebarOpen(false); }} pinned={['seeds', 'home', ...prefs.pinned]} initials={liveData.userInitials} accent={prefs.accent} activeProfileTypes={liveData.activeProfileTypes} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} isVerified={liveData.isVerified} isAdmin={liveData.isAdmin} streakDays={streakDays} />
        <WbTopbar view={view} data={liveData} onHamburger={() => setSidebarOpen(s => !s)} setView={setView} />
        <main className="wb-main" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <ViewErrorBoundary>
            {view === 'home'     && <ViewHome data={liveData} prefs={prefs} setView={setView} starterPack={starterPack} />}
            {view === 'discover' && <ViewDiscover data={liveData} />}
            {view === 'seeds'    && <ViewSeeds data={liveData} />}
            {view === 'tickets'  && <ViewTicketing data={liveData} activeProfileTypes={liveData.activeProfileTypes} />}
            {view === 'studio'   && <RadioShowCreator />}
            {view === 'artist'   && <ViewArtist data={liveData} />}
            {view === 'venue'    && <ViewVenue data={liveData} />}
            {view === 'settings'  && <ViewSettings prefs={prefs} setPref={setPref} data={liveData} />}
            {view === 'inbox'       && <ViewInbox data={liveData} setView={setView} />}
            {view === 'hype-map'   && <ViewHypeMap />}
            {view === 'scene-graph'&& <ViewSceneGraph data={liveData} />}
            {view === 'money-flow' && <ViewMoneyFlow data={liveData} />}
            {view === 'governance' && <ViewGovernance />}
            {view === 'setlist'    && <ViewSetlistBuilder data={liveData} />}
            {view === 'news'       && <ViewNews />}
            {view === 'admin'      && <ViewAdmin />}
          </ViewErrorBoundary>
        </main>
        {showQueue && <WbQueueRail data={liveData} />}
        <WbPlayerDock queueRailOn={prefs.queueRail} onToggleQueue={() => setPref('queueRail', !prefs.queueRail)} />
        <WbMobileNav view={view} setView={setView} />
      </div>
    </DragTrackProvider>
  );
}

// ── Sidebar ────────────────────────────────────────────────────
const IcGraph = (p: {s?:number}) => <Ic s={p.s}><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><line x1="7" y1="5" x2="17" y2="5"/><line x1="5.7" y1="7" x2="11" y2="17"/><line x1="18.3" y1="7" x2="13" y2="17"/></Ic>;
const IcDollar = (p: {s?:number}) => <Ic s={p.s}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></Ic>;
const IcVote = (p: {s?:number}) => <Ic s={p.s}><path d="M18 20V10M12 20V4M6 20v-6"/></Ic>;
const IcList = (p: {s?:number}) => <Ic s={p.s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Ic>;

const NAV_ITEMS: { k: View; label: string; Icon: React.FC<{s?:number}> }[] = [
  { k: 'seeds',        label: 'Seeds',        Icon: IcSeeds },
  { k: 'home',         label: 'Home',         Icon: IcHome },
  { k: 'discover',     label: 'Discover',     Icon: IcDiscover },
  { k: 'tickets',      label: 'Live Events',  Icon: IcTicket },
  { k: 'hype-map',     label: 'Hype Map',     Icon: IcMap },
  { k: 'studio',       label: 'Studio',       Icon: IcStudio },
  { k: 'scene-graph',  label: 'Scene Graph',  Icon: IcGraph },
  { k: 'money-flow',   label: 'Money Flow',   Icon: IcDollar },
  { k: 'governance',   label: 'Governance',   Icon: IcVote },
  { k: 'setlist',      label: 'Setlist Builder', Icon: IcList },
];

function WbSidebar({ view, setView, initials, accent, activeProfileTypes, mobileOpen, isVerified, isAdmin, streakDays }: { view: View; setView: (v: View) => void; pinned: string[]; initials: string; accent: string; activeProfileTypes: string[]; mobileOpen?: boolean; onMobileClose?: () => void; isVerified?: boolean; isAdmin?: boolean; streakDays?: number }) {
  const isArtist = activeProfileTypes.includes('ARTIST') || activeProfileTypes.includes('DJ');
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
        <SidebarBtn active={false} onClick={() => setView('settings')} label="Set up artist or venue profile" accent="#22e5d4">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </SidebarBtn>
      )}
      <div className="wb-sb-foot">
        {isAdmin && (
          <SidebarBtn active={view === 'admin'} onClick={() => setView('admin')} label="Admin console" accent="var(--wb-ink-3)">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </SidebarBtn>
        )}
        <SidebarBtn active={view === 'settings'} onClick={() => setView('settings')} label="Settings" accent="rgba(255,255,255,.4)">
          <IcSettings s={18} />
        </SidebarBtn>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <div className="wb-sb-avatar" title={`${initials}`}>{initials}</div>
          {isVerified && (
            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid var(--wb-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, color: '#fff', fontWeight: 700 }}>✓</span>
          )}
          {(streakDays ?? 0) >= 2 && (
            <span title={`${streakDays}-day hype streak`} style={{ position: 'absolute', top: -4, right: -4, background: '#ff5029', color: '#fff', fontSize: 8, fontFamily: 'var(--f-m)', fontWeight: 700, borderRadius: 6, padding: '1px 4px', border: '1px solid var(--wb-bg)', whiteSpace: 'nowrap' }}>🔥{streakDays}</span>
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

// ── News ticker ────────────────────────────────────────────────
const STATIC_HEADLINES = [
  'Nala Sinephro confirms world tour dates — Chicago added to run',
  'iHYPE hits $0 platform fees for 3rd consecutive year',
  'Friko selling out venues across the Midwest this summer',
  'New feature: Hype Futures — stake your support on rising artists',
  'Bar Italia announces surprise EP drop Friday midnight',
  'Empty Bottle Chicago announces expanded outdoor stage for summer',
  'Mk.gee hype count crosses 50,000 — fastest on platform',
  'Governance vote passes: venue payout share raised to 15%',
  'Setlist Builder beta now live — fans vote, artists lock the order',
  'Deeper headlines Pitchfork Music Festival side stage Saturday',
];

type NewsItem = { id: string; headline: string; source: string; time: string };

function useNewsItems(): NewsItem[] {
  const [items, setItems] = useState<NewsItem[]>(() =>
    STATIC_HEADLINES.map((h, i) => ({ id: String(i), headline: h, source: 'iHYPE', time: `${i + 1}h ago` }))
  );
  useEffect(() => {
    // In production this would fetch /api/news; for now rotate static headlines every 2 min
    const id = setInterval(() => {
      setItems(prev => [...prev.slice(1), prev[0]]);
    }, 120000);
    return () => clearInterval(id);
  }, []);
  return items;
}

function NewsTicker({ onClickNews }: { onClickNews: () => void }) {
  const items = useNewsItems();
  const text = items.map(i => `● ${i.headline}`).join('     ');
  return (
    <div className="wb-news-ticker" onClick={onClickNews} title="Click for full news feed" role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onClickNews(); }}>
      <span className="wb-news-ticker-label">NEWS</span>
      <div className="wb-news-ticker-track">
        <span className="wb-news-ticker-text">{text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}</span>
      </div>
    </div>
  );
}

// ── Topbar ─────────────────────────────────────────────────────
const VIEW_TITLES: Record<View, string> = {
  home: 'Home', discover: 'Discover', seeds: 'Seeds', tickets: 'Ticketing',
  studio: 'Studio', artist: 'Artist', venue: 'Venue', settings: 'Settings', inbox: 'Inbox',
  'hype-map': 'Hype Map', 'scene-graph': 'Scene Graph', 'money-flow': 'Money Flow',
  governance: 'Governance', setlist: 'Setlist Builder', news: 'Music News', admin: 'Admin',
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
  const [unreadCount, setUnreadCount] = useState(data.notifications?.filter(n => n.unread).length ?? 0);
  const [savedSearches, setSavedSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('ihype-saved-searches') ?? '[]') as string[]; } catch { return []; }
  });

  function saveSearch(term: string) {
    setSavedSearches(prev => {
      const next = [term, ...prev.filter(s => s !== term)].slice(0, 5);
      try { localStorage.setItem('ihype-saved-searches', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function removeSavedSearch(term: string) {
    setSavedSearches(prev => {
      const next = prev.filter(s => s !== term);
      try { localStorage.setItem('ihype-saved-searches', JSON.stringify(next)); } catch {}
      return next;
    });
  }
  useEffect(() => {
    fetch('/api/notifications?unread=true&limit=1')
      .then(r => r.ok ? r.json() : null)
      .then((d: { total?: number } | null) => { if (d?.total) setUnreadCount(d.total); })
      .catch(() => {});
  }, []);

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

  function handleSelect(r: SearchHit) {
    if (r.type === 'song') {
      playTrack({ id: r.id, title: r.name, artistName: r.subtitle.replace(/^by /, '').split(' / ')[0], url: `/api/media/${r.id}`, mediaId: r.id, artistProfileSlug: r.slug ?? null });
    } else if (r.type === 'artist' || r.type === 'promoter') {
      setView('discover');
    } else if (r.type === 'venue') {
      setView('discover');
    } else if (r.type === 'show') {
      setView('tickets');
    }
    if (q.trim()) saveSearch(q.trim());
    setOpen(false); setQ('');
  }

  return (
    <header className="wb-topbar-wrap">
      <div className="wb-topbar">
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
        <SceneTicker city={data.city} />
        <span className="wb-top-dot" />
        <span style={{ fontSize: 11, color: 'var(--wb-ink-3)' }}>{data.hypedToday} hyped today</span>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button"
            onClick={() => setView('inbox')}
            style={{ marginLeft: 8, border: '1px solid var(--wb-line-2)', borderRadius: 999, background: view === 'inbox' ? 'var(--wb-bg-3)' : 'transparent', color: 'var(--wb-ink-2)', fontFamily: 'var(--f-m)', fontSize: 10, padding: '5px 9px', cursor: 'pointer' }}
          >
            Inbox{unreadCount ? ` ${unreadCount}` : ''}
          </button>
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#ff3e9a', pointerEvents: 'none' }} />
          )}
        </span>
      </div>
      <div className="wb-search" ref={wrapRef} style={{ position: 'relative' }}>
        <IcSearch s={13} />
        <input
          ref={inputRef}
          placeholder="Search artists, shows, venues, tracks…"
          className="wb-search-input"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); else if (!q.trim() && savedSearches.length > 0) setOpen(true); }}
          autoComplete="off"
        />
        {busy
          ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--wb-line-2)', borderTopColor: 'var(--wb-accent)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          : <><span className="wb-kbd">⌘</span><span className="wb-kbd">K</span></>
        }
        {open && !q.trim() && savedSearches.length > 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,.5)', zIndex: 500, overflow: 'hidden', minWidth: 280 }}>
            <div style={{ padding: '8px 14px 4px', fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', color: 'var(--wb-ink-3)' }}>SAVED SEARCHES</div>
            {savedSearches.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--wb-line)' }}>
                <div style={{ flex: 1, padding: '8px 14px', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink)' }} onClick={() => { setQ(s); setOpen(false); }}>{s}</div>
                <button onClick={() => removeSavedSearch(s)} style={{ background: 'none', border: 'none', color: 'var(--wb-ink-3)', cursor: 'pointer', padding: '0 12px', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}
        {open && results.length > 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,.5)', zIndex: 500, overflow: 'hidden', minWidth: 320 }}>
            {results.map(r => {
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
              return <div key={`${r.type}-${r.id}`} style={{ borderBottom: '1px solid var(--wb-line)' }}>{inner}</div>;
            })}
          </div>
        )}
        {open && !busy && q.trim() && results.length === 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 10, padding: '12px 14px', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)', zIndex: 500 }}>
            No results for &ldquo;{q}&rdquo;
          </div>
        )}
      </div>
      </div>
      <NewsTicker onClickNews={() => setView('news')} />
    </header>
  );
}

// ── Hype burst particle ────────────────────────────────────────
function HypeBurst({ active }: { active: boolean }) {
  const particles = [0,1,2,3,4,5];
  if (!active) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
      {particles.map(i => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 6, height: 6, borderRadius: '50%',
          background: i % 2 === 0 ? '#ff3e9a' : 'var(--wb-accent)',
          animation: `hype-burst-${i % 3} 0.55s ease-out forwards`,
          transformOrigin: 'center',
        }} />
      ))}
    </div>
  );
}

// ── Player dock ────────────────────────────────────────────────
function WbPlayerDock({ queueRailOn, onToggleQueue }: { queueRailOn: boolean; onToggleQueue: () => void }) {
  const { currentTrack, isPlaying, currentTime, duration, volume, togglePlayback, playNext, playPrevious, seekTo, setVolume, queue } = useMediaPlayer();
  const [hypedTrackIds, setHypedTrackIds] = useState<Set<string>>(new Set());
  const [burstTrackId, setBurstTrackId] = useState<string | null>(null);
  const toast = useToast();

  function handleHype() {
    if (!currentTrack) return;
    if (hypedTrackIds.has(currentTrack.id)) return;
    const trackId = currentTrack.id;
    const newCount = (currentTrack as MediaTrack & { hypeCount?: number }).hypeCount ?? 0;
    setHypedTrackIds(s => new Set(s).add(trackId));
    setBurstTrackId(trackId);
    setTimeout(() => setBurstTrackId(null), 600);
    // Milestone toasts
    const milestones = [100, 500, 1000];
    const hit = milestones.find(m => newCount < m && newCount + 1 >= m);
    if (hit) toast.push(`🎉 ${hit} hypes on "${currentTrack.title}"!`, 'success');
    fetch('/api/hype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'media', targetId: trackId }) }).catch(() => {});
  }

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
          <button className="wb-heart-btn" title="Hype this track" onClick={handleHype}
            style={{ color: hypedTrackIds.has(currentTrack.id) ? '#ff3e9a' : undefined, position: 'relative' }}>
            <IcHeart s={14} c={hypedTrackIds.has(currentTrack.id) ? '#ff3e9a' : 'currentColor'} />
            <HypeBurst active={burstTrackId === currentTrack.id} />
          </button>
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

// ── Mobile nav ─────────────────────────────────────────────────
const IcNewspaper = (p: {s?:number}) => <Ic s={p.s}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10M7 11h10M7 15h6"/></Ic>;

function WbMobileNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  const tabs: Array<{ v: View; label: string; icon: React.ReactNode }> = [
    { v: 'seeds',    label: 'Seeds',    icon: <IcSeeds s={18} /> },
    { v: 'home',     label: 'Home',     icon: <IcHome s={18} /> },
    { v: 'tickets',  label: 'Shows',    icon: <IcTicket s={18} /> },
    { v: 'studio',   label: 'Studio',   icon: <IcRadio s={18} /> },
    { v: 'discover', label: 'Discover', icon: <IcDiscover s={18} /> },
  ];
  return (
    <nav className="wb-mobile-nav" aria-label="Main navigation">
      {tabs.map(t => (
        <button key={t.v} className={`wb-mobile-nav-item${view === t.v ? ' active' : ''}`} onClick={() => setView(t.v)} aria-current={view === t.v ? 'page' : undefined}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
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

function ViewHypeMap() {
  return (
    <div className="wb-view-pad">
      <HypeHeatmap cities={[]} venuePings={[]} />
    </div>
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

function ShareCardModal({ data, onClose }: { data: WorkbenchData; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 800, H = 420;
    canvas.width = W; canvas.height = H;

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0805');
    grad.addColorStop(1, '#1a0d0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Accent stripe
    ctx.fillStyle = '#ff5029';
    ctx.fillRect(0, 0, 4, H);

    // iHYPE wordmark
    ctx.font = 'bold 28px "Arial", sans-serif';
    ctx.fillStyle = '#f0ebe5';
    ctx.fillText('i', 32, 52);
    ctx.fillStyle = '#ff5029';
    ctx.fillText('HYPE', 48, 52);

    // Name
    ctx.font = 'bold 38px "Arial", sans-serif';
    ctx.fillStyle = '#f0ebe5';
    ctx.fillText(data.userName, 32, 120);

    // Stats
    const stats = [
      { label: 'HYPE THIS WEEK', value: data.stats[0]?.value ?? '0' },
      { label: 'EVENTS ATTENDED', value: String(data.lifeStats?.eventsAttended ?? 0) },
      { label: 'SONGS PLAYED', value: (data.lifeStats?.songsPlayed ?? 0).toLocaleString() },
    ];
    stats.forEach((s, i) => {
      const x = 32 + i * 240;
      ctx.font = '10px "Courier New", monospace';
      ctx.fillStyle = '#5a5048';
      ctx.fillText(s.label, x, 200);
      ctx.font = 'bold 36px "Arial", sans-serif';
      ctx.fillStyle = i === 0 ? '#ff3e9a' : '#22e5d4';
      ctx.fillText(s.value, x, 245);
    });

    // Scene badge
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#ff5029';
    ctx.fillText(`● ${data.city.toUpperCase()} SCENE`, 32, 310);

    // CTA
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = '#5a5048';
    ctx.fillText('ihype.org', 32, 390);
  }, [data]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `ihype-${data.userName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
    setDownloaded(true);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 14, padding: '28px 32px', maxWidth: 880, width: '95%', boxShadow: '0 24px 64px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.08em', color: 'var(--wb-ink-3)' }}>SHARE CARD</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--wb-ink-3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--wb-line)' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="wb-btn-prime" onClick={download} style={{ flex: 1 }}>{downloaded ? '✓ Downloaded!' : 'Download PNG'}</button>
          <button className="wb-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ViewHome({ data, prefs, setView, starterPack = [] }: { data: WorkbenchData; prefs: Prefs; setView: (v: View) => void; starterPack?: StarterPackItem[] }) {
  const { playTrack, currentTrack } = useMediaPlayer();
  const [copied, setCopied] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const now = new Date();
  const hour = now.getHours();
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const smartGreeting = (() => {
    if (prefs.greeting === 'minimal') return data.userName;
    if (prefs.greeting === 'data') return `${data.stats[0]?.value ?? '—'} hypes this week.`;
    // warm: pick the most relevant signal
    const showTonight = data.shows.find(s => s.status === 'TONIGHT');
    if (showTonight) return `${showTonight.name} is tonight, ${data.userName}.`;
    const topStat = data.stats[0];
    if (topStat && topStat.value !== '0' && topStat.delta.startsWith('+')) return `${topStat.value} ${topStat.label.toLowerCase()} this week.`;
    if (data.showsTonight > 0) return `${data.showsTonight} show${data.showsTonight > 1 ? 's' : ''} happening tonight.`;
    return `Good ${tod}, ${data.userName}.`;
  })();
  const greeting = smartGreeting;
  const shareProfile = () => {
    const profileUrl = new URL(data.profilePath ?? '/', window.location.origin).toString();
    navigator.clipboard.writeText(profileUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="wb-view-pad">
      {showShareCard && <ShareCardModal data={data} onClose={() => setShowShareCard(false)} />}
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
          <button className="wb-btn-ghost" onClick={() => setShowShareCard(true)}>Share card ↗</button>
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
        profileSlug={data.profilePath ? data.profilePath.split('/').pop() ?? null : null}
        userEmail={null}
      />
      <StarterPackPanel items={starterPack} />
      <EmptySeatsPing setView={setView} />
      <HypeThresholdPanel setView={setView} />
      <HypeFuturesPanel />

      {/* Onboarding empty-state */}
      {data.shows.length === 0 && (!data.stats[0] || data.stats[0]?.value === '0') && (data.activity.length === 0 || data.activity[0]?.text?.startsWith('No recent')) && (() => {
        const type = data.profileType ?? data.activeProfileTypes[0] ?? 'LISTENER';
        const steps: Array<{ label: string; v: View }> =
          type === 'ARTIST'   ? [{ label: 'Upload your first track', v: 'studio' }, { label: 'Add your bio and photo', v: 'settings' }, { label: 'Create a show', v: 'tickets' }]
          : type === 'DJ'     ? [{ label: 'Create your first radio show', v: 'studio' }, { label: 'Add artists to your scene', v: 'discover' }, { label: 'Set up a show', v: 'tickets' }]
          : type === 'VENUE'  ? [{ label: 'Add your venue details', v: 'settings' }, { label: 'Create your first event', v: 'tickets' }, { label: 'Connect with artists', v: 'discover' }]
          : [{ label: 'Hype 5 artists you love', v: 'discover' }, { label: 'Follow a venue', v: 'discover' }, { label: 'Check what\'s on tonight', v: 'tickets' }];
        return (
          <section className="wb-panel" style={{ marginBottom: 16, padding: '18px 20px' }}>
            <div className="wb-panel-title" style={{ marginBottom: 12 }}>Get started with iHYPE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map(s => (
                <button key={s.label} className="wb-first-step" onClick={() => setView(s.v)} type="button" style={{ textAlign: 'left' }}>
                  <strong>{s.label}</strong>
                </button>
              ))}
            </div>
          </section>
        );
      })()}

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
                {data.shows.slice(0, 1).filter(s => s.price > 0).map(s => (
                  <ReversePricingCard key={`rp-${s.id}`} show={s} />
                ))}
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
            {data.tracks.slice(0, 6).map((t, i) => {
              const active = currentTrack?.id === t.id;
              const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
              return (
                <button key={t.id} onClick={() => playTrack(mt)} className="wb-track-card" style={{ borderColor: active ? t.color : 'var(--wb-line)', animation: 'wb-card-in 0.3s ease both', animationDelay: `${i * 40}ms` }}>
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
          {data.listeningNow > 0 && <GhostListeners count={data.listeningNow} />}
        </section>
      )}

      {/* Lifetime heuristics */}
      <div className="wb-stat-row" style={{ marginTop: 14 }}>
        {[
          { l: 'TOTAL HYPE GIVEN', v: (data.lifeStats?.totalHype ?? 0).toLocaleString(),   d: 'all time',          c: '#ff3e9a' },
          { l: 'TOTAL EARNINGS',   v: `$${(data.lifeStats?.totalEarnings ?? 0).toLocaleString()}`, d: 'lifetime payouts', c: '#ffb84a' },
          { l: 'SONGS PLAYED',     v: (data.lifeStats?.songsPlayed ?? 0).toLocaleString(), d: 'all time listens',  c: '#b983ff' },
          { l: 'EVENTS ATTENDED',  v: String(data.lifeStats?.eventsAttended ?? 0),            d: 'past tickets',      c: '#22e5d4' },
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
function TicketFlipCard({ ticket, onTransfer }: { ticket: WbTicket; onTransfer: () => void }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div style={{ perspective: 1000 }} onClick={() => setFlipped(f => !f)}>
      <div className="wb-hero-ticket" style={{ transition: 'transform 0.45s', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', cursor: 'pointer', position: 'relative' }}>
        {/* Front */}
        <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#22e5d4', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IcDot c="#22e5d4" s={7} /> CONFIRMED
            </div>
            <h2 className="wb-hero-name">{ticket.showName}</h2>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-2)', letterSpacing: '.06em' }}>{ticket.date}</div>
            <div className="wb-hero-facts">
              <div><div className="wb-fact-l">SEAT</div><div className="wb-fact-v">{ticket.seat}</div></div>
              <div><div className="wb-fact-l">PAID</div><div className="wb-fact-v">${ticket.price.toFixed(2)}</div></div>
              <div><div className="wb-fact-l">CODE</div><div className="wb-fact-v" style={{ fontFamily: 'var(--f-m)' }}>{ticket.code}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
              <button className="wb-btn-prime" onClick={() => setFlipped(true)}>Show QR →</button>
              <button className="wb-btn-ghost" onClick={onTransfer}>Transfer</button>
              <button className="wb-btn-ghost">Add to Wallet</button>
              <button className="wb-btn-danger">Request refund</button>
            </div>
            <div style={{ marginTop: 10, fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)' }}>Tap card to flip and see QR</div>
          </div>
        </div>
        {/* Back — QR full screen */}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#fff', borderRadius: 12 }}>
          <div className="wb-qr-box" style={{ background: '#fff', border: 'none' }}>
            <svg width={160} height={160} viewBox="0 0 80 80" fill="#000">
              {[[0,0],[60,0],[0,60]].map(([x,y],i)=>(
                <g key={i}><rect x={x} y={y} width="20" height="20" fill="none" stroke="#000" strokeWidth="3"/><rect x={x+6} y={y+6} width="8" height="8"/></g>
              ))}
              {Array.from({length:80}).map((_,i)=>{
                const x = 24+(i%10)*4, y = 24+Math.floor(i/10)*4;
                return (i*13+7)%3===0 ? <rect key={i} x={x} y={y} width="3" height="3"/> : null;
              })}
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#333', textAlign: 'center' }}>{ticket.code}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: '#888' }}>Tap to flip back</div>
        </div>
      </div>
    </div>
  );
}

const ViewTicketing = memo(function ViewTicketing({ data, activeProfileTypes }: { data: WorkbenchData; activeProfileTypes: string[] }) {
  const canCreateEvents = activeProfileTypes.some(r => r === 'ARTIST' || r === 'VENUE');
  const isDJ = activeProfileTypes.includes('DJ');
  const isVenue = activeProfileTypes.includes('VENUE');
  const [tab, setTab] = useState<'browse' | 'recommended' | 'mine' | 'selling' | 'scan' | 'create' | 'referral' | 'venue'>('browse');
  const upcoming = data.tickets[0];
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferSent, setTransferSent] = useState(false);
  const [rsvpIds, setRsvpIds] = useState<Set<string>>(new Set());
  const toast = useToast();

  function handleRsvp(showId: string, showName: string) {
    if (rsvpIds.has(showId)) return;
    setRsvpIds(s => { const n = new Set(s); n.add(showId); return n; });
    toast.push(`You're going to ${showName}!`, 'success');
    fetch('/api/hype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'show', targetId: showId }) }).catch(() => {});
  }

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
              <button className="wb-btn-prime" style={{ opacity: rsvpIds.has(s.id) ? 0.5 : 1 }} onClick={() => handleRsvp(s.id, s.name)} disabled={rsvpIds.has(s.id)}>{rsvpIds.has(s.id) ? '✓ Going' : 'Get ticket'}</button>
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
              <button className="wb-btn-prime" style={{ opacity: rsvpIds.has(s.id) ? 0.5 : 1 }} onClick={() => handleRsvp(s.id, s.name)} disabled={rsvpIds.has(s.id)}>{rsvpIds.has(s.id) ? '✓ Going' : 'Get ticket'}</button>
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
              <TicketFlipCard ticket={upcoming} onTransfer={() => { setShowTransfer(true); setTransferSent(false); setTransferEmail(''); }} />
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
  const [showName, setShowName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [desc, setDesc] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const field: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink)', outline: 'none', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: 'var(--wb-ink-3)', marginBottom: 6, display: 'block' };
  const grp: React.CSSProperties = { display: 'flex', flexDirection: 'column' as const };

  async function handleSubmit() {
    if (!showName.trim()) { setErrMsg('Show name is required.'); return; }
    setErrMsg('');
    setSubmitStatus('loading');
    await new Promise(r => setTimeout(r, 600));
    setSubmitStatus('success');
  }

  function handleReset() {
    setSubmitStatus('idle');
    setShowName(''); setSchedule(''); setDesc('');
  }

  if (submitStatus === 'success') return (
    <div className="wb-view-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>📻</div>
      <h2 className="wb-page-title" style={{ fontSize: 28 }}>{showName || 'Your show'}</h2>
      <p className="wb-page-sub">Your show is scheduled. Fans can find it in the Radio tab.</p>
      <button className="wb-btn-prime" onClick={handleReset}>Create another</button>
    </div>
  );

  return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#ff3e9a' }}>● RADIO STUDIO · ALL ROLES CAN BROADCAST</div>
      <h1 className="wb-page-title">Create a show</h1>
      <p className="wb-page-sub">Launch a live or prerecorded radio show. Anyone can curate music, tell people what they love, and share it with the scene. Radio shows are free community programming, not a payout product.</p>

      {(
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

function ViewDiscover({ data: _data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'artists'|'venues'|'djs'>('artists');
  const [discoverData, setDiscoverData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [mood, setMood] = useState(50); // 0=chill, 100=hype
  const toast = useToast();

  function handleFollow(id: string, name: string) {
    if (followedIds.has(id)) return;
    setFollowedIds(s => { const n = new Set(s); n.add(id); return n; });
    toast.push(`Following ${name}`);
    fetch('/api/hype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'profile', targetId: id }) }).catch(() => {});
  }

  useEffect(() => {
    fetch('/api/discover')
      .then(r => r.json())
      .then((res: DiscoverData) => { setDiscoverData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allArtists = discoverData?.artists ?? [];
  // Mood filter: sort by hypeCount (high mood = high hype first, low mood = reverse)
  const artists = [...allArtists].sort((a, b) => mood >= 50 ? b.hypeCount - a.hypeCount : a.hypeCount - b.hypeCount);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="wb-tabs" style={{ margin: 0 }}>
          {(['artists','venues','djs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`wb-tab${tab===t?' wb-tab-active':''}`} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        {tab === 'artists' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>Chill</span>
            <input type="range" min={0} max={100} value={mood} onChange={e => setMood(Number(e.target.value))}
              style={{ width: 100, accentColor: 'var(--wb-accent)', cursor: 'pointer' }} title="Mood: chill → hype" />
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-accent)' }}>Hype</span>
          </div>
        )}
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
                  <button className="wb-btn-prime" style={{ padding: '6px 14px', fontSize: 11, opacity: followedIds.has(a.id) ? 0.5 : 1 }} onClick={() => handleFollow(a.id, a.name)} disabled={followedIds.has(a.id)}>{followedIds.has(a.id) ? '✓ Following' : '＋ Follow'}</button>
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
  const [gamifiedSeeds, setGamifiedSeeds] = useState<SeedsGamifiedSeed[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const fallback: SeedsGamifiedSeed[] = data.tracks.map(t => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      color: t.color,
      hypedCount: t.hypeCount,
    }));

    fetch('/api/discover/seeds')
      .then(r => {
        if (!r.ok) throw new Error('Could not load seeds');
        return r.json();
      })
      .then((res: { seeds: Array<{ id: string; trackId: string; title?: string; artistName?: string; city?: string; vibe?: string }> }) => {
        const seedRows = Array.isArray(res.seeds) ? res.seeds : [];
        const fetched: SeedsGamifiedSeed[] = seedRows.map(s => ({
          id: s.id,
          title: s.title ?? 'Untitled',
          artistName: s.artistName ?? 'Unknown Artist',
          city: s.city,
          vibe: s.vibe,
          color: '#b983ff',
        }));
        setGamifiedSeeds(fetched.length > 0 ? fetched : fallback);
      })
      .catch(() => {
        setGamifiedSeeds(fallback);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="animate-pulse" style={{ width: 380, height: 500, borderRadius: 20, background: 'var(--wb-bg-2, #1a1612)' }} />
      </div>
    );
  }

  return (
    <SeedsGamifiedView
      seeds={gamifiedSeeds}
      onHype={id => { toast.push('Hyped!', 'success'); void fetch(`/api/discover/seeds/${id}/hype`, { method: 'POST' }); }}
      onSave={id => { toast.push('Saved to library', 'success'); void fetch(`/api/discover/seeds/${id}/save`, { method: 'POST' }); }}
      onSkip={id => { void fetch(`/api/discover/seeds/${id}/skip`, { method: 'POST' }); }}
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
          <HypeHeatmap
            cities={touringCities}
            venuePings={[]}
            routeOrder={touringCities.length >= 2 ? (() => {
              const unvisited = [...touringCities];
              const route = [unvisited.splice(0, 1)[0]];
              while (unvisited.length > 0) {
                const last = route[route.length - 1];
                let ni = 0, minD = Infinity;
                for (let i = 0; i < unvisited.length; i++) {
                  const d = Math.hypot(unvisited[i].x - last.x, unvisited[i].y - last.y);
                  if (d < minD) { minD = d; ni = i; }
                }
                route.push(unvisited.splice(ni, 1)[0]);
              }
              return route.map(c => c.name);
            })() : undefined}
          />
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
          <PageBuilder data={data} />
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
  { id: 'directions', label: 'Get directions', desc: 'Maps button for venue visitors',    wide: false },
  { id: 'radio',    label: 'Radio shows',      desc: 'Your channels + archive',           wide: false },
  { id: 'photos',   label: 'Photo grid',       desc: '3×2 grid of uploaded images',       wide: true  },
  { id: 'links',    label: 'Links',            desc: 'Social, website, press kit',        wide: false },
];

const LAYOUT_KEY = 'ihype_page_layout_v1';

function formatCoordinateForInput(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function PageBuilder({ data }: { data: WorkbenchData }) {
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
  const [directionsPending, setDirectionsPending] = useState(false);
  const [directionsMessage, setDirectionsMessage] = useState<string | null>(null);
  const [directionsValues, setDirectionsValues] = useState({
    addressLine1: data.profileLocation?.addressLine1 ?? '',
    city: data.profileLocation?.city ?? '',
    stateRegion: data.profileLocation?.stateRegion ?? '',
    postalCode: data.profileLocation?.postalCode ?? '',
    country: data.profileLocation?.country ?? '',
    latitude: formatCoordinateForInput(data.profileLocation?.latitude),
    longitude: formatCoordinateForInput(data.profileLocation?.longitude)
  });
  const profileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const isVenueProfile = data.profileType === 'VENUE' && Boolean(data.profileId);

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

  function updateDirectionsField(key: keyof typeof directionsValues, value: string) {
    setDirectionsValues((current) => ({ ...current, [key]: value }));
  }

  async function handleDirectionsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.profileId) return;

    setDirectionsPending(true);
    setDirectionsMessage(null);

    try {
      const response = await fetch('/api/profile/location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: data.profileId,
          ...directionsValues
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setDirectionsMessage(typeof payload.error === 'string' ? payload.error : 'Could not save venue directions.');
        return;
      }

      setDirectionsMessage('Venue directions saved.');
    } catch {
      setDirectionsMessage('Could not save venue directions.');
    } finally {
      setDirectionsPending(false);
    }
  }

  const fieldStyle: React.CSSProperties = { display: 'none' };
  const uploadZone: React.CSSProperties = { border: '1.5px dashed var(--wb-line-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', background: 'var(--wb-bg-3)', transition: 'border-color 0.15s' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {isVenueProfile ? (
        <form className="wb-sett-section" onSubmit={handleDirectionsSubmit} style={{ gridColumn: 'span 2' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15 }}>Venue directions</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 4 }}>
              Save the address and GPS point used by the public Get directions button.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label className="field" style={{ margin: 0 }}>
              <span>Street address</span>
              <input
                onChange={(event) => updateDirectionsField('addressLine1', event.target.value)}
                placeholder="1234 W Example St"
                value={directionsValues.addressLine1}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>City</span>
              <input
                onChange={(event) => updateDirectionsField('city', event.target.value)}
                value={directionsValues.city}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>State / region</span>
              <input
                onChange={(event) => updateDirectionsField('stateRegion', event.target.value)}
                value={directionsValues.stateRegion}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Postal code</span>
              <input
                onChange={(event) => updateDirectionsField('postalCode', event.target.value)}
                value={directionsValues.postalCode}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Country</span>
              <input
                onChange={(event) => updateDirectionsField('country', event.target.value)}
                value={directionsValues.country}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Latitude</span>
              <input
                max="90"
                min="-90"
                onChange={(event) => updateDirectionsField('latitude', event.target.value)}
                placeholder="41.8781"
                step="any"
                type="number"
                value={directionsValues.latitude}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Longitude</span>
              <input
                max="180"
                min="-180"
                onChange={(event) => updateDirectionsField('longitude', event.target.value)}
                placeholder="-87.6298"
                step="any"
                type="number"
                value={directionsValues.longitude}
              />
            </label>
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="wb-btn-prime" disabled={directionsPending} type="submit">
              {directionsPending ? 'Saving...' : 'Save venue directions'}
            </button>
            {data.profilePath ? (
              <a className="wb-btn-ghost" href={data.profilePath} style={{ textDecoration: 'none' }}>
                View venue page
              </a>
            ) : null}
            {directionsMessage ? <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)' }}>{directionsMessage}</span> : null}
          </div>
        </form>
      ) : null}

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

      {data.profileId && (data.profileType === 'ARTIST' || data.profileType === 'DJ') && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.1em', color: 'var(--wb-ink-3)', marginBottom: 8 }}>● OPTIONAL WIDGETS</div>
          <p style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', margin: '0 0 12px' }}>
            Add optional sections to your public profile — gear, influences, press, merch, and more.
          </p>
          <WidgetManager
            profileId={data.profileId}
            profileType={data.profileType}
            initialConfig={{ enabled: [], data: {} }}
          />
        </div>
      )}
    </div>
  );
}

function ViewSettings({ prefs, setPref, data }: { prefs: Prefs; setPref: (k: string, v: unknown) => void; data: WorkbenchData }) {
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

      {settTab === 'page' && <PageBuilder data={data} />}

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

      <div style={{ marginTop: 32 }}>
        <ExportDataSection data={data} />
      </div>

      <div className="wb-footnote">
        Preferences live in this browser's localStorage. Your data stays on your device — keys never leave your control.
      </div>
    </div>
  );
}

function ExportDataSection({ data }: { data: WorkbenchData }) {
  const [exported, setExported] = useState(false);
  function doExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: { name: data.userName, city: data.city, type: data.profileType },
      stats: data.stats,
      lifeStats: data.lifeStats,
      tickets: data.tickets,
      shows: data.shows,
      tracks: data.tracks.map(t => ({ id: t.id, title: t.title, artist: t.artistName, hypes: t.hypeCount })),
      activity: data.activity,
      referralStats: data.referralStats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ihype-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  }
  return (
    <div style={{ background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line)', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)', marginBottom: 6 }}>Export my data</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', marginBottom: 14, lineHeight: 1.6 }}>Download a JSON file with your stats, tickets, hype history, and activity. No account data is included — purely your iHYPE record.</div>
      <button className="wb-btn-ghost" onClick={doExport}>{exported ? '✓ Downloaded!' : 'Download JSON'}</button>
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

// ═══════════════════════════════════════════════════════════════
// NEW MINDBENDING FEATURES
// ═══════════════════════════════════════════════════════════════

// ── Hype Threshold Shows ───────────────────────────────────────
type HypeGoal = { id: string; city: string; artistName: string; targetHype: number; currentHype: number; reward: string };

function HypeThresholdPanel({ setView }: { setView: (v: View) => void }) {
  const goals: HypeGoal[] = [
    { id: '1', city: 'Chicago', artistName: 'Nala Sinephro', targetHype: 500, currentHype: 387, reward: 'Show auto-creates + tickets open' },
    { id: '2', city: 'Chicago', artistName: 'Friko', targetHype: 300, currentHype: 291, reward: 'Intimate venue show, 150 cap' },
    { id: '3', city: 'Chicago', artistName: 'Mk.gee', targetHype: 1000, currentHype: 614, reward: 'Full venue show, 500 cap' },
  ];
  const [hyped, setHyped] = useState<Set<string>>(new Set());
  const toast = useToast();

  function hypeGoal(g: HypeGoal) {
    if (hyped.has(g.id)) return;
    setHyped(s => { const n = new Set(s); n.add(g.id); return n; });
    toast.push(`Hype added! ${g.targetHype - g.currentHype - 1} more needed`, 'success');
    fetch('/api/hype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'hype-goal', targetId: g.id }) }).catch(() => {});
  }

  return (
    <section className="wb-panel" style={{ marginBottom: 16 }}>
      <div className="wb-panel-head">
        <div className="wb-panel-title">Hype to unlock shows</div>
        <button className="wb-link-btn" onClick={() => setView('discover')}>Browse artists →</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {goals.map(g => {
          const pct = Math.min(100, Math.round((g.currentHype / g.targetHype) * 100));
          const isHyped = hyped.has(g.id);
          const cur = isHyped ? g.currentHype + 1 : g.currentHype;
          return (
            <div key={g.id} style={{ background: 'var(--wb-bg-3)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{g.artistName}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{g.reward}</div>
                </div>
                <button className="wb-btn-prime" style={{ padding: '5px 12px', fontSize: 11, opacity: isHyped ? 0.5 : 1 }} onClick={() => hypeGoal(g)} disabled={isHyped}>
                  {isHyped ? '✓ Hyped' : `⚡ Hype · ${g.targetHype - cur} left`}
                </button>
              </div>
              <div style={{ height: 6, background: 'var(--wb-line-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#22e5d4' : 'var(--wb-accent)', borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)' }}>
                <span>{cur.toLocaleString()} / {g.targetHype.toLocaleString()} hypes</span>
                <span style={{ color: pct >= 90 ? '#22e5d4' : 'var(--wb-ink-3)' }}>{pct}%{pct >= 90 ? ' 🔥 Almost there!' : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Reverse Ticket Pricing ─────────────────────────────────────
type PriceTier = { label: string; price: number; slots: number; filled: number };

function ReversePricingCard({ show }: { show: WbShow }) {
  const tiers: PriceTier[] = [
    { label: 'Early', price: 40, slots: 10, filled: 10 },
    { label: 'Standard', price: 25, slots: 50, filled: 38 },
    { label: 'Community', price: 15, slots: 100, filled: 22 },
  ];
  const currentTier = tiers.find(t => t.filled < t.slots) ?? tiers[tiers.length - 1];
  return (
    <div style={{ background: 'var(--wb-bg-3)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14 }}>{show.name}</div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, color: '#22e5d4' }}>${currentTier.price}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {tiers.map(t => (
          <div key={t.label} style={{ flex: 1, background: t === currentTier ? 'var(--wb-accent)18' : 'var(--wb-line)', borderRadius: 6, padding: '6px 8px', border: t === currentTier ? '1px solid var(--wb-accent)' : '1px solid transparent' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: t === currentTier ? 'var(--wb-accent)' : 'var(--wb-ink-3)' }}>{t.label}</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--wb-ink)' }}>${t.price}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)' }}>{t.filled}/{t.slots}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>Price rises as tiers fill. Demand sets the price.</div>
    </div>
  );
}

// ── Ghost Listening ────────────────────────────────────────────
function GhostListeners({ count }: { count: number }) {
  const ghosts = Math.min(count, 8);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
      <div style={{ display: 'flex', marginRight: 4 }}>
        {Array.from({ length: ghosts }).map((_, i) => (
          <div key={i} style={{
            width: 22, height: 22, borderRadius: '50%',
            background: `hsla(${200 + i * 30}, 60%, 70%, 0.18)`,
            border: '1px solid rgba(255,255,255,.08)',
            marginLeft: i > 0 ? -8 : 0,
            animation: `ghost-pulse ${1.5 + i * 0.2}s ease-in-out infinite alternate`,
          }} />
        ))}
      </div>
      {count > 8 && <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>+{count - 8}</span>}
      <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>listening now</span>
    </div>
  );
}

// ── Hype Wave ──────────────────────────────────────────────────
function HypeWave({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={{ position: 'absolute', inset: -4, borderRadius: 12, pointerEvents: 'none', animation: 'hype-wave 1.2s ease-out forwards' }} aria-hidden="true" />
  );
}

// ── Discovered-First Badge ─────────────────────────────────────
function DiscoveredFirstBadge({ artistId, currentHype }: { artistId: string; currentHype: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const key = `ihype-discovered-${artistId}`;
      const first = localStorage.getItem(key);
      if (!first) {
        if (currentHype < 100) localStorage.setItem(key, String(currentHype));
      } else if (currentHype >= 1000) {
        setShow(true);
      }
    } catch {}
  }, [artistId, currentHype]);
  if (!show) return null;
  return (
    <span title="You discovered this artist early!" style={{ background: 'linear-gradient(90deg,#ff5029,#b983ff)', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 8, fontWeight: 700, letterSpacing: '.1em', borderRadius: 4, padding: '2px 6px' }}>
      🌱 EARLY DISCOVERER
    </span>
  );
}

// ── Hype Futures ───────────────────────────────────────────────
type HypeFuture = { id: string; artistName: string; currentHype: number; target: number; deadline: string; reward: string };

function HypeFuturesPanel() {
  const futures: HypeFuture[] = [
    { id: 'f1', artistName: 'Bar Italia', currentHype: 2840, target: 10000, deadline: '90 days', reward: 'Early access to first Chicago show' },
    { id: 'f2', artistName: 'Deeper', currentHype: 890, target: 10000, deadline: '90 days', reward: 'Guest list spot at album release' },
    { id: 'f3', artistName: 'Lifeguard', currentHype: 4100, target: 10000, deadline: '90 days', reward: 'Soundcheck invitation' },
  ];
  const [staked, setStaked] = useState<Set<string>>(new Set());
  const toast = useToast();

  return (
    <section className="wb-panel" style={{ marginBottom: 16 }}>
      <div className="wb-panel-head">
        <div className="wb-panel-title">Hype futures</div>
        <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)' }}>Stake hypes · earn early access if they hit 10k</span>
      </div>
      {futures.map(f => {
        const pct = Math.round((f.currentHype / f.target) * 100);
        const isStaked = staked.has(f.id);
        return (
          <div key={f.id} style={{ background: 'var(--wb-bg-3)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14 }}>{f.artistName}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#b983ff', marginTop: 2 }}>🎯 {f.reward}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)', marginTop: 2 }}>Deadline: {f.deadline}</div>
              </div>
              <button className="wb-btn-prime" style={{ padding: '5px 12px', fontSize: 11, background: isStaked ? '#b983ff' : undefined, opacity: isStaked ? 0.7 : 1 }}
                onClick={() => { if (!isStaked) { setStaked(s => { const n = new Set(s); n.add(f.id); return n; }); toast.push(`Staked on ${f.artistName}!`, 'success'); } }}
                disabled={isStaked}>
                {isStaked ? '✓ Staked' : 'Stake hype'}
              </button>
            </div>
            <div style={{ height: 5, background: 'var(--wb-line-2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#b983ff,#ff5029)', borderRadius: 3 }} />
            </div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)', marginTop: 3 }}>
              {f.currentHype.toLocaleString()} / {f.target.toLocaleString()} hypes · {pct}%
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ── Empty Seats Ping ───────────────────────────────────────────
function EmptySeatsPing({ setView }: { setView: (v: View) => void }) {
  const [dismissed, setDismissed] = useState(false);
  const [show] = useState({ name: 'Lifeguard', venue: 'Empty Bottle', time: '2 hours', seats: 3, price: 12 });
  if (dismissed) return null;
  return (
    <div style={{ background: 'linear-gradient(135deg,#ff502918,#ff3e9a10)', border: '1px solid rgba(255,80,41,.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 24, flexShrink: 0 }}>🎟</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{show.seats} seats left · {show.name} tonight</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', marginTop: 2 }}>{show.venue} · starts in {show.time} · <span style={{ color: '#22e5d4', fontWeight: 700 }}>${show.price}</span></div>
      </div>
      <button className="wb-btn-prime" style={{ flexShrink: 0, fontSize: 12 }} onClick={() => setView('tickets')}>Grab a seat →</button>
      <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: 'var(--wb-ink-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  );
}

// ── Scene Graph View ───────────────────────────────────────────
function ViewSceneGraph({ data }: { data: WorkbenchData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  type Node = { id: string; label: string; x: number; y: number; vx: number; vy: number; r: number; color: string; kind: 'artist'|'venue'|'genre' };
  type Edge = { a: string; b: string };

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const colors = { artist: '#ff5029', venue: '#22e5d4', genre: '#b983ff' };
    const nodes: Node[] = [
      { id: 'a1', label: 'Nala Sinephro', kind: 'artist', x: 0, y: 0, vx: 0, vy: 0, r: 20, color: colors.artist },
      { id: 'a2', label: 'Friko', kind: 'artist', x: 0, y: 0, vx: 0, vy: 0, r: 16, color: colors.artist },
      { id: 'a3', label: 'Bar Italia', kind: 'artist', x: 0, y: 0, vx: 0, vy: 0, r: 18, color: colors.artist },
      { id: 'a4', label: 'Mk.gee', kind: 'artist', x: 0, y: 0, vx: 0, vy: 0, r: 22, color: colors.artist },
      { id: 'a5', label: 'Deeper', kind: 'artist', x: 0, y: 0, vx: 0, vy: 0, r: 14, color: colors.artist },
      { id: 'v1', label: 'Empty Bottle', kind: 'venue', x: 0, y: 0, vx: 0, vy: 0, r: 24, color: colors.venue },
      { id: 'v2', label: 'Schubas', kind: 'venue', x: 0, y: 0, vx: 0, vy: 0, r: 20, color: colors.venue },
      { id: 'g1', label: 'Jazz', kind: 'genre', x: 0, y: 0, vx: 0, vy: 0, r: 18, color: colors.genre },
      { id: 'g2', label: 'Post-Punk', kind: 'genre', x: 0, y: 0, vx: 0, vy: 0, r: 16, color: colors.genre },
      { id: 'g3', label: 'Indie', kind: 'genre', x: 0, y: 0, vx: 0, vy: 0, r: 20, color: colors.genre },
    ];
    const edges: Edge[] = [
      { a:'a1',b:'g1'},{a:'a1',b:'v1'},{a:'a2',b:'g2'},{a:'a2',b:'v1'},{a:'a2',b:'v2'},
      { a:'a3',b:'g2'},{a:'a3',b:'g3'},{a:'a3',b:'v2'},{a:'a4',b:'g3'},{a:'a4',b:'v1'},
      { a:'a5',b:'g2'},{a:'a5',b:'v1'},{a:'g1',b:'g3'},
    ];
    // Random initial positions
    const W = canvasRef.current?.parentElement?.clientWidth ?? 800;
    const H = 500;
    nodes.forEach(n => { n.x = 100 + Math.random() * (W - 200); n.y = 80 + Math.random() * (H - 160); });
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    function tick() {
      const ns = nodesRef.current;
      // Repulsion
      for (let i = 0; i < ns.length; i++) for (let j = i+1; j < ns.length; j++) {
        const dx = ns[i].x - ns[j].x, dy = ns[i].y - ns[j].y;
        const dist = Math.sqrt(dx*dx+dy*dy) || 1;
        const force = 2000 / (dist * dist);
        ns[i].vx += (dx/dist)*force; ns[j].vx -= (dx/dist)*force;
        ns[i].vy += (dy/dist)*force; ns[j].vy -= (dy/dist)*force;
      }
      // Attraction along edges
      for (const e of edgesRef.current) {
        const a = ns.find(n=>n.id===e.a)!, b = ns.find(n=>n.id===e.b)!;
        const dx = b.x-a.x, dy = b.y-a.y, dist = Math.sqrt(dx*dx+dy*dy)||1;
        const force = (dist-120)*0.04;
        a.vx += (dx/dist)*force; a.vy += (dy/dist)*force;
        b.vx -= (dx/dist)*force; b.vy -= (dy/dist)*force;
      }
      // Center gravity
      ns.forEach(n => { n.vx += (W/2 - n.x)*0.002; n.vy += (H/2 - n.y)*0.002; });
      // Dampen + move
      ns.forEach(n => { n.vx *= 0.85; n.vy *= 0.85; n.x += n.vx; n.y += n.vy; n.x = Math.max(n.r, Math.min(W-n.r, n.x)); n.y = Math.max(n.r, Math.min(H-n.r, n.y)); });

      // Draw
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0a0805'; ctx.fillRect(0,0,W,H);
      // Edges
      for (const e of edgesRef.current) {
        const a = ns.find(n=>n.id===e.a)!, b = ns.find(n=>n.id===e.b)!;
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
        ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.stroke();
      }
      // Nodes
      for (const n of ns) {
        const isHov = n.label === hovered;
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r+(isHov?4:0),0,Math.PI*2);
        ctx.fillStyle = n.color+'33'; ctx.fill();
        ctx.strokeStyle = n.color+(isHov?'ff':'88'); ctx.lineWidth = isHov?2:1; ctx.stroke();
        ctx.fillStyle = isHov ? '#fff' : n.color+'cc';
        ctx.font = `${isHov?600:500} ${isHov?12:10}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.label.length>14?n.label.slice(0,13)+'…':n.label, n.x, n.y);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hit = nodesRef.current.find(n => Math.hypot(n.x - mx, n.y - my) < n.r + 6);
    setHovered(hit?.label ?? null);
  }

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-accent)' }}>● LIVE · FORCE-DIRECTED · YOUR SCENE</div>
          <h1 className="wb-page-title">Scene graph</h1>
          <p className="wb-page-sub">Artists, venues, and genres connected by shared fans and bookings. Nodes repel; edges attract.</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        {[{ c:'#ff5029',l:'Artist'},{ c:'#22e5d4',l:'Venue'},{ c:'#b983ff',l:'Genre'}].map(k=>(
          <span key={k.l} style={{ display:'flex',alignItems:'center',gap:6,fontFamily:'var(--f-m)',fontSize:11,color:'var(--wb-ink-3)' }}>
            <span style={{ width:8,height:8,borderRadius:'50%',background:k.c }} />{k.l}
          </span>
        ))}
        {hovered && <span style={{ fontFamily:'var(--f-m)',fontSize:11,color:'var(--wb-ink)',marginLeft:'auto' }}>↗ {hovered}</span>}
      </div>
      <canvas ref={canvasRef} style={{ width:'100%',height:500,borderRadius:10,border:'1px solid var(--wb-line)',cursor:'crosshair' }} onMouseMove={onMouseMove} />
    </div>
  );
}

// ── Live Money Flow View ───────────────────────────────────────
function ViewMoneyFlow({ data }: { data: WorkbenchData }) {
  const [period, setPeriod] = useState<'today'|'week'|'alltime'>('today');
  const flows = {
    today:   { gross: 4820, toArtists: 3858, toVenues: 675, fees: 0, txCount: 47 },
    week:    { gross: 28400, toArtists: 22720, toVenues: 3977, fees: 0, txCount: 284 },
    alltime: { gross: data.lifeStats?.totalEarnings ?? 940000, toArtists: (data.lifeStats?.totalEarnings ?? 940000)*0.8, toVenues: (data.lifeStats?.totalEarnings ?? 940000)*0.14, fees: 0, txCount: 9240 },
  };
  const f = flows[period];
  const artistPct = Math.round((f.toArtists / f.gross) * 100);
  const venuePct = Math.round((f.toVenues / f.gross) * 100);
  const feePct = 0;

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● REAL-TIME · NONPROFIT · 0% PLATFORM FEE</div>
          <h1 className="wb-page-title">Live money flow</h1>
          <p className="wb-page-sub">Every dollar that moves through iHYPE, live. We take nothing.</p>
        </div>
      </div>
      <div className="wb-tabs" style={{ marginBottom: 24 }}>
        {(['today','week','alltime'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`wb-tab${period===p?' wb-tab-active':''}`}>
            {p === 'alltime' ? 'All time' : p.charAt(0).toUpperCase()+p.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { l: 'GROSS TICKET SALES', v: `$${f.gross.toLocaleString()}`, c: '#f0ebe5' },
          { l: 'TO ARTISTS', v: `$${f.toArtists.toLocaleString()}`, c: '#ff5029' },
          { l: 'TO VENUES', v: `$${f.toVenues.toLocaleString()}`, c: '#22e5d4' },
          { l: 'PLATFORM FEE', v: '$0', c: '#b983ff' },
          { l: 'TRANSACTIONS', v: f.txCount.toLocaleString(), c: '#ffb84a' },
        ].map(s => (
          <div key={s.l} className="wb-stat-card">
            <div className="wb-stat-l">{s.l}</div>
            <div className="wb-stat-v" style={{ color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>
      {/* Flow bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', marginBottom: 8 }}>Where the money goes</div>
        <div style={{ height: 28, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${artistPct}%`, background: '#ff5029', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-m)', fontSize: 10, color: '#fff', fontWeight: 700 }}>{artistPct}% Artists</div>
          <div style={{ width: `${venuePct}%`, background: '#22e5d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-m)', fontSize: 10, color: '#000', fontWeight: 700 }}>{venuePct}% Venues</div>
          <div style={{ flex: 1, background: '#b983ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-m)', fontSize: 10, color: '#fff', fontWeight: 700 }}>{feePct}% Fees</div>
        </div>
      </div>
      <div style={{ background: 'var(--wb-bg-2)', border: '1px solid #22e5d430', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: '#22e5d4', marginBottom: 6 }}>$0 in platform fees. Ever.</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)', lineHeight: 1.7 }}>
          iHYPE is a 501(c)(3) nonprofit. We don't take a cut of ticket sales. Artists and venues keep what fans pay. The platform runs on voluntary membership and grants.
        </div>
      </div>
    </div>
  );
}

// ── Governance Feed View ───────────────────────────────────────
type GovItem = { id: string; date: string; title: string; body: string; yea: number; nay: number; status: 'passed' | 'rejected' | 'voting' };

function ViewGovernance() {
  const items: GovItem[] = [
    { id:'g1', date:'May 20, 2026', title:'Add hype futures feature', body:'Allow fans to stake social hypes on emerging artists in exchange for early ticket access if the artist hits 10k hypes within 90 days.', yea:847, nay:52, status:'passed' },
    { id:'g2', date:'May 15, 2026', title:'Increase venue payout share from 12% to 15%', body:'Venues take on significant fixed costs. This proposal raises their take from 12% to 15% of gross ticket revenue, funded by reducing the optional platform membership tier.', yea:612, nay:189, status:'passed' },
    { id:'g3', date:'May 10, 2026', title:'Add regional price floors', body:'Some regions have significantly lower average ticket prices. This would set a minimum $5 ticket price platform-wide to prevent undervaluation.', yea:302, nay:441, status:'rejected' },
    { id:'g4', date:'May 24, 2026', title:'Artist voice memo on cards (30s preview)', body:'Allow artists to attach a 30-second voice message to their profile card, played on hover as a personal introduction to fans.', yea:201, nay:14, status:'voting' },
    { id:'g5', date:'May 24, 2026', title:'Reverse ticket pricing rollout', body:'Expand the demand-based reverse pricing model (price drops as more fans hype) from beta to all new shows created on the platform.', yea:388, nay:62, status:'voting' },
  ];
  const [votes, setVotes] = useState<Record<string,'yea'|'nay'>>({});
  const toast = useToast();

  function vote(id: string, side: 'yea'|'nay') {
    if (votes[id]) return;
    setVotes(v => ({...v, [id]: side}));
    toast.push(`Vote recorded — ${side === 'yea' ? 'For' : 'Against'}`, 'success');
  }

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#b983ff' }}>● TRANSPARENT · COMMUNITY-GOVERNED · OPEN LOG</div>
          <h1 className="wb-page-title">Governance</h1>
          <p className="wb-page-sub">Every platform decision is logged here with community vote counts. iHYPE is accountable, not a black box.</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => {
          const total = item.yea + item.nay + (votes[item.id] ? 1 : 0);
          const yeaVotes = item.yea + (votes[item.id] === 'yea' ? 1 : 0);
          const pct = total > 0 ? Math.round((yeaVotes / total) * 100) : 50;
          return (
            <div key={item.id} className="wb-panel" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', color: item.status === 'passed' ? '#22e5d4' : item.status === 'rejected' ? '#ff3e9a' : '#ffb84a', border: `1px solid`, borderColor: item.status === 'passed' ? '#22e5d430' : item.status === 'rejected' ? '#ff3e9a30' : '#ffb84a30', borderRadius: 3, padding: '1px 6px' }}>
                      {item.status.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{item.date}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--wb-ink)', marginBottom: 6 }}>{item.title}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', lineHeight: 1.65 }}>{item.body}</div>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--wb-line-2)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: item.status === 'rejected' ? '#ff3e9a' : '#22e5d4', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>
                  {yeaVotes.toLocaleString()} for · {(total - yeaVotes).toLocaleString()} against · {pct}% approval
                </span>
                {item.status === 'voting' && !votes[item.id] && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="wb-btn-prime" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => vote(item.id,'yea')}>For</button>
                    <button className="wb-btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => vote(item.id,'nay')}>Against</button>
                  </div>
                )}
                {votes[item.id] && <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#22e5d4' }}>✓ You voted {votes[item.id]}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Setlist Builder View ───────────────────────────────────────
type SetlistItem = { id: string; title: string; artist: string; votes: number; locked: boolean };

function ViewSetlistBuilder({ data }: { data: WorkbenchData }) {
  const initial: SetlistItem[] = (data.tracks.length > 0 ? data.tracks : [
    { id:'s1', title:'Linger', artistName:'The Cranberries', duration:'4:32', durationSec:272, hypeCount:142, color:'#b983ff', album:'', mediaUrl:'', artistSlug:null },
    { id:'s2', title:'Glass', artistName:'Friko', duration:'3:44', durationSec:224, hypeCount:98, color:'#ff5029', album:'', mediaUrl:'', artistSlug:null },
    { id:'s3', title:'So Numb', artistName:'Bar Italia', duration:'3:12', durationSec:192, hypeCount:77, color:'#22e5d4', album:'', mediaUrl:'', artistSlug:null },
    { id:'s4', title:'Mirror', artistName:'Mk.gee', duration:'5:01', durationSec:301, hypeCount:201, color:'#ffb84a', album:'', mediaUrl:'', artistSlug:null },
    { id:'s5', title:'All Night', artistName:'Deeper', duration:'3:55', durationSec:235, hypeCount:55, color:'#ff3e9a', album:'', mediaUrl:'', artistSlug:null },
  ] as WbTrack[]).map((t, i) => ({ id: t.id, title: t.title, artist: t.artistName, votes: t.hypeCount, locked: i === 0 }));

  const [items, setItems] = useState<SetlistItem[]>(initial.sort((a,b) => b.votes - a.votes));
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [draggingIdx, setDraggingIdx] = useState<number|null>(null);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  function voteUp(id: string) {
    if (voted.has(id)) return;
    setVoted(v => { const n = new Set(v); n.add(id); return n; });
    setItems(it => it.map(x => x.id === id ? { ...x, votes: x.votes + 1 } : x));
    toast.push('Vote counted!');
  }

  function move(from: number, to: number) {
    setItems(it => {
      const next = [...it];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
  }

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#ffb84a' }}>● FAN-VOTED · DRAG TO REORDER · LOCKS AT SHOWTIME</div>
          <h1 className="wb-page-title">Setlist builder</h1>
          <p className="wb-page-sub">Vote on which songs make the set. Drag to suggest an order. Artists see live vote counts and lock the final list night-of.</p>
        </div>
        <button className="wb-btn-prime" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); toast.push('Setlist saved!', 'success'); }}>
          {saved ? '✓ Saved!' : 'Save setlist'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable={!item.locked}
            onDragStart={() => setDraggingIdx(idx)}
            onDragOver={e => { e.preventDefault(); if (draggingIdx !== null && draggingIdx !== idx) move(draggingIdx, idx); setDraggingIdx(idx); }}
            onDragEnd={() => setDraggingIdx(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              background: draggingIdx === idx ? 'var(--wb-bg-3)' : 'var(--wb-bg-2)',
              border: `1px solid ${item.locked ? '#ffb84a40' : 'var(--wb-line)'}`,
              borderRadius: 8, cursor: item.locked ? 'default' : 'grab',
              opacity: draggingIdx === idx ? 0.5 : 1, transition: 'opacity 0.1s',
            }}
          >
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', width: 20, textAlign: 'center', flexShrink: 0 }}>
              {item.locked ? '🔒' : `${idx + 1}`}
            </span>
            <div style={{ width: 6, height: 32, borderRadius: 2, background: 'var(--wb-accent)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{item.title}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{item.artist}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: voted.has(item.id) ? '#ff3e9a' : 'var(--wb-ink-3)' }}>{item.votes} votes</span>
              <button
                onClick={() => voteUp(item.id)}
                disabled={voted.has(item.id)}
                style={{ background: voted.has(item.id) ? '#ff3e9a20' : 'var(--wb-bg-3)', border: `1px solid ${voted.has(item.id) ? '#ff3e9a50' : 'var(--wb-line)'}`, borderRadius: 6, padding: '4px 10px', color: voted.has(item.id) ? '#ff3e9a' : 'var(--wb-ink-3)', cursor: voted.has(item.id) ? 'default' : 'pointer', fontFamily: 'var(--f-m)', fontSize: 11 }}
              >
                {voted.has(item.id) ? '♥ Voted' : '♡ Vote'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>
        Drag songs to reorder · Vote for songs you want in the set · 🔒 = locked by artist
      </div>
    </div>
  );
}

// ── News View ──────────────────────────────────────────────────
function ViewNews() {
  const items = useNewsItems();
  const categories = ['All', 'Platform', 'Artists', 'Shows', 'Industry'] as const;
  const [cat, setCat] = useState<typeof categories[number]>('All');

  const categorized: Record<typeof categories[number], NewsItem[]> = {
    All: items,
    Platform: items.filter((_, i) => i % 5 === 0 || i % 5 === 3),
    Artists:  items.filter((_, i) => i % 5 === 1 || i % 5 === 4),
    Shows:    items.filter((_, i) => i % 5 === 2),
    Industry: items.filter((_, i) => i % 5 === 4),
  };
  const filtered = categorized[cat].length > 0 ? categorized[cat] : items;

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-accent)' }}>● LIVE · MUSIC · PLATFORM NEWS</div>
          <h1 className="wb-page-title">Music News</h1>
          <p className="wb-page-sub">What's happening in your scene, on the platform, and across the industry.</p>
        </div>
      </div>
      <div className="wb-tabs" style={{ marginBottom: 20 }}>
        {categories.map(c => (
          <button key={c} onClick={() => setCat(c)} className={`wb-tab${cat === c ? ' wb-tab-active' : ''}`}>{c}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((item, i) => (
          <div key={item.id} className="wb-panel" style={{ padding: '16px 20px', animation: 'wb-card-in 0.25s ease both', animationDelay: `${i * 30}ms` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: `hsl(${(i * 47) % 360}, 60%, 25%)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {['🎵','🎤','🎟','🏛','📢','⚡','🎸','🌟','🔥','💿'][i % 10]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--wb-ink)', lineHeight: 1.4, marginBottom: 6 }}>{item.headline}</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-accent)' }}>{item.source}</span>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{item.time}</span>
                  <button style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--wb-line-2)', borderRadius: 6, padding: '3px 10px', color: 'var(--wb-ink-3)', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 10 }}>Read more →</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
