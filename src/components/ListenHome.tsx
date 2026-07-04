'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const PALETTE = ['#ff5029', '#b983ff', '#22e5d4', '#ff3e9a', '#ffb84a', '#7fb3ff'];

type Seed = {
  id: string;
  title: string;
  artistName: string;
  genres: string[];
  hypeCount: number;
  reason: string;
};

type RadioShow = {
  id: string;
  title: string;
  status: string;
  startsAt: string | null;
  headlinerProfile?: { name: string } | null;
};

type ChartTrack = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  city: string;
  genres: string[];
  hypeCount: number;
  color: string;
  mediaUrl: string;
  durationSec: number;
};

type SearchResult = {
  type: 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre';
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
  hypeCount?: number;
};

type PlaylistItem = {
  id: string;
  mediaId: string;
  title: string;
  artistName: string;
  url: string;
  artistProfileSlug: string | null;
  position: number;
};

type Playlist = { id: string; name: string; items: PlaylistItem[] };

type FavoriteMedia = {
  id: string;
  mediaId: string;
  title: string;
  artistName: string;
  artistProfileSlug: string | null;
};

const b: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, padding: '9px 16px', minHeight: 44,
  borderRadius: 9, cursor: 'pointer', border: 'none', transition: 'all 150ms',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none',
};
const bSolid: React.CSSProperties = { ...b, background: 'var(--accent)', color: '#fff' };
const bGhost: React.CSSProperties = { ...b, background: 'transparent', color: 'rgba(240,235,229,.6)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)' };

