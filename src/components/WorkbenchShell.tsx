'use client';

import React, { useState, useEffect, useCallback, useRef, createContext, useContext, memo } from 'react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';

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
  kind: 'hype' | 'show' | 'radio' | 'payout';
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
  listeningNow: number;
  hypedToday: number;
  showsTonight: number;
  isVerified?: boolean;
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

type View = 'home' | 'library' | 'radio' | 'tickets' | 'studio' | 'venue' | 'settings';

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
export function WorkbenchShell({ data }: { data: WorkbenchData }) {
  const [view, setView] = useState<View>('home');
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

  return (
    <DragTrackProvider>
      <div className="wb-root">
        {!onboarded && <OnboardingModal onDone={() => setOnboarded(true)} />}
        {sidebarOpen && <div className="wb-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
        <WbSidebar view={view} setView={(v) => { setView(v); setSidebarOpen(false); }} pinned={['home', ...prefs.pinned]} initials={data.userInitials} accent={prefs.accent} activeProfileTypes={data.activeProfileTypes} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} isVerified={data.isVerified} />
        <WbTopbar view={view} data={data} onHamburger={() => setSidebarOpen(s => !s)} setView={setView} />
        <main className="wb-main">
          {view === 'home'     && <ViewHome data={data} prefs={prefs} setView={setView} />}
          {view === 'radio'    && <ViewRadio data={data} setView={setView} />}
          {view === 'tickets'  && <ViewTicketing data={data} activeProfileTypes={data.activeProfileTypes} />}
          {view === 'settings' && <ViewSettings prefs={prefs} setPref={setPref} />}
          {view === 'library'  && <ViewLibrary data={data} />}
          {view === 'studio'   && <ViewRadioStudio />}
          {view === 'venue'    && <ViewVenue data={data} />}
        </main>
        {showQueue && <WbQueueRail data={data} />}
        <WbPlayerDock queueRailOn={prefs.queueRail} onToggleQueue={() => setPref('queueRail', !prefs.queueRail)} />
      </div>
    </DragTrackProvider>
  );
}

// ── Sidebar ────────────────────────────────────────────────────
const NAV_ITEMS: { k: View; label: string; Icon: React.FC<{s?:number}> }[] = [
  { k: 'home',     label: 'Home',      Icon: IcHome },
  { k: 'library',  label: 'Library',   Icon: IcLibrary },
  { k: 'radio',    label: 'Radio',     Icon: IcRadio },
  { k: 'tickets',  label: 'Events & Tickets', Icon: IcTicket },
  { k: 'studio',   label: 'Create',    Icon: IcStudio },
];

