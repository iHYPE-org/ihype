'use client';
import React, { useState, useEffect } from 'react';
import type { WorkbenchData, WbTrack } from '@/types/workbench';
import { T, WMPill } from './MobilePrimitives';
import { DiscoverDailyCard } from './DiscoverDailyCard';

type ListenSubTab = 'search' | 'seeds' | 'radio' | 'charts' | 'playlists' | 'following';
const SUB_TABS: { id: ListenSubTab; label: string }[] = [
  { id: 'search',    label: 'Search'    },
  { id: 'seeds',     label: 'Seeds'     },
  { id: 'radio',     label: 'Radio'     },
  { id: 'charts',    label: 'Charts'    },
  { id: 'playlists', label: 'Playlists' },
  { id: 'following', label: 'Following' },
];

// ─── Album art gradient placeholder ──────────────────────────
function AlbumArt({ c = T.accent, size = 48 }: { c?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size / 6)), background: `linear-gradient(135deg, ${c}, ${c}66 60%, ${T.bg3})`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 60%)' }} />
    </div>
  );
}

// ─── Search tab ───────────────────────────────────────────────
const LS_HISTORY_KEY = 'ihype_search_history';
function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) ?? '[]') as string[]; } catch { return []; }
}

function SearchTab({ data, onPlay, currentIdx }: { data: WorkbenchData; onPlay: (i: number) => void; currentIdx: number }) {
  const [q, setQ] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => { setHistory(getHistory()); }, []);

  const queue = data.tracks;
  const ql = q.toLowerCase().trim();
  const results = ql ? queue.filter(t => t.title.toLowerCase().includes(ql) || t.artistName.toLowerCase().includes(ql)).slice(0, 20) : [];

  function commit(term: string) {
    const next = [term, ...history.filter(x => x !== term)].slice(0, 5);
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
    setQ(term);
  }

  return (
    <div style={{ padding: '0 18px' }}>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.ink3, pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && q.trim()) commit(q.trim()); }}
          placeholder="Search artists, tracks, playlists…"
          style={{ width: '100%', padding: '10px 36px 10px 38px', borderRadius: 12, border: `1px solid ${T.line}`, background: T.bg3, color: T.ink, fontFamily: T.fb, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
        {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.ink3, cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>}
      </div>

      {!q && history.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.ink3 }}>Recent</div>
            <button onClick={() => { localStorage.removeItem(LS_HISTORY_KEY); setHistory([]); }} style={{ background: 'none', border: 'none', color: T.ink3, fontFamily: T.fm, fontSize: 11, cursor: 'pointer' }}>Clear</button>
          </div>
          {history.map(h => (
            <div key={h} onClick={() => setQ(h)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.55rem 0', borderBottom: `1px solid ${T.line2}`, cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
              <span style={{ fontFamily: T.fb, fontSize: 13, color: T.ink2 }}>{h}</span>
            </div>
          ))}
        </div>
      )}

      {!q && (
        <div>
          <div style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.ink3, marginBottom: 10 }}>Trending now</div>
          {queue.slice(0, 6).map(t => (
            <div key={t.id} onClick={() => commit(t.title)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.65rem 0', borderBottom: `1px solid ${T.line2}`, cursor: 'pointer' }}>
              <AlbumArt c={t.color} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 1 }}>{t.artistName}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {q && results.length === 0 && <div style={{ textAlign: 'center', padding: '2rem 1rem', fontFamily: T.fm, fontSize: 13, color: T.ink3 }}>No results for &ldquo;{q}&rdquo;</div>}
      {q && results.map((t, i) => (
        <div key={t.id} onClick={() => { commit(t.title); onPlay(queue.indexOf(t)); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px', borderBottom: `1px solid ${T.line2}`, cursor: 'pointer', background: currentIdx === queue.indexOf(t) ? `${t.color}12` : 'transparent', borderRadius: 8 }}>
          <div style={{ width: 22, textAlign: 'center', fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: T.ink3 }}>{i + 1}</div>
          <AlbumArt c={t.color} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 1 }}>{t.artistName}</div>
          </div>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.pink, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>♥ {t.hypeCount}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Seeds tab (cards from daily discovery) ───────────────────
function SeedsTab({ data, onPlay }: { data: WorkbenchData; onPlay: (i: number) => void }) {
  const queue = data.tracks;
  return (
    <div style={{ padding: '0 18px' }}>
      <div style={{ marginBottom: 16 }}>
        <div onClick={() => { onPlay(0); }} style={{ margin: '0 0 20px', padding: 18, borderRadius: 18, position: 'relative', overflow: 'hidden', cursor: 'pointer', background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accent}88 32%, ${T.bg3} 100%)` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 18%, rgba(255,255,255,.28), transparent 55%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.bg, letterSpacing: '.16em', opacity: .85, textTransform: 'uppercase' }}>● Pick up where you left off</div>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, color: T.bg, marginTop: 8, lineHeight: 1.02, letterSpacing: '-.02em' }}>Tonight&#39;s Queue</div>
            <div style={{ fontFamily: T.fb, fontSize: 12, color: 'rgba(0,0,0,.65)', marginTop: 5 }}>{queue.length} tracks · finish a track to Hype it</div>
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: T.bg, color: T.ink, borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8L6 20z"/></svg> Play
            </div>
          </div>
        </div>
        <DiscoverDailyCard />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {queue.slice(0, 6).map((t, i) => (
          <button key={t.id} onClick={() => onPlay(i)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <div style={{ width: '100%', aspectRatio: '1', borderRadius: 16, background: `linear-gradient(150deg, ${t.color}, #1a1612 92%)`, position: 'relative', overflow: 'hidden', border: `1px solid ${T.line}` }}>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(255,255,255,.92)"><path d="M6 4l14 8L6 20z"/></svg>
              </div>
              <div style={{ position: 'absolute', left: 8, top: 8, padding: '2px 7px', borderRadius: 999, background: 'rgba(10,8,5,.5)', fontFamily: T.fm, fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff' }}>0:30</div>
            </div>
            <div style={{ fontFamily: T.fb, fontWeight: 700, fontSize: 13, color: T.ink, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artistName}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Radio tab ─────────────────────────────────────────────────
function RadioTab({ data, onOpenFM }: { data: WorkbenchData; onOpenFM?: () => void }) {
  const [active, setActive] = useState<string | null>(null);
  const shows = data.radioShows;

  if (shows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>No live shows right now</div>
        {onOpenFM && (
          <button onClick={onOpenFM} style={{ padding: '10px 20px', borderRadius: 99, background: T.bg2, border: `1px solid ${T.teal}44`, color: T.teal, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Open Halflight FM ↗</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 18px' }}>
      {shows.map(s => {
        const on = active === s.id;
        return (
          <div key={s.id} onClick={() => setActive(on ? null : s.id)} style={{ padding: 14, borderRadius: 16, border: `1px solid ${on ? s.color + '55' : T.line}`, background: on ? `${s.color}0d` : T.bg2, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${s.color}cc,${s.color}33)`, display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0, fontSize: 20 }}>
                {on ? '⏸' : '▶'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 2 }}>by {s.host} · {s.time}</div>
                <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 2 }}>{s.listeners.toLocaleString()} listening</div>
              </div>
              {s.live && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3c3c', flexShrink: 0 }} />}
            </div>
            {on && <div style={{ marginTop: 12, height: 3, borderRadius: 999, background: T.bg4, overflow: 'hidden' }}><div style={{ height: '100%', width: '38%', background: `linear-gradient(90deg,${s.color},${T.accent})`, borderRadius: 999 }} /></div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Charts tab ────────────────────────────────────────────────
type ChartPeriod = 'week' | 'month' | 'alltime';
type ChartTrack = { id: string; title: string; artistName: string; hypeCount: number; color: string };

function ChartsTab({ data, onPlay }: { data: WorkbenchData; onPlay: (i: number) => void }) {
  const [period, setPeriod] = useState<ChartPeriod>('week');
  const [charts, setCharts] = useState<{ national: ChartTrack[]; local: ChartTrack[]; forYou: ChartTrack[] } | null>(null);
  const queue = data.tracks;

  useEffect(() => {
    fetch(`/api/charts?city=${encodeURIComponent(data.city ?? '')}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCharts(d as { national: ChartTrack[]; local: ChartTrack[]; forYou: ChartTrack[] }); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const PERIODS: [ChartPeriod, string][] = [['week', 'This week'], ['month', 'This month'], ['alltime', 'All time']];
  const rising = [...queue].sort((a, b) => b.hypeCount - a.hypeCount).slice(0, 5);
  const tracks: ChartTrack[] = charts?.local ?? rising;

  return (
    <div style={{ padding: '0 18px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {PERIODS.map(([id, label]) => {
          const on = period === id;
          return (
            <button key={id} onClick={() => setPeriod(id)} style={{ padding: '5px 12px', borderRadius: 999, border: `1px solid ${on ? T.accent : T.line}`, background: on ? 'rgba(255,80,41,.12)' : 'transparent', color: on ? T.accent : T.ink3, fontFamily: T.fm, fontSize: 11, cursor: 'pointer', fontWeight: on ? 700 : 500 }}>{label}</button>
          );
        })}
      </div>
      <div style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.ink3, marginBottom: 12 }}>Top hypes · {data.city ?? 'Your city'}</div>
      {tracks.map((t, i) => (
        <div key={t.id} onClick={() => onPlay(Math.max(0, queue.findIndex(q2 => q2.id === t.id)))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.7rem 0', borderBottom: `1px solid ${T.line2}`, cursor: 'pointer' }}>
          <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, color: i < 3 ? T.purple : T.ink3, minWidth: 24, textAlign: 'center' }}>{i + 1}</span>
          <AlbumArt c={t.color} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.fb, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 1 }}>{t.artistName}</div>
          </div>
          <span style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3 }}>♥ {t.hypeCount.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Playlists tab ─────────────────────────────────────────────
function PlaylistsTab({ data, onPlay }: { data: WorkbenchData; onPlay: (i: number) => void }) {
  const queue = data.tracks;
  const playlists = [
    { n: "Tonight's Queue", meta: `${queue.length} tracks · auto-mixed`, c: T.accent },
    { n: 'Hyped by You',    meta: `${data.lifeStats?.totalHype ?? 0} hypes`,  c: T.purple },
    { n: `${data.city ?? 'Local'} Indie`, meta: 'Local scene', c: T.teal },
    { n: 'Late Drives',     meta: 'Your mix',    c: T.amber },
    { n: 'New Arrivals',    meta: 'This week',   c: T.pink },
    { n: 'Chill Sessions',  meta: 'Curated',     c: '#5c9eff' },
  ];

  return (
    <div style={{ padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {playlists.map((p, i) => (
        <div key={i} onClick={() => onPlay(i % Math.max(1, queue.length))} style={{ padding: '1rem', borderRadius: 16, border: `1px solid ${T.line}`, background: T.bg2, cursor: 'pointer', position: 'relative' }}>
          <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, background: `linear-gradient(135deg,${p.c}cc,${p.c}22)`, marginBottom: 10, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: -10, right: -10, width: '60%', aspectRatio: '1', borderRadius: '50%', background: `${p.c}44`, filter: 'blur(16px)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.04em', color: 'rgba(255,255,255,.85)', textAlign: 'center', lineHeight: 1.1 }}>{p.n.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
          </div>
          <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, lineHeight: 1.2, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.n}</span>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,80,41,.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill={T.accent}><polygon points="5,3 19,12 5,21"/></svg>
            </span>
          </div>
          <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3 }}>{p.meta}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Following tab ─────────────────────────────────────────────
const FOLLOWING_FEED = [
  { name: 'Midnight Echo', role: 'Artist', action: 'Dropped tickets', detail: 'Live at The Echo · face value · $18', time: '2m', tint: '#ff5029' },
  { name: 'DJ Caro',       role: 'DJ',     action: 'Starting a live show', detail: 'Late Night Frequencies · 2.4K listening', time: '1h', tint: '#b983ff' },
  { name: 'Nyla',          role: 'Artist', action: 'Added track to Seeds', detail: 'Goldenrod · new preview available', time: '3h', tint: '#22e5d4' },
  { name: 'Sunroom',       role: 'Artist', action: 'Announced new event', detail: 'Album Release · Gold-Diggers · Sun Jun 22', time: '1d', tint: '#ffb84a' },
  { name: 'The Echo',      role: 'Venue',  action: 'Booking offers open', detail: 'Fridays in July · capacity 300', time: '2d', tint: '#22e5d4' },
];

function FollowingTab() {
  return (
    <div style={{ padding: '0 18px' }}>
      <div style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.ink3, marginBottom: 12 }}>Activity from people you follow</div>
      {FOLLOWING_FEED.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '.85rem 0', borderBottom: `1px solid ${T.line2}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${f.tint}88,${f.tint}22)`, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 18 }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: '#fff' }}>{f.name[0]}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: T.fb, fontWeight: 700, fontSize: 13 }}>{f.name}</span>
              <span style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, padding: '1px 6px', borderRadius: 999, border: `1px solid ${T.line2}`, background: T.bg3 }}>{f.role}</span>
            </div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, marginBottom: 2 }}>{f.action}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3 }}>{f.detail}</div>
          </div>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, flexShrink: 0, marginTop: 2 }}>{f.time}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Screen: Listen ──────────────────────────────────────────
export function ScreenListen({ data, onPlay, onExpand, currentIdx, onOpenFM }: {
  data: WorkbenchData;
  onPlay: (i: number) => void;
  onExpand: () => void;
  currentIdx: number;
  onOpenFM?: () => void;
}) {
  const [sub, setSub] = useState<ListenSubTab>('seeds');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 0, flexShrink: 0, borderBottom: `1px solid ${T.line}`, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {SUB_TABS.map(({ id, label }) => {
          const on = sub === id;
          return (
            <button key={id} onClick={() => setSub(id)} style={{
              flex: 1, minWidth: 0, padding: '10px 4px 8px', borderRadius: 0,
              border: 'none', borderBottom: on ? `2px solid ${T.accent}` : '2px solid transparent',
              background: 'transparent', color: on ? T.ink : T.ink3,
              fontFamily: T.fm, fontSize: 11, letterSpacing: '.02em', fontWeight: on ? 700 : 500,
              cursor: 'pointer', transition: 'color .15s, border-color .15s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{label}</button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0 130px' }}>
        {sub === 'search'    && <SearchTab data={data} onPlay={onPlay} currentIdx={currentIdx} />}
        {sub === 'seeds'     && <SeedsTab data={data} onPlay={i => { onPlay(i); onExpand(); }} />}
        {sub === 'radio'     && <RadioTab data={data} onOpenFM={onOpenFM} />}
        {sub === 'charts'    && <ChartsTab data={data} onPlay={onPlay} />}
        {sub === 'playlists' && <PlaylistsTab data={data} onPlay={i => { onPlay(i); onExpand(); }} />}
        {sub === 'following' && <FollowingTab />}
      </div>
    </div>
  );
}

// ─── Full Player overlay with pull-up-to-hype ─────────────────
export function FullPlayer({ track, playing, onToggle, onCollapse, onHype, onPrev, onNext, progress }: {
  track: WbTrack;
  playing: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onHype: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  progress: number;
}) {
  const [pull, setPull] = React.useState(0);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const drag = React.useRef<{ y: number } | null>(null);

  const startDrag = (y: number) => { drag.current = { y }; };
  const moveDrag = (y: number) => {
    if (!drag.current) return;
    const dy = drag.current.y - y;
    setPull(Math.max(0, Math.min(1, dy / 150)));
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    setPull(p => { if (p >= 1) { onHype(); } return 0; });
  };

  const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const elapsed = Math.round(track.durationSec * progress);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      color: T.ink, fontFamily: T.fb,
      background: `linear-gradient(180deg, ${track.color}38 0%, ${T.bg} 52%), ${T.bg}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px 4px' }}>
        <button onClick={onCollapse} style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,.1)', border: 'none', color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-5 6l6-6-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(90 12 12)"/></svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.16em', textTransform: 'uppercase' }}>Now Playing</div>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 12.5, marginTop: 2 }}>Tonight&#39;s Queue</div>
        </div>
        <button onClick={() => setMenuOpen(true)} style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: T.ink, cursor: 'pointer' }}>⋯</button>
      </div>

      <div style={{ padding: '18px 30px 0' }}>
        <div style={{ width: '100%', aspectRatio: '1', borderRadius: 20, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}77 50%, ${T.bg3})`, boxShadow: `0 30px 80px ${track.color}40` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.3), transparent 55%)' }} />
          <div style={{ position: 'absolute', left: 20, bottom: 20, fontFamily: T.fd, fontWeight: 800, fontSize: 34, color: 'rgba(255,255,255,.95)', textShadow: '0 2px 14px rgba(0,0,0,.5)', letterSpacing: '-.02em', lineHeight: .95, textTransform: 'uppercase', maxWidth: '80%' }}>{track.title}</div>
        </div>
      </div>

      <div style={{ padding: '22px 30px 0' }}>
        <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 26, margin: 0, letterSpacing: '-.02em', lineHeight: 1 }}>{track.title}</h1>
        <div style={{ fontFamily: T.fb, fontSize: 15, color: T.ink2, marginTop: 5 }}>{track.artistName}</div>
      </div>

      <div style={{ padding: '20px 30px 0' }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 2 }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: T.ink, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', right: -5, top: -4, width: 12, height: 12, borderRadius: 99, background: T.ink }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 8 }}>
          <span>{fmtSec(elapsed)}</span><span>{track.duration}</span>
        </div>
      </div>

      <div style={{ padding: '14px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onPrev} disabled={!onPrev} style={{ background: 'none', border: 'none', cursor: onPrev ? 'pointer' : 'default', color: onPrev ? T.ink2 : T.ink4, padding: 0 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M11 19V5l-9 7 9 7zm2-14v14l9-7-9-7z"/></svg>
        </button>
        <button onClick={onToggle} style={{ width: 68, height: 68, borderRadius: 99, background: T.ink, color: T.bg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
          {playing
            ? <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            : <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8L6 20z"/></svg>}
        </button>
        <button onClick={onNext} disabled={!onNext} style={{ background: 'none', border: 'none', cursor: onNext ? 'pointer' : 'default', color: onNext ? T.ink2 : T.ink4, padding: 0 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M13 5v14l9-7-9-7zm-11 0v14l9-7-9-7z"/></svg>
        </button>
      </div>

      {/* HYPE PULL ZONE */}
      <div
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startDrag(e.clientY); }}
        onPointerMove={e => moveDrag(e.clientY)}
        onPointerUp={endDrag}
        style={{ marginTop: 'auto', padding: '0 16px 18px', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
      >
        <div style={{
          position: 'relative', borderRadius: 18, overflow: 'hidden',
          border: `1px solid ${T.accent}${pull > 0 ? '80' : '40'}`,
          background: T.bg2, height: 64 + pull * 44,
          transition: drag.current ? 'none' : 'height .25s cubic-bezier(.2,.8,.2,1)',
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pull * 100}%`, background: `linear-gradient(180deg, ${T.accent}cc, ${T.accent})`, transition: drag.current ? 'none' : 'height .25s' }} />
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: pull > 0.5 ? T.bg : T.accent }}>
              <svg width={pull > 0.5 ? 24 : 20} height={pull > 0.5 ? 24 : 20} viewBox="0 0 24 24" fill="currentColor" style={{ transform: `scale(${1 + pull * 0.5}) translateY(${-pull * 4}px)`, transition: drag.current ? 'none' : 'transform .2s' }}>
                <path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/>
              </svg>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, letterSpacing: '-.01em' }}>
                {pull >= 1 ? 'Release to Hype' : 'Cast Hype'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: pull > 0.5 ? 'rgba(0,0,0,.6)' : T.ink3, fontFamily: T.fm, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              ↑ Pull up to cast
            </div>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 10 }}
          onClick={() => setMenuOpen(false)}
        >
          <div style={{ background: T.bg2, borderRadius: '18px 18px 0 0', padding: '12px 0 40px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.18)', margin: '0 auto 20px' }} />
            <div style={{ padding: '0 6px 10px', fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', textAlign: 'center', textTransform: 'uppercase' }}>{track.title}</div>
            {([
              { icon: '＋', label: 'Add to playlist', action: () => setMenuOpen(false) },
              { icon: '↗', label: `Share "${track.title}"`, action: () => {
                setMenuOpen(false);
                if (navigator.share) {
                  navigator.share({ title: track.title, text: `${track.title} by ${track.artistName}` }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(`${track.title} by ${track.artistName}`).catch(() => {});
                }
              }},
              { icon: '→', label: `View ${track.artistName}`, action: () => {
                setMenuOpen(false);
                if (track.artistSlug) window.location.href = `/artists/${track.artistSlug}`;
              }},
            ] as { icon: string; label: string; action: () => void }[]).map(opt => (
              <button key={opt.label} onClick={opt.action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '15px 24px', background: 'none', border: 'none', color: T.ink, cursor: 'pointer', textAlign: 'left', fontFamily: T.fb, fontSize: 15 }}>
                <span style={{ width: 26, fontFamily: T.fd, fontWeight: 700, color: T.ink3, textAlign: 'center', fontSize: 16 }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hype confirmation overlay ─────────────────────────────────
export function HypeOverlay({ track, onDone }: { track: WbTrack; onDone: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '0 34px', textAlign: 'center',
      background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 38%, ${T.accent}33, transparent 60%)` }} />
      <div style={{
        position: 'relative', width: 140, height: 140, borderRadius: 99,
        border: `2px solid ${T.accent}`, background: `${T.accent}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30,
        animation: 'hypePop .5s cubic-bezier(.2,1.3,.4,1) both',
      }}>
        <svg width={70} height={70} viewBox="0 0 24 24" fill={T.accent}>
          <path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/>
        </svg>
        {[0, 60, 120, 180, 240, 300].map(a => (
          <div key={a} style={{ position: 'absolute', width: 6, height: 6, borderRadius: 99, background: T.accent, transform: `rotate(${a}deg) translateY(-92px)` }} />
        ))}
      </div>
      <div style={{ position: 'relative', fontFamily: T.fm, fontSize: 9, color: T.accent, letterSpacing: '.18em', textTransform: 'uppercase' }}>● Hype Cast · Verified</div>
      <h1 style={{ position: 'relative', fontFamily: T.fs, fontStyle: 'italic', fontWeight: 400, fontSize: 40, letterSpacing: '-.02em', margin: '14px 0 0', lineHeight: 1 }}>
        You hyped<br/>
        <span style={{ fontFamily: T.fd, fontStyle: 'normal', fontWeight: 800, color: T.accent }}>{track.title}.</span>
      </h1>
      <p style={{ position: 'relative', fontFamily: T.fb, fontSize: 13, color: T.ink2, marginTop: 14, maxWidth: 280, lineHeight: 1.5 }}>
        1 of <strong style={{ color: T.ink }}>{(track.hypeCount + 1).toLocaleString()}</strong> real fans behind {track.artistName} this week. It just moved up the chart.
      </p>
      <div style={{ position: 'relative', display: 'flex', gap: 10, marginTop: 26 }}>
        <button onClick={onDone} style={{ padding: '12px 18px', background: T.bg2, color: T.ink, border: `1px solid ${T.line2}`, borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Keep listening</button>
        <button onClick={onDone} style={{ padding: '12px 18px', background: T.accent, color: T.bg, border: 'none', borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>See the chart →</button>
      </div>
    </div>
  );
}