const panel: React.CSSProperties = { border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, background: 'rgba(255,255,255,.03)', overflow: 'hidden' };
const panelHead: React.CSSProperties = { padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)' };
const chartRow: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.05)' };
const emptyStyle: React.CSSProperties = { textAlign: 'center', padding: '60px 24px', color: 'rgba(240,235,229,.5)' };
const rowTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const rowSubtitle: React.CSSProperties = { fontSize: 12, color: 'rgba(240,235,229,.55)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={panel}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={chartRow}>
          <div className="ihype-skeleton" style={{ width: 5, height: 36, borderRadius: 3, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
            <div className="ihype-skeleton" style={{ width: `${55 - i * 6}%`, height: 15, borderRadius: 5 }} />
            <div className="ihype-skeleton" style={{ width: `${35 - i * 4}%`, height: 11, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 20, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 10 }}>
          <div className="ihype-skeleton" style={{ width: 90, height: 11, borderRadius: 4 }} />
          <div className="ihype-skeleton" style={{ width: '60%', height: 19, borderRadius: 5 }} />
          <div className="ihype-skeleton" style={{ width: '35%', height: 13, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

function timeLabel(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function SeedDeck({ seeds, onAct }: { seeds: Seed[]; onAct: (seed: Seed, action: 'save' | 'skip' | 'hype') => void }) {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [flash, setFlash] = useState<'add' | 'skip' | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const card = seeds[idx];
  const next = seeds[idx + 1];

  if (!card) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 24px' }}>
        <p style={{ marginTop: 14, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'rgba(240,235,229,.6)' }}>You&apos;re all caught up.</p>
        <p style={{ marginTop: 6, fontSize: 13, color: 'rgba(240,235,229,.5)' }}>New seeds drop as artists upload. Check back soon.</p>
        <button style={{ ...bGhost, marginTop: 18 }} onClick={() => setIdx(0)} type="button">Start over</button>
      </div>
    );
  }

  const color = PALETTE[idx % PALETTE.length];
  const g2 = PALETTE[(idx + 2) % PALETTE.length];
  const nextColor = next ? PALETTE[(idx + 1) % PALETTE.length] : color;
  const nextG2 = next ? PALETTE[(idx + 3) % PALETTE.length] : g2;

  function decide(x: number) {
    if (x > 95) return 'add';
    if (x < -95) return 'skip';
    return null;
  }
  function onDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    setDrag({ x, y, active: true });
    setFlash(x > 35 ? 'add' : x < -35 ? 'skip' : null);
  }
  function onUp() {
    if (!start.current) return;
    const d = decide(drag.x);
    start.current = null;
    if (d) commit(d);
    else { setDrag({ x: 0, y: 0, active: false }); setFlash(null); }
  }
  function commit(d: 'add' | 'skip') {
    const off = d === 'add' ? { x: 560, y: 0 } : { x: -560, y: 0 };
    setDrag({ ...off, active: false });
    onAct(card, d === 'add' ? 'save' : 'skip');
    setTimeout(() => {
      setDrag({ x: 0, y: 0, active: false });
      setFlash(null);
      setIdx((i) => i + 1);
    }, 230);
  }

  const rot = drag.x / 12;
  const lift = Math.min(1, Math.abs(drag.x) / 260);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 440, aspectRatio: '1 / 1', margin: '4px auto 0', touchAction: 'none' }}>
        {next && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 28, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)',
            background: `linear-gradient(155deg, ${nextColor}, ${nextG2})`,
            transform: `scale(${Math.min(1, 0.94 + Math.abs(drag.x) / 2600)}) translateY(${Math.max(0, 10 - Math.abs(drag.x) / 26)}px)`,
            opacity: Math.min(0.78, 0.55 + Math.abs(drag.x) / 900),
            transition: drag.active ? 'none' : 'transform .23s cubic-bezier(.4,0,.2,1), opacity .23s ease',
          }} />
        )}

        <div
          onPointerCancel={onUp}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          style={{
            position: 'absolute', inset: 0, borderRadius: 28, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)',
            boxShadow: `0 ${24 + lift * 30}px ${70 + lift * 60}px rgba(0,0,0,${0.6 + lift * 0.15})`,
            background: `linear-gradient(155deg, ${color}, ${g2})`,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', userSelect: 'none', cursor: 'grab',
            transform: `translateX(${drag.x}px) translateY(${drag.y * 0.22 + (drag.active ? -lift * 10 : 0)}px) rotate(${rot}deg) scale(${1 + lift * 0.035})`,
            transition: drag.active ? 'none' : 'transform .28s cubic-bezier(.34,1.2,.4,1), box-shadow .28s ease',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.06) 48%, rgba(0,0,0,.2) 100%)' }} />

          <div style={{
            position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.92)',
            background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.22)', padding: '5px 11px', borderRadius: 9999,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} /> New seed
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onAct(card, 'hype'); }}
            style={{
              position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: '#fff', cursor: 'pointer',
              background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.2)', padding: '5px 11px', borderRadius: 9999,
            }}
            type="button"
          >
            🔥 {card.hypeCount || '—'}
          </button>

          {flash === 'add' && (
            <div style={{ position: 'absolute', top: '50%', right: 24, zIndex: 5, transform: `translateY(-50%) scale(${Math.min(1.15, 0.85 + Math.abs(drag.x) / 320)})`, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', padding: '10px 22px', borderRadius: 14, border: '3px solid #22e5d4', background: 'rgba(34,229,212,.34)', boxShadow: '0 0 30px rgba(34,229,212,.5)' }}>Seed</div>
          )}
          {flash === 'skip' && (
            <div style={{ position: 'absolute', top: '50%', left: 24, zIndex: 5, transform: `translateY(-50%) scale(${Math.min(1.15, 0.85 + Math.abs(drag.x) / 320)})`, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', padding: '10px 22px', borderRadius: 14, border: '3px solid #fff', background: 'rgba(0,0,0,.42)' }}>Skip</div>
          )}

          <div style={{ position: 'relative', zIndex: 3, padding: 22 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 11 }}>
              {card.genres.slice(0, 3).map((t) => (
                <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff', background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.28)', borderRadius: 9999, padding: '3px 10px' }}>{t}</span>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, letterSpacing: '-.035em', color: '#fff', lineHeight: 0.98, textShadow: '0 2px 18px rgba(0,0,0,.4)' }}>{card.title}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'rgba(255,255,255,.92)', marginTop: 5 }}>{card.artistName} · {card.reason}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 24 }}>
        <button onClick={() => commit('skip')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }} type="button">
          <span style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)' }}>✕</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)' }}>Skip</span>
        </button>
        <button onClick={() => commit('add')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }} type="button">
          <span style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(34,229,212,.4)', background: 'rgba(34,229,212,.14)' }}>+</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)' }}>Save to library</span>
        </button>
      </div>
      <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(240,235,229,.5)' }}>{idx + 1} / {seeds.length}</div>
    </div>
  );
}

