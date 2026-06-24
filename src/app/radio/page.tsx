'use client';

import type { Metadata } from 'next';
import { useEffect, useRef, useState } from 'react';

// Static mock shows — wire to GET /api/radio/shows when available
const INITIAL_SHOWS = [
  { id: 1, title: 'Late Night Frequencies', dj: 'DJ Nyla Park', genre: 'Deep House',  dur: 3600, color: '#ff5029', status: 'live',     listeners: 247 },
  { id: 2, title: 'Sunrise Sessions',       dj: 'Alex Rivera',  genre: 'Electronic', dur: 2700, color: '#22e5d4', status: 'saved',    savedAt: 'Yesterday 6AM' },
  { id: 3, title: 'Indie Underground',      dj: 'Luna Park',    genre: 'Indie',      dur: 3000, color: '#b983ff', status: 'saved',    savedAt: 'Fri 9PM' },
  { id: 4, title: 'Weekend Warmup',         dj: 'The Scene',    genre: 'Electronic', dur: 3600, color: '#ff3e9a', status: 'upcoming', scheduledAt: 'Sat 4PM' },
  { id: 5, title: 'Deep Cuts Vol.2',        dj: 'DJ Nyla Park', genre: 'Tech House', dur: 2400, color: '#ff5029', status: 'saved',    savedAt: 'Last week' },
] as const;

type ShowStatus = 'live' | 'saved' | 'upcoming';
interface Show {
  id: number;
  title: string;
  dj: string;
  genre: string;
  dur: number;
  color: string;
  status: ShowStatus;
  listeners?: number;
  savedAt?: string;
  scheduledAt?: string;
  userSaved?: boolean;
}