function WbSidebar({ view, setView, pinned, initials, accent, activeProfileTypes, mobileOpen, onMobileClose, isVerified }: { view: View; setView: (v: View) => void; pinned: string[]; initials: string; accent: string; activeProfileTypes: string[]; mobileOpen?: boolean; onMobileClose?: () => void; isVerified?: boolean }) {
  const isVenue = activeProfileTypes.includes('VENUE');
  return (
    <aside className={`wb-sidebar${mobileOpen ? ' wb-sidebar-mobile-open' : ''}`}>
      <div className="wb-sb-logo">iH</div>
      <div className="wb-sb-stack">
        {NAV_ITEMS.filter(i => pinned.includes(i.k)).map(({ k, label, Icon }) => (
          <SidebarBtn key={k} active={view === k} onClick={() => setView(k)} label={label} accent={accent}>
            <Icon s={18} />
          </SidebarBtn>
        ))}
        {isVenue && (
          <SidebarBtn active={view === 'venue'} onClick={() => setView('venue')} label="Venue dashboard" accent="#22e5d4">
            <IcShows s={18} />
          </SidebarBtn>
        )}
      </div>
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
  home: 'Home', library: 'Library', radio: 'Radio', tickets: 'Events & Tickets',
  studio: 'Radio studio', venue: 'Venue dashboard', settings: 'Settings · page customization',
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
    } else if (r.type === 'show') {
      setView('tickets');
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
        <span className="wb-top-beta">BETA</span>
      </div>
      <div className="wb-top-mid">
        <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', letterSpacing: '.04em' }}>{VIEW_TITLES[view]}</span>
        <span className="wb-top-dot" />
        <span style={{ color: '#22e5d4', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}><IcDot c="#22e5d4" s={6} /> {data.listeningNow.toLocaleString()} listening</span>
        <span className="wb-top-dot" />
        <span style={{ fontSize: 11, color: 'var(--wb-ink-3)' }}>{data.hypedToday} hyped today</span>
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
          {currentTrack?.artworkUrl && <img src={currentTrack.artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />}
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
function ViewHome({ data, prefs, setView }: { data: WorkbenchData; prefs: Prefs; setView: (v: View) => void }) {
  const { playTrack, currentTrack } = useMediaPlayer();
  const [copied, setCopied] = useState(false);
  const now = new Date();
  const hour = now.getHours();
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greeting = prefs.greeting === 'minimal' ? data.userName : prefs.greeting === 'data'
    ? `${data.stats[0]?.value ?? '—'} hypes this week.`
    : `Good ${tod}, ${data.userName}.`;

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
          <button className="wb-btn-ghost" onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/home`).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}>{copied ? 'Copied!' : 'Share your profile →'}</button>
        </div>
      </div>

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
                    <div className="wb-act-dot" style={{ background: { hype: '#ff3e9a', show: '#22e5d4', radio: '#b983ff', payout: '#ffb84a' }[a.kind] }} />
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
      {prefs.panel_hyped && data.tracks.length > 0 && (
        <section className="wb-panel" style={{ marginTop: 14 }}>
          <div className="wb-panel-head">
            <div className="wb-panel-title">Hyped this week</div>
            <button className="wb-link-btn" onClick={() => setView('library')}>Discover all →</button>
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
  const [tab, setTab] = useState<'browse' | 'mine' | 'selling' | 'scan' | 'create' | 'referral'>('browse');
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
          <button onClick={() => setTab('mine')} className={`wb-tab${tab === 'mine' ? ' wb-tab-active' : ''}`}>My tickets</button>
          <button onClick={() => setTab('selling')} className={`wb-tab${tab === 'selling' ? ' wb-tab-active' : ''}`}>Selling</button>
          <button onClick={() => setTab('scan')} className={`wb-tab${tab === 'scan' ? ' wb-tab-active' : ''}`}>Scan / verify</button>
          {canCreateEvents && (
            <button onClick={() => setTab('create')} className={`wb-tab${tab === 'create' ? ' wb-tab-active' : ''}`}>＋ Create event</button>
          )}
          {isDJ && (
            <button onClick={() => setTab('referral')} className={`wb-tab${tab === 'referral' ? ' wb-tab-active' : ''}`}>Referral link</button>
          )}
        </div>
      </div>

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

      {tab === 'referral' && isDJ && (
        <div className="wb-panel" style={{ marginTop: 20, padding: '24px 28px' }}>
          <div className="wb-eyebrow" style={{ color: '#b983ff', marginBottom: 10 }}>● PROMOTER / DJ · REFERRAL PROGRAM</div>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', color: 'var(--wb-ink)', margin: '0 0 8px' }}>Your referral link</h2>
          <p className="wb-page-sub" style={{ marginBottom: 24 }}>Attach your referral link to any event. When fans buy tickets through your link, you earn a cut — set by the event organizer, paid automatically by iHYPE.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <input readOnly value={`https://ihype.org/ref/${data.userInitials?.toLowerCase() ?? 'you'}`} style={{ flex: 1, padding: '10px 14px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-accent)', outline: 'none' }} />
            <button className="wb-btn-prime" onClick={() => navigator.clipboard?.writeText(`https://ihype.org/ref/${data.userInitials?.toLowerCase() ?? 'you'}`)}>Copy</button>
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
      <p className="wb-page-sub">Launch a scheduled radio show or go live instantly. Artists, DJs, promoters, and venues can all broadcast. No ads, no algorithm.</p>

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
            {errMsg && <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff5029', padding: '8px 12px', border: '1px solid rgba(255,80,41,.3)', borderRadius: 6 }}>{errMsg}</div>}
            <button type="button" onClick={handleSubmit} disabled={submitStatus === 'loading'} className="wb-btn-prime" style={{ width: '100%', padding: '12px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: submitStatus === 'loading' ? 0.6 : 1 }}>
              <IcBolt s={13} /> {submitStatus === 'loading' ? 'Scheduling…' : 'Schedule show →'}
            </button>
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

function PageBuilder() {
  const [widgets, setWidgets] = useState<PageWidget[]>(DEFAULT_WIDGETS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
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
          <button className="wb-btn-prime" style={{ flex: 1 }}>Save page layout →</button>
          <button className="wb-btn-ghost" onClick={() => setWidgets(DEFAULT_WIDGETS)}>Reset</button>
        </div>
      </div>
    </div>
  );
}

function ViewSettings({ prefs, setPref }: { prefs: Prefs; setPref: (k: string, v: unknown) => void }) {
  const [settTab, setSettTab] = useState<'workbench' | 'page'>('workbench');
  const ACCENTS = [
    { v: '#ff5029', label: 'Ember' }, { v: '#ff3e9a', label: 'Hot pink' },
    { v: '#b983ff', label: 'Lilac' }, { v: '#22e5d4', label: 'Aqua' },
    { v: '#ffb84a', label: 'Amber' }, { v: '#7fb3ff', label: 'Sky' },
  ];
  const TOOLS = [
    { k: 'library',  label: 'Library',   sub: 'Saved playlists + tracks',    Icon: IcLibrary },
    { k: 'radio',    label: 'Radio',     sub: 'Channels + your own shows',   Icon: IcRadio },
    { k: 'tickets',  label: 'Events & Tickets', sub: 'Browse, buy, sell, scan', Icon: IcTicket },
    { k: 'studio',   label: 'Create',    sub: 'Start a radio show',           Icon: IcStudio },
  ];

  return (
    <div className="wb-view-pad" style={{ maxWidth: 1100 }}>
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-ink-3)' }}>● PERSONAL · THIS BROWSER · SYNCS ACROSS DEVICES</div>
          <h1 className="wb-page-title">Settings <span style={{ color: 'var(--wb-ink-2)', fontWeight: 400 }}>· page customization</span></h1>
          <p className="wb-page-sub">Make iHYPE feel like yours. Changes apply live.</p>
        </div>
        {settTab === 'workbench' && <button className="wb-btn-ghost" onClick={() => setPref('__reset__', null)}>Reset to defaults</button>}
      </div>

      <div className="wb-tabs" style={{ marginBottom: 24 }}>
        <button onClick={() => setSettTab('workbench')} className={`wb-tab${settTab === 'workbench' ? ' wb-tab-active' : ''}`}>Workbench</button>
        <button onClick={() => setSettTab('page')} className={`wb-tab${settTab === 'page' ? ' wb-tab-active' : ''}`}>Profile page</button>
      </div>

      {settTab === 'page' && <PageBuilder />}

      {settTab === 'workbench' && <div className="wb-settings-grid">
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

        <SettSection title="Pinned tools" sub="What shows in the left rail. Home and Settings always visible." span={2}>
          <div className="wb-pin-grid">
            {TOOLS.map(t => {
              const pinned = prefs.pinned.includes(t.k);
              return (
                <button key={t.k} onClick={() => setPref('togglePin', t.k)} className="wb-pin" style={{ borderColor: pinned ? `${prefs.accent}50` : 'var(--wb-line)', background: pinned ? `${prefs.accent}08` : 'var(--wb-bg-3)' }}>
                  <div style={{ color: pinned ? prefs.accent : 'var(--wb-ink-3)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><t.Icon s={18} /></div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13 }}>{t.label}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{t.sub}</div>
                  </div>
                  <div className="wb-role-pill" style={{ color: pinned ? prefs.accent : 'var(--wb-ink-3)', borderColor: pinned ? `${prefs.accent}40` : 'var(--wb-line-2)' }}>
                    {pinned ? <><IcCheck s={11} /> pinned</> : 'pin'}
                  </div>
                </button>
              );
            })}
          </div>
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
