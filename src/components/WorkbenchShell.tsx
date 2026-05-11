'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';

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

export type WbRole = {
  key: string;
  label: string;
  sub: string;
  color: string;
  active: boolean;
  href: string;
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
  roles: WbRole[];
  listeningNow: number;
  hypedToday: number;
  showsTonight: number;
};

// ── Default prefs ──────────────────────────────────────────────
const DEFAULT_PREFS = {
  accent: '#ff5029',
  density: 'cozy' as 'compact' | 'cozy' | 'comfy',
  queueRail: true,
  stickyDock: true,
  pinned: ['library', 'radio', 'tickets', 'discover', 'shows', 'studio'] as string[],
  panel_stats: true,
  panel_tonight: true,
  panel_activity: true,
  panel_hyped: true,
  panel_roles: true,
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

type View = 'home' | 'library' | 'radio' | 'tickets' | 'discover' | 'shows' | 'studio' | 'settings';

// ── Main shell ─────────────────────────────────────────────────
export function WorkbenchShell({ data }: { data: WorkbenchData }) {
  const [view, setView] = useState<View>('home');
  const [prefs, setPrefs] = useState<Prefs>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS;
    try {
      const stored = localStorage.getItem('ihype-wb-prefs');
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch { return DEFAULT_PREFS; }
  });

  useEffect(() => {
    try { localStorage.setItem('ihype-wb-prefs', JSON.stringify(prefs)); } catch {}
    applyPrefs(prefs);
  }, [prefs]);

  // Apply on mount
  useEffect(() => { applyPrefs(prefs); }, []); // eslint-disable-line

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

  return (
    <div className="wb-root">
      <WbSidebar view={view} setView={setView} pinned={['home', ...prefs.pinned]} initials={data.userInitials} accent={prefs.accent} />
      <WbTopbar view={view} data={data} />
      <main className="wb-main">
        {view === 'home'     && <ViewHome data={data} prefs={prefs} setView={setView} />}
        {view === 'radio'    && <ViewRadio data={data} />}
        {view === 'tickets'  && <ViewTicketing data={data} />}
        {view === 'settings' && <ViewSettings prefs={prefs} setPref={setPref} />}
        {view === 'library'  && <ViewStub name="Library" eyebrow="YOUR SAVED TRACKS · PLAYLISTS" accent="#b983ff" sub="Everything you've hyped, saved, or curated. Your library is yours." />}
        {view === 'discover' && <ViewStub name="Discover" eyebrow="HYPED THIS WEEK · TRENDING" accent="#ff5029" sub="Trending tracks from artists, venues, and DJs in your scene." />}
        {view === 'shows'    && <ViewShows data={data} />}
        {view === 'studio'   && <ViewStudio data={data} />}
      </main>
      {showQueue && <WbQueueRail data={data} />}
      <WbPlayerDock />
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────
const NAV_ITEMS: { k: View; label: string; Icon: React.FC<{s?:number}> }[] = [
  { k: 'home',     label: 'Home',      Icon: IcHome },
  { k: 'library',  label: 'Library',   Icon: IcLibrary },
  { k: 'radio',    label: 'Radio',     Icon: IcRadio },
  { k: 'tickets',  label: 'Ticketing', Icon: IcTicket },
  { k: 'discover', label: 'Discover',  Icon: IcDiscover },
  { k: 'shows',    label: 'Shows',     Icon: IcShows },
  { k: 'studio',   label: 'Studio',    Icon: IcStudio },
];

function WbSidebar({ view, setView, pinned, initials, accent }: { view: View; setView: (v: View) => void; pinned: string[]; initials: string; accent: string }) {
  return (
    <aside className="wb-sidebar">
      <div className="wb-sb-logo">iH</div>
      <div className="wb-sb-stack">
        {NAV_ITEMS.filter(i => pinned.includes(i.k)).map(({ k, label, Icon }) => (
          <SidebarBtn key={k} active={view === k} onClick={() => setView(k)} label={label} accent={accent}>
            <Icon s={18} />
          </SidebarBtn>
        ))}
      </div>
      <div className="wb-sb-foot">
        <SidebarBtn active={view === 'settings'} onClick={() => setView('settings')} label="Settings" accent="rgba(255,255,255,.4)">
          <IcSettings s={18} />
        </SidebarBtn>
        <div className="wb-sb-avatar" title={`${initials}`}>{initials}</div>
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
  home: 'Home', library: 'Library', radio: 'Radio', tickets: 'Ticketing',
  discover: 'Discover', shows: 'Shows', studio: 'Studio', settings: 'Settings · page customization',
};

function WbTopbar({ view, data }: { view: View; data: WorkbenchData }) {
  return (
    <header className="wb-topbar">
      <div className="wb-crumbs">
        <span style={{ color: 'var(--wb-ink-3)' }}>iHYPE</span>
        <span style={{ color: 'var(--wb-ink-4)' }}>/</span>
        <span style={{ color: 'var(--wb-ink)', fontWeight: 600 }}>{VIEW_TITLES[view]}</span>
      </div>
      <div className="wb-top-mid">
        <span style={{ color: '#22e5d4', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <IcDot c="#22e5d4" s={7} /> {data.listeningNow.toLocaleString()} listening
        </span>
        <span className="wb-top-dot" />
        <span style={{ fontSize: 11, color: 'var(--wb-ink-3)' }}>{data.hypedToday} hyped today · {data.showsTonight} shows tonight</span>
      </div>
      <div className="wb-search">
        <IcSearch s={13} />
        <input placeholder="Search artists, shows, venues, tracks…" className="wb-search-input" />
        <span className="wb-kbd">⌘</span><span className="wb-kbd">K</span>
      </div>
    </header>
  );
}

// ── Player dock ────────────────────────────────────────────────
function WbPlayerDock() {
  const { currentTrack, isPlaying, currentTime, duration, togglePlayback, playNext, playPrevious, seekTo } = useMediaPlayer();

  const progress = duration > 0 ? currentTime / duration : 0;
  const fmtTime = (s: number) => {
    const sec = Math.floor(s);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

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
          <div className="wb-scrub-track" onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
          }}>
            <div className="wb-scrub-fill" style={{ width: `${progress * 100}%` }} />
            <div className="wb-scrub-knob" style={{ left: `${progress * 100}%` }} />
          </div>
          <span className="wb-time">{fmtTime(duration)}</span>
        </div>
      </div>
      <div className="wb-dock-r">
        <button className="wb-dock-btn"><IcQueue s={14} /></button>
        <button className="wb-dock-btn"><IcVol s={14} /></button>
        <div className="wb-vol-track"><div className="wb-vol-fill" /></div>
      </div>
    </footer>
  );
}

// ── Queue rail ─────────────────────────────────────────────────
function WbQueueRail({ data }: { data: WorkbenchData }) {
  const { currentTrack, playTrack } = useMediaPlayer();
  return (
    <aside className="wb-queue">
      <div className="wb-queue-head">
        <div>
          <div className="wb-queue-title">Queue</div>
          <div className="wb-queue-sub">{data.tracks.length} tracks · this week</div>
        </div>
        <button className="wb-link-btn">Edit</button>
      </div>
      <div className="wb-queue-list">
        {data.tracks.map(t => {
          const active = currentTrack?.id === t.id;
          const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
          return (
            <button key={t.id} onClick={() => playTrack(mt)} className={`wb-q-item${active ? ' wb-q-item-active' : ''}`}>
              <div className="wb-q-art" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }}>
                {active && <span className="wb-q-playing"><IcDot c={t.color} s={6} /></span>}
              </div>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <div className="wb-q-title">{t.title}</div>
                <div className="wb-q-artist">{t.artistName}</div>
              </div>
              <div className="wb-q-hype"><IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}</div>
              <div className="wb-q-dur">{t.duration}</div>
            </button>
          );
        })}
      </div>
      <div className="wb-queue-foot">
        <span className="wb-eyebrow-xs">CURATED BY</span>
        <div style={{ fontStyle: 'italic', fontSize: 16, marginTop: 4, color: 'var(--wb-ink)' }}>iHYPE · {data.city}</div>
      </div>
    </aside>
  );
}