type Tab = 'on-air' | 'saved' | 'upcoming';

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function RadioPage() {
  const [shows, setShows] = useState<Show[]>(() => {
    if (typeof window === 'undefined') return [...INITIAL_SHOWS];
    try {
      const saved = JSON.parse(localStorage.getItem('ihype_saved_shows') || '[]') as number[];
      return INITIAL_SHOWS.map(s => ({ ...s, userSaved: saved.includes(s.id) }));
    } catch { return [...INITIAL_SHOWS]; }
  });

  const [current, setCurrent] = useState<Show>(INITIAL_SHOWS[0]);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<Tab>('on-air');
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(`ihype_radio_pos_${current.id}`) || '0');
    setElapsed(saved);
  }, [current.id]);

  useEffect(() => {
    localStorage.setItem(`ihype_radio_pos_${current.id}`, String(elapsed));
  }, [elapsed, current.id]);

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(() => setElapsed(e => e >= current.dur ? 0 : e + 1), 1000);
    } else {
      if (timer.current) clearInterval(timer.current);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, current]);

  function play(show: Show) {
    if (show.status === 'upcoming') return;
    const savedPos = parseInt(localStorage.getItem(`ihype_radio_pos_${show.id}`) || '0');
    setCurrent(show);
    setElapsed(savedPos);
    setPlaying(true);
  }

  function toggleSave(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setShows(ss => {
      const updated = ss.map(s => s.id === id ? { ...s, userSaved: !s.userSaved } : s);
      const savedIds = updated.filter(s => s.userSaved).map(s => s.id);
      localStorage.setItem('ihype_saved_shows', JSON.stringify(savedIds));
      return updated;
    });
    const show = shows.find(s => s.id === id);
    setToast(show?.userSaved ? 'Removed from saved' : '✓ Saved to library');
    setTimeout(() => setToast(null), 2500);
  }

  const pct = current.dur > 0 ? (elapsed / current.dur) * 100 : 0;
  const isLive = current.status === 'live';

  const TABS: { id: Tab; label: string }[] = [
    { id: 'on-air',   label: 'On Air' },
    { id: 'saved',    label: 'Saved' },
    { id: 'upcoming', label: 'Schedule' },
  ];

  const filtered = shows.filter(s => {
    if (tab === 'on-air')   return s.status === 'live' || s.status === 'saved';
    if (tab === 'saved')    return s.userSaved;
    if (tab === 'upcoming') return s.status === 'upcoming';
    return true;
  });

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 100px' }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, background: 'var(--bg-3, #1a1612)', border: '1px solid var(--line-2)',
          borderRadius: 8, padding: '10px 18px', fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink)', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* NOW PLAYING */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,80,41,.12),rgba(185,131,255,.08))',
        border: '1px solid rgba(255,80,41,.2)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 40,
        display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg,${current.color},#b983ff)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
        }}>🎛️</div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isLive ? (
              <>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'ihype-pulse 1.4s ease-in-out infinite' }} />
                <span style={{ color: 'var(--accent)' }}>Live · Audio Only</span>
              </>
            ) : (
              <span style={{ color: 'rgba(240,235,229,.5)' }}>Saved Show</span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{current.title}</div>
          <div style={{ fontSize: 13, color: 'rgba(240,235,229,.65)', marginBottom: 14 }}>
            {current.dj} · {current.genre}{isLive && current.listeners ? ` · ${current.listeners} listening` : ''}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setElapsed(Math.max(0, elapsed - 15))} style={ctrlStyle}>⏮</button>
            <button onClick={() => setPlaying(p => !p)} style={{ ...ctrlStyle, width: 50, height: 50, fontSize: 22, background: 'var(--accent)' }}>
              {playing ? '⏸' : '▶'}
            </button>
            <button onClick={() => setElapsed(Math.min(current.dur, elapsed + 15))} style={ctrlStyle}>⏭</button>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ height: 4, background: 'rgba(255,255,255,.1)', borderRadius: 2, margin: '6px 0', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: `${isLive ? 100 : pct}%`, opacity: isLive ? 0.6 : 1, transition: 'width 1s linear' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,.4)' }}>
                <span>{isLive ? '● LIVE' : fmt(elapsed)}</span>
                <span>{isLive ? '' : fmt(current.dur)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--line)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--ink)' : 'var(--ink-2)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem',
            cursor: 'pointer', transition: 'all 150ms', marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SHOWS GRID */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(240,235,229,.4)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📻</div>
          <p>{tab === 'saved' ? 'No saved shows yet — bookmark any show to find it here.' : 'Nothing here yet.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => play(s)}
              style={{
                border: `1px solid ${current.id === s.id ? 'rgba(255,80,41,.35)' : 'rgba(255,255,255,.06)'}`,
                borderRadius: 10, padding: '18px 20px',
                background: current.id === s.id ? 'rgba(255,80,41,.06)' : 'var(--bg-2, #100d09)',
                opacity: s.status === 'upcoming' ? 0.5 : 1,
                cursor: s.status === 'upcoming' ? 'default' : 'pointer',
                transition: 'all 150ms',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 8, marginBottom: 12, background: `linear-gradient(135deg,${s.color},#b983ff)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎵</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,.55)', marginBottom: 8 }}>{s.dj} · {s.genre}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {s.status === 'live' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', background: 'rgba(255,80,41,.15)', color: 'var(--accent)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                    Live
                  </span>
                )}
                {s.status === 'saved' && (
                  <span style={{ padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', background: 'rgba(34,229,212,.12)', color: 'var(--role-venue)' }}>
                    ▶ {fmt(s.dur)}
                  </span>
                )}
                {s.status === 'upcoming' && (
                  <span style={{ padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', background: 'rgba(255,255,255,.06)', color: 'rgba(240,235,229,.45)' }}>
                    Starts {s.scheduledAt}
                  </span>
                )}
                {s.status !== 'upcoming' && (
                  <button
                    onClick={e => toggleSave(s.id, e)}
                    title={s.userSaved ? 'Remove from saved' : 'Save for later'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.userSaved ? 'var(--role-venue)' : 'rgba(240,235,229,.4)', fontSize: 16, padding: 4, transition: 'color 150ms' }}
                  >
                    {s.userSaved ? '🔖' : '🏷️'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: 32, fontSize: 11, color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.12em' }}>
        iHYPE Radio · Audio only · No video · Saved shows available anytime
      </p>

      <style>{`
        @keyframes ihype-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
}

const ctrlStyle: React.CSSProperties = {
  width: 42, height: 42, borderRadius: '50%', border: 'none',
  background: 'rgba(255,255,255,.08)', color: 'var(--ink)',
  cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 150ms',
};