export function ListenHome() {
  const [tab, setTab] = useState<'search' | 'seeds' | 'radio' | 'charts' | 'playlists'>('seeds');
  const [genre, setGenre] = useState('All');
  const [seeds, setSeeds] = useState<Seed[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [radio, setRadio] = useState<RadioShow[] | null>(null);
  const [charts, setCharts] = useState<{ national: ChartTrack[]; local: ChartTrack[]; forYou: ChartTrack[] } | null>(null);
  const [chartScope, setChartScope] = useState<'local' | 'forYou' | 'national'>('forYou');
  const [chartGenre, setChartGenre] = useState('All');
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [favorites, setFavorites] = useState<FavoriteMedia[]>([]);
  const [openPl, setOpenPl] = useState<string | null>(null);
  const [newPlName, setNewPlName] = useState('');
  const [dragState, setDragState] = useState<{ index: number; overIndex: number } | null>(null);
  const rowRefsRef = useRef<(HTMLDivElement | null)[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    fetch('/api/discover/seeds').then((r) => r.json()).then((d) => setSeeds(d.seeds ?? [])).catch(() => setSeeds([]));
    fetch('/api/shows?radioShows=1').then((r) => (r.ok ? r.json() : [])).then((d) => setRadio(Array.isArray(d) ? d : [])).catch(() => setRadio([]));
    fetch('/api/charts').then((r) => r.json()).then((d) => setCharts(d)).catch(() => setCharts({ national: [], local: [], forYou: [] }));
    fetch('/api/fan-playlists').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d) { setPlaylists(d.playlists ?? []); setFavorites(d.favorites ?? []); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const ql = q.trim();
    if (!ql) { setSearchResults(null); return; }
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(ql)}&type=all`).then((r) => r.json()).then((d) => setSearchResults(d.results ?? [])).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  async function actOnSeed(seed: Seed, action: 'save' | 'skip' | 'hype') {
    if (action !== 'hype') {
      showToast(action === 'save' ? 'Saved to your library' : 'Skipped');
    } else {
      showToast('Hyped');
      setSeeds((ss) => (ss ? ss.map((s) => (s.id === seed.id ? { ...s, hypeCount: s.hypeCount + 1 } : s)) : ss));
    }
    try {
      await fetch(`/api/discover/seeds/${seed.id}/${action}`, { method: 'POST' });
    } catch { /* best-effort */ }
  }

  async function createPlaylist() {
    const name = newPlName.trim();
    if (!name) return;
    const res = await fetch('/api/fan-playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? 'Could not create playlist.'); return; }
    setPlaylists((ps) => [...(ps ?? []), data]);
    setNewPlName('');
    showToast('Playlist created');
  }

  async function removeItem(playlistId: string, itemId: string) {
    const res = await fetch(`/api/fan-playlists/${playlistId}/items/${itemId}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Could not remove this track.'); return; }
    setPlaylists((ps) => (ps ?? []).map((p) => (p.id === playlistId ? { ...p, items: p.items.filter((i) => i.id !== itemId).map((i, idx) => ({ ...i, position: idx })) } : p)));
  }

  async function persistReorder(playlistId: string, items: PlaylistItem[]) {
    const res = await fetch(`/api/fan-playlists/${playlistId}/items`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: items.map((i) => i.id) }) });
    const data = await res.json();
    if (res.ok) {
      setPlaylists((ps) => (ps ?? []).map((p) => (p.id === playlistId ? { ...p, items: data.items ?? items } : p)));
    }
  }

  function onGripPointerDown(playlistId: string, idx: number, e: React.PointerEvent) {
    e.preventDefault();
    setDragState({ index: idx, overIndex: idx });
    const move = (ev: PointerEvent) => {
      const y = ev.clientY;
      let newOver = idx;
      rowRefsRef.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) newOver = i;
      });
      setDragState((ds) => (ds ? { ...ds, overIndex: newOver } : ds));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragState((ds) => {
        if (ds && ds.index !== ds.overIndex) {
          const playlist = (playlists ?? []).find((p) => p.id === playlistId);
          if (playlist) {
            const items = [...playlist.items];
            const [moved] = items.splice(ds.index, 1);
            items.splice(ds.overIndex, 0, moved);
            const normalized = items.map((it, i) => ({ ...it, position: i }));
            setPlaylists((ps) => (ps ?? []).map((p) => (p.id === playlistId ? { ...p, items: normalized } : p)));
            void persistReorder(playlistId, normalized);
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function shareLink(playlistId: string) {
    const link = `${window.location.origin}/playlist/${playlistId}`;
    navigator.clipboard?.writeText(link);
    showToast('Share link copied');
  }

  const genres = useMemo(() => {
    const set = new Set<string>();
    (seeds ?? []).forEach((s) => s.genres.forEach((g) => set.add(g)));
    return ['All', ...Array.from(set)];
  }, [seeds]);

  const filteredSeeds = genre === 'All' ? seeds ?? [] : (seeds ?? []).filter((s) => s.genres.includes(genre));

  const chartRows = charts ? charts[chartScope] : [];
  const chartGenres = useMemo(() => {
    const set = new Set<string>();
    chartRows.forEach((c) => c.genres.forEach((g) => set.add(g)));
    return ['All', ...Array.from(set)];
  }, [chartRows]);
  const filteredChartRows = chartGenre === 'All' ? chartRows : chartRows.filter((c) => c.genres.includes(chartGenre));

  const liveShow = (radio ?? []).find((s) => s.status === 'LIVE');
  const upcomingShows = (radio ?? []).filter((s) => s.status === 'SCHEDULED').slice(0, 3);

  const searchArtists = (searchResults ?? []).filter((r) => r.type === 'artist' || r.type === 'venue' || r.type === 'promoter');
  const searchSongs = (searchResults ?? []).filter((r) => r.type === 'song');

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'search', label: 'Search' },
    { id: 'seeds', label: 'Seeds' },
    { id: 'radio', label: 'Radio' },
    { id: 'charts', label: 'Charts' },
    { id: 'playlists', label: 'Playlists' },
  ];

  const openPlaylist = (playlists ?? []).find((p) => p.id === openPl) ?? null;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px' }}>
      <style>{`@keyframes ihype-blink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }`}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 300, background: 'var(--ink)', color: 'var(--bg)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, padding: '12px 22px', borderRadius: 9999, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>YOUR SCENE</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, margin: '0 0 6px' }}>Listen</h1>
        <p style={{ fontSize: 14, color: 'rgba(240,235,229,.55)', margin: 0 }}>Discovery, radio, and charts — personalized for your taste.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
        {tabs.map((t) => (
          <div
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 14, padding: '9px 18px', borderRadius: 9999, cursor: 'pointer',
              background: tab === t.id ? 'rgba(255,80,41,.1)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${tab === t.id ? 'rgba(255,80,41,.35)' : 'rgba(255,255,255,.08)'}`,
              color: tab === t.id ? 'var(--ink)' : 'rgba(240,235,229,.55)', fontWeight: tab === t.id ? 500 : 400,
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {/* SEARCH */}
      {tab === 'search' && (
        <div>
          <input
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tracks, artists, genres…"
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, marginBottom: 24 }}
            type="text"
            value={q}
          />
          {!q.trim() && <div style={emptyStyle}><p>Search across tracks, artists, and genres.</p></div>}
          {q.trim() && searchResults === null && <ListSkeleton rows={5} />}
          {q.trim() && searchResults && searchArtists.length === 0 && searchSongs.length === 0 && (
            <div style={emptyStyle}><p>No results for &ldquo;{q}&rdquo;.</p></div>
          )}
          {searchArtists.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginBottom: 12 }}>Artists</div>
              <div style={panel}>
                {searchArtists.map((r, i) => (
                  <Link key={r.id} href={r.type === 'venue' ? `/venues/${r.slug}` : r.type === 'promoter' ? `/promoters/${r.slug}` : `/artists/${r.slug}`} style={{ ...chartRow, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                    <div style={{ width: 5, height: 36, borderRadius: 3, flexShrink: 0, background: PALETTE[i % PALETTE.length] }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={rowTitle}>{r.name}</div>
                      <div style={rowSubtitle}>{r.subtitle}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{r.hypeCount?.toLocaleString() ?? ''}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {searchSongs.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginBottom: 12 }}>Tracks</div>
              <div style={panel}>
                {searchSongs.map((r) => (
                  <div key={r.id} style={chartRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={rowTitle}>{r.name}</div>
                      <div style={rowSubtitle}>{r.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEEDS */}
      {tab === 'seeds' && (
        <div>
          {genres.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {genres.map((g) => (
                <div
                  key={g}
                  onClick={() => setGenre(g)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 9999, cursor: 'pointer',
                    background: genre === g ? 'var(--ink)' : 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
                    color: genre === g ? 'var(--bg)' : 'rgba(240,235,229,.5)',
                  }}
                >
                  {g}
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 13, color: 'rgba(240,235,229,.5)', margin: '0 0 18px', textAlign: 'center' }}>Swipe right to save · left to skip</p>
          {seeds === null ? (
            <div style={emptyStyle}><p>Loading seeds…</p></div>
          ) : filteredSeeds.length === 0 ? (
            <div style={emptyStyle}><p>No new seeds right now.</p></div>
          ) : (
            <SeedDeck onAct={actOnSeed} seeds={filteredSeeds} />
          )}
        </div>
      )}

      {/* RADIO */}
      {tab === 'radio' && (
        <div>
          {radio === null && <CardSkeleton />}
          {radio !== null && !liveShow && upcomingShows.length === 0 && (
            <div style={emptyStyle}><p>No shows on air or scheduled right now.</p></div>
          )}
          {liveShow && (
            <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 20, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(240,235,229,.5)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'ihype-blink 1.2s ease-in-out infinite' }} /> LIVE NOW
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{liveShow.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(240,235,229,.6)', marginBottom: 16 }}>{liveShow.headlinerProfile?.name ?? 'iHYPE Radio'}</div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <Link href="/radio" style={bSolid}>Tune In</Link>
              </div>
            </div>
          )}
          {upcomingShows.map((s) => (
            <div key={s.id} style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 20, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(240,235,229,.5)', marginBottom: 10 }}>{timeLabel(s.startsAt)}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(240,235,229,.6)', marginBottom: 16 }}>{s.headlinerProfile?.name ?? 'iHYPE Radio'}</div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <Link href="/radio" style={bGhost}>View schedule</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHARTS */}
      {tab === 'charts' && (
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[{ id: 'forYou' as const, label: 'For You' }, { id: 'local' as const, label: 'Local' }, { id: 'national' as const, label: 'National' }].map((s) => (
              <div
                key={s.id}
                onClick={() => setChartScope(s.id)}
                style={{ fontSize: 12, padding: '7px 14px', borderRadius: 9999, cursor: 'pointer', border: `1px solid ${chartScope === s.id ? 'rgba(255,80,41,.4)' : 'rgba(255,255,255,.1)'}`, background: chartScope === s.id ? 'rgba(255,80,41,.12)' : 'rgba(255,255,255,.03)', color: chartScope === s.id ? 'var(--ink)' : 'rgba(240,235,229,.6)' }}
              >
                {s.label}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {chartGenres.map((g) => (
              <div
                key={g}
                onClick={() => setChartGenre(g)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 11px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${chartGenre === g ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.08)'}`, color: chartGenre === g ? 'var(--ink)' : 'rgba(240,235,229,.55)' }}
              >
                {g}
              </div>
            ))}
          </div>
          <div style={panel}>
            <div style={panelHead}>Hype Leaderboard · Last 7 days</div>
            {charts === null && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={chartRow}>
                <div className="ihype-skeleton" style={{ width: 26, height: 18, borderRadius: 4, flexShrink: 0 }} />
                <div className="ihype-skeleton" style={{ width: 5, height: 36, borderRadius: 3, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                  <div className="ihype-skeleton" style={{ width: `${50 - i * 5}%`, height: 15, borderRadius: 5 }} />
                  <div className="ihype-skeleton" style={{ width: `${30 - i * 3}%`, height: 11, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            {charts !== null && filteredChartRows.length === 0 && <div style={{ ...emptyStyle, padding: '32px 20px' }}><p>No tracks charting here yet.</p></div>}
            {filteredChartRows.map((c, i) => (
              <Link key={c.id} href={`/artists/${c.artistSlug}`} style={{ ...chartRow, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, width: 26, color: 'rgba(240,235,229,.2)', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ width: 5, height: 36, borderRadius: 3, flexShrink: 0, background: c.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={rowTitle}>{c.title}</div>
                  <div style={rowSubtitle}>{c.artistName}{c.city ? ` · ${c.city}` : ''}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', color: 'var(--accent)', flexShrink: 0 }}>{c.hypeCount.toLocaleString()}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* PLAYLISTS */}
      {tab === 'playlists' && !openPl && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)' }}>
              Your Playlists · {playlists?.length ?? 0}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                onChange={(e) => setNewPlName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createPlaylist(); }}
                placeholder="New playlist name"
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--font-body)' }}
                type="text"
                value={newPlName}
              />
              <button onClick={createPlaylist} style={bGhost} type="button">+ New</button>
            </div>
          </div>

          {playlists === null && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={panel}>
                  <div className="ihype-skeleton" style={{ height: 90, borderRadius: 0 }} />
                  <div style={{ padding: '16px 18px 18px', display: 'grid', gap: 8 }}>
                    <div className="ihype-skeleton" style={{ width: '70%', height: 16, borderRadius: 5 }} />
                    <div className="ihype-skeleton" style={{ width: '40%', height: 12, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {playlists !== null && playlists.length === 0 && <div style={{ ...emptyStyle, padding: '40px 20px' }}><p>No playlists yet. Create your first.</p></div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {(playlists ?? []).map((p, i) => (
              <div key={p.id} onClick={() => setOpenPl(p.id)} style={{ ...panel, cursor: 'pointer' }}>
                <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${PALETTE[i % PALETTE.length]}33 0%, transparent 100%)`, borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 28 }}>🎵</div>
                <div style={{ padding: '16px 18px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'rgba(240,235,229,.5)' }}>{p.items.length} track{p.items.length === 1 ? '' : 's'}</div>
                </div>
              </div>
            ))}
          </div>

          {favorites.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginBottom: 12 }}>Favorites</div>
              <div style={panel}>
                {favorites.map((f) => (
                  f.artistProfileSlug ? (
                    <Link key={f.id} href={`/artists/${f.artistProfileSlug}`} style={{ ...chartRow, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={rowTitle}>{f.title}</div><div style={rowSubtitle}>{f.artistName}</div></div>
                    </Link>
                  ) : (
                    <div key={f.id} style={chartRow}>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={rowTitle}>{f.title}</div><div style={rowSubtitle}>{f.artistName}</div></div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PLAYLIST DETAIL */}
      {tab === 'playlists' && openPl && openPlaylist && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => setOpenPl(null)} style={bGhost} type="button">← Back</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => shareLink(openPlaylist.id)} style={bGhost} type="button">Share</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(255,80,41,.3) 0%, transparent 100%)', border: '1px solid rgba(255,255,255,.06)', fontSize: 28 }}>🎵</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>{openPlaylist.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,.5)', marginTop: 2 }}>{openPlaylist.items.length} track{openPlaylist.items.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div style={panel}>
            {openPlaylist.items.length === 0 && <div style={{ ...emptyStyle, padding: '32px 20px' }}><p>No tracks yet — add tracks from the media player while listening.</p></div>}
            {openPlaylist.items.map((it, i) => {
              const isDragging = dragState && dragState.index === i;
              const isOver = dragState && dragState.overIndex === i && dragState.index !== i;
              return (
                <div
                  key={it.id}
                  ref={(el) => { rowRefsRef.current[i] = el; }}
                  style={{
                    ...chartRow,
                    opacity: isDragging ? 0.4 : 1,
                    borderTop: isOver && dragState && dragState.overIndex < dragState.index ? '2px solid var(--accent)' : '2px solid transparent',
                    borderBottom: isOver && dragState && dragState.overIndex > dragState.index ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <div
                    onPointerDown={(e) => onGripPointerDown(openPlaylist.id, i, e)}
                    style={{ cursor: 'grab', touchAction: 'none', color: 'rgba(240,235,229,.3)', flexShrink: 0 }}
                    title="Drag to reorder"
                  >
                    <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14"><circle cx="8" cy="6" r="1.6" /><circle cx="16" cy="6" r="1.6" /><circle cx="8" cy="12" r="1.6" /><circle cx="16" cy="12" r="1.6" /><circle cx="8" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" /></svg>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, width: 22, color: 'rgba(240,235,229,.2)', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(240,235,229,.5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.artistName}</div>
                  </div>
                  <button onClick={() => removeItem(openPlaylist.id, it.id)} style={{ ...bGhost, padding: '6px 12px', fontSize: 12 }} type="button">Remove</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