// ── View: Home ─────────────────────────────────────────────────
function ViewHome({ data, prefs, setView }: { data: WorkbenchData; prefs: Prefs; setView: (v: View) => void }) {
  const { playTrack, currentTrack } = useMediaPlayer();
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
          <button className="wb-btn-prime" onClick={() => setView('studio')}><IcBolt s={12} /> Upload a track</button>
          <button className="wb-btn-ghost" onClick={() => setView('shows')}>Plan a show →</button>
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
                <button className="wb-link-btn" onClick={() => setView('shows')}>All shows →</button>
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
            <button className="wb-link-btn" onClick={() => setView('discover')}>Discover all →</button>
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

      {/* Roles */}
      {prefs.panel_roles && (
        <section className="wb-panel" style={{ marginTop: 14, marginBottom: 24 }}>
          <div className="wb-panel-head">
            <div className="wb-panel-title">Your roles</div>
            <span className="wb-link-btn" style={{ cursor: 'default' }}>{data.roles.filter(r => r.active).length} active</span>
          </div>
          <div className="wb-role-grid">
            {data.roles.map(r => (
              <div key={r.key} className="wb-role-card" style={{ borderColor: r.active ? r.color : 'var(--wb-line)', background: r.active ? `${r.color}08` : 'var(--wb-bg-2)' }}>
                <div className="wb-role-dot" style={{ background: r.color }} />
                <div style={{ flex: 1 }}>
                  <div className="wb-role-name">{r.label}</div>
                  <div className="wb-role-sub">{r.sub}</div>
                </div>
                {r.active
                  ? <span className="wb-role-pill" style={{ color: r.color, borderColor: `${r.color}40` }}><IcCheck s={11} /> active</span>
                  : <Link href={r.href} className="wb-role-pill" style={{ color: 'var(--wb-ink-2)', borderColor: 'var(--wb-line-2)' }}>add →</Link>
                }
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── View: Radio ────────────────────────────────────────────────
function ViewRadio({ data }: { data: WorkbenchData }) {
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
        <button className="wb-btn-outline" style={{ borderColor: 'var(--wb-accent)', color: 'var(--wb-accent)' }}>
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
                  <button key={t.id} onClick={() => playTrack(mt)} className="wb-q-row">
                    <div className="wb-q-idx">{String(i + 1).padStart(2, '0')}</div>
                    <div className="wb-q-art-sm" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="wb-q-name">{t.title}</div>
                      <div className="wb-q-artist-sm">{t.artistName} · {t.album}</div>
                    </div>
                    <div className="wb-q-chip">{i === 0 && show.live ? 'NOW' : i < 2 ? 'JUST PLAYED' : `-${i * 4}m`}</div>
                    <div className="wb-q-hype-sm"><IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── View: Ticketing ────────────────────────────────────────────
function ViewTicketing({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'mine' | 'selling' | 'scan'>('mine');
  const upcoming = data.tickets[0];

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● {data.tickets.length} TICKETS · NO QUEUES, NO SCALPERS</div>
          <h1 className="wb-page-title">Ticketing</h1>
          <p className="wb-page-sub">Buy, hold, transfer, and verify tickets — all within iHYPE. QR codes are signed to your account; venues scan at the door.</p>
        </div>
        <div className="wb-tabs">
          {(['mine', 'selling', 'scan'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)} className={`wb-tab${tab === k ? ' wb-tab-active' : ''}`}>
              {k === 'mine' ? 'My tickets' : k === 'selling' ? 'Selling' : 'Scan / verify'}
            </button>
          ))}
        </div>
      </div>

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
                    <button className="wb-btn-ghost">Transfer</button>
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
    </div>
  );
}

// ── View: Shows ────────────────────────────────────────────────
function ViewShows({ data }: { data: WorkbenchData }) {
  return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● {data.showsTonight} TONIGHT · {data.city.toUpperCase()}</div>
      <h1 className="wb-page-title">Shows</h1>
      <p className="wb-page-sub">Live events in your city. No platform fee on tickets — every dollar settles directly to artists and venues.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
        {data.shows.map(s => (
          <div key={s.id} className="wb-shows-row">
            <div style={{ width: 56, height: 56, borderRadius: 6, background: 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16 }}>{s.name} <span style={{ color: 'var(--wb-ink-3)', fontWeight: 500 }}>· {s.venue}</span></div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)', marginTop: 4 }}>{s.date} · {s.time} · ♡ {s.hype}</div>
            </div>
            <div style={{ fontFamily: 'var(--f-d)', fontSize: 20, fontWeight: 700 }}>{s.price > 0 ? `$${s.price}` : 'Free'}</div>
            <button className="wb-btn-prime">Get ticket</button>
          </div>
        ))}
        {data.shows.length === 0 && (
          <div className="wb-empty">No shows found for {data.city}. Check back soon or explore another city in Settings.</div>
        )}
      </div>
    </div>
  );
}

// ── View: Studio ───────────────────────────────────────────────
function ViewStudio({ data }: { data: WorkbenchData }) {
  const payout = data.stats.find(s => s.label.includes('PAYOUT'));
  return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#ff5029' }}>● STUDIO · {data.tracks.length} TRACKS</div>
      <h1 className="wb-page-title">Studio</h1>
      <p className="wb-page-sub">Upload tracks, manage releases, and cash out — no label, no platform fee.</p>
      <div className="wb-col-row" style={{ marginTop: 20 }}>
        <div className="wb-panel">
          <div className="wb-panel-head"><div className="wb-panel-title">Your uploads</div><button className="wb-btn-prime"><IcBolt s={11} /> Upload</button></div>
          {data.tracks.slice(0, 6).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--wb-line)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 4, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{t.album}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff3e9a' }}>♡ {t.hypeCount}</div>
            </div>
          ))}
          {data.tracks.length === 0 && (
            <div className="wb-act-row" style={{ color: 'var(--wb-ink-3)', fontSize: 13 }}>No tracks yet — upload your first.</div>
          )}
        </div>
        <div className="wb-panel">
          <div className="wb-panel-head"><div className="wb-panel-title">Payouts</div></div>
          <div style={{ padding: '18px 16px' }}>
            <div style={{ fontFamily: 'var(--f-d)', fontSize: 38, fontWeight: 800, letterSpacing: '-.025em' }}>{payout?.value ?? '$0'}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ffb84a', marginTop: 6 }}>{payout?.delta ?? 'no pending payout'}</div>
            {payout && (
              <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--wb-bg-3)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)' }}>
                Platform fee: $0 · iHYPE takes nothing
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
function ViewSettings({ prefs, setPref }: { prefs: Prefs; setPref: (k: string, v: unknown) => void }) {
  const ACCENTS = [
    { v: '#ff5029', label: 'Ember' }, { v: '#ff3e9a', label: 'Hot pink' },
    { v: '#b983ff', label: 'Lilac' }, { v: '#22e5d4', label: 'Aqua' },
    { v: '#ffb84a', label: 'Amber' }, { v: '#7fb3ff', label: 'Sky' },
  ];
  const TOOLS = [
    { k: 'library',  label: 'Library',   sub: 'Saved playlists + tracks',    Icon: IcLibrary },
    { k: 'radio',    label: 'Radio',     sub: 'Channels + your own shows',   Icon: IcRadio },
    { k: 'tickets',  label: 'Ticketing', sub: 'Hold, sell, scan',            Icon: IcTicket },
    { k: 'discover', label: 'Discover',  sub: 'Hyped this week',             Icon: IcDiscover },
    { k: 'shows',    label: 'Shows',     sub: 'Live events + your tour',     Icon: IcShows },
    { k: 'studio',   label: 'Studio',    sub: 'Upload, releases, payouts',   Icon: IcStudio },
  ];

  return (
    <div className="wb-view-pad" style={{ maxWidth: 1100 }}>
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-ink-3)' }}>● PERSONAL · THIS BROWSER · SYNCS ACROSS DEVICES</div>
          <h1 className="wb-page-title">Settings <span style={{ color: 'var(--wb-ink-2)', fontWeight: 400 }}>· page customization</span></h1>
          <p className="wb-page-sub">Make iHYPE feel like yours. Changes apply live.</p>
        </div>
        <button className="wb-btn-ghost" onClick={() => setPref('__reset__', null)}>Reset to defaults</button>
      </div>

      <div className="wb-settings-grid">
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
              { k: 'panel_roles', l: 'Your roles', d: 'Active + add new' },
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
      </div>

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
