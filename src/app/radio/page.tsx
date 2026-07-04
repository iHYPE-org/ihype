'use client';

import { useEffect, useRef, useState } from 'react';

// Static mock shows — wire to GET /api/radio/shows when available
const INITIAL_SHOWS = [
  { id: 1, title: 'Late Night Frequencies', dj: 'DJ Nyla Park', genre: 'Deep House',  dur: 3600, color: '#ff5029', status: 'live',     listeners: 247 },
  { id: 2, title: 'Sunrise Sessions',       dj: 'Alex Rivera',  genre: 'Electronic', dur: 2700, color: '#22e5d4', status: 'saved',    savedAt: 'Yesterday 6AM' },
  { id: 3, title: 'Indie Underground',      dj: 'Luna Park',    genre: 'Indie',      dur: 3000, color: '#b983ff', status: 'saved',    savedAt: 'Fri 9PM' },
  { id: 4, title: 'Weekend Warmup',         dj: 'The Scene',    genre: 'Electronic', dur: 3600, color: '#ff3e9a', status: 'upcoming', scheduledAt: 'Sat 4PM' },
  { id: 5, title: 'Deep Cuts Vol.2',        dj: 'DJ Nyla Park', genre: 'Tech House', dur: 2400, color: '#ff5029', status: 'saved',    savedAt: 'Last week' },
] as const;

const CRATE = [
  { id: 'c1', title: 'Silky Moves',    artist: 'DJ Nyla Park', dur: 420, color: '#ff5029', next: true  },
  { id: 'c2', title: 'Frequency Nine', artist: 'DJ Nyla Park', dur: 380, color: '#b983ff', next: false },
  { id: 'c3', title: 'Pressure Drop',  artist: 'DJ Nyla Park', dur: 510, color: '#22e5d4', next: false },
  { id: 'c4', title: 'Late Hours',     artist: 'DJ Nyla Park', dur: 360, color: '#ff3e9a', next: false },
];

const SCHEDULE = [
  { id: 's1', title: 'Late Night Frequencies', dj: 'DJ Nyla Park', genre: 'Deep House',  time: 'Tonight · 11:00 PM',  chip: 'tonight'  },
  { id: 's2', title: 'Sunrise Sessions',        dj: 'Alex Rivera',  genre: 'Electronic', time: 'Tomorrow · 6:00 AM', chip: 'tomorrow' },
  { id: 's3', title: 'Weekend Warmup',          dj: 'The Scene',    genre: 'Electronic', time: 'Sat · 4:00 PM',      chip: 'week'     },
  { id: 's4', title: 'Indie Underground',       dj: 'Luna Park',    genre: 'Indie',      time: 'Sat · 9:00 PM',      chip: 'week'     },
  { id: 's5', title: 'Deep Cuts Vol.3',         dj: 'DJ Nyla Park', genre: 'Tech House', time: 'Sun · 2:00 PM',      chip: 'week'     },
];

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

function wfBars(seed: number) {
  const r: number[] = [];
  let s = seed * 9301 + 49297;
  for (let i = 0; i < 44; i++) {
    s = (s * 9301 + 49297) % 233280;
    r.push(18 + Math.round((s / 233280) * 80));
  }
  return r;
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
  const [hyped, setHyped] = useState(false);
  const [hypeCount, setHypeCount] = useState(247);
  const [following, setFollowing] = useState(false);
  const [notifying, setNotifying] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load real shows from API
  useEffect(() => {
    fetch('/api/shows?radioShows=1')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) return;
        const savedIds = (() => {
          try { return JSON.parse(localStorage.getItem('ihype_saved_shows') || '[]') as number[]; } catch { return []; }
        })();
        const mapped: Show[] = data.map((s: { id: string; title: string; status: string; startsAt: string | null; headlinerProfile?: { name: string } | null }, i: number) => ({
          id: i + 1,
          title: s.title,
          dj: s.headlinerProfile?.name ?? 'iHYPE Radio',
          genre: 'Electronic',
          dur: 3600,
          color: ['#ff5029', '#22e5d4', '#b983ff', '#ff3e9a'][i % 4],
          status: s.status === 'LIVE' ? 'live' as const : s.status === 'SCHEDULED' ? 'upcoming' as const : 'saved' as const,
          listeners: s.status === 'LIVE' ? Math.floor(Math.random() * 400 + 50) : undefined,
          scheduledAt: s.status === 'SCHEDULED' && s.startsAt ? new Date(s.startsAt).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : undefined,
          savedAt: s.status === 'ENDED' ? new Date(s.startsAt ?? Date.now()).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' }) : undefined,
          userSaved: savedIds.includes(i + 1),
        }));
        setShows(mapped);
        setCurrent(mapped[0]);
      })
      .catch(() => {});
  }, []);

  // Restore playback position on current show change
  useEffect(() => {
    const saved = parseInt(localStorage.getItem(`ihype_radio_pos_${current.id}`) || '0');
    setElapsed(saved);
  }, [current.id]);

  // Persist playback position
  useEffect(() => {
    localStorage.setItem(`ihype_radio_pos_${current.id}`, String(elapsed));
  }, [elapsed, current.id]);

  // Playback timer
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
  const bars = wfBars(current.id);
  const playedCount = isLive ? bars.length : Math.round((elapsed / current.dur) * bars.length);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'on-air',   label: 'On Air'   },
    { id: 'saved',    label: 'Saved'    },
    { id: 'upcoming', label: 'Schedule' },
  ];

  const filtered = shows.filter(s => {
    if (tab === 'on-air')   return s.status === 'live' || s.status === 'saved';
    if (tab === 'saved')    return s.userSaved;
    if (tab === 'upcoming') return s.status === 'upcoming';
    return true;
  });

  const djHandle = `@${current.dj.toLowerCase().replace(/[\s.]+/g, '')}`;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 100px' }}>
      <style>{`
        @keyframes ihype-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes ihype-pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {/* Always-on station entry point */}
      <a href="/radio/station" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,80,41,.08)', border: '1px solid rgba(255,80,41,.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)', animation: 'ihype-pulse-dot 1.4s infinite' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>The station never stops →</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', flexShrink: 0 }}>Always on</span>
        </div>
      </a>

      {/* DJ entry point into Radio Show Creator */}
      <a href="/radio/studio" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderRadius: 12, background: 'rgba(185,131,255,.06)', border: '1px solid rgba(185,131,255,.2)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>DJ? Build a show →</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#b983ff', flexShrink: 0 }}>Radio Studio</span>
        </div>
      </a>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, background: 'var(--bg3)', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 8, padding: '10px 18px', fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink)', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* NOW PLAYING PLAYER */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,80,41,.12),rgba(185,131,255,.08))',
        border: '1px solid rgba(255,80,41,.2)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 24,
        flexDirection: 'column', alignItems: 'stretch', display: 'flex', gap: 0,
      }}>
        {/* Top row: art + meta */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg,${current.color},#b983ff)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
          }}>🎛️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 8 }}>
              {isLive ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, background: 'rgba(255,80,41,.12)', border: '1px solid rgba(255,80,41,.28)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--accent)', textTransform: 'uppercase' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'ihype-pulse 1.4s ease-in-out infinite' }} />
                  Live · {current.listeners} listening
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, background: 'rgba(34,229,212,.08)', border: '1px solid rgba(34,229,212,.2)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--venue)', textTransform: 'uppercase' }}>
                  ▶ Auto-saved · relisten anytime
                </div>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{current.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(240,235,229,.65)' }}>{current.dj} · {current.genre}</div>
          </div>
        </div>

        {/* Waveform scrubber (44 bars, click to seek) */}
        <div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, cursor: isLive ? 'default' : 'pointer', padding: '0 2px', marginBottom: 6 }}
            onClick={e => {
              if (isLive) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setElapsed(Math.round(fraction * current.dur));
            }}
          >
            {bars.map((h, i) => {
              const isActiveBar = !isLive && i === playedCount - 1;
              const bg = isActiveBar ? '#fff' : i < playedCount ? 'var(--accent)' : 'rgba(255,255,255,.11)';
              const opacity = isActiveBar ? 1 : i < playedCount ? 0.9 : 1;
              return (
                <div key={i} style={{
                  flex: 1, borderRadius: '2px 2px 0 0', minWidth: 2,
                  height: `${h}%`, background: bg, opacity, transition: 'height 300ms ease',
                }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,.5)' }}>
            <span>{isLive ? '● LIVE' : fmt(elapsed)}</span>
            <span>{isLive ? `${current.listeners} listening` : fmt(current.dur)}</span>
          </div>
        </div>

        {/* Transport controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
          <button onClick={() => setElapsed(Math.max(0, elapsed - 15))} style={ctrlStyle}>⏮</button>
          <button onClick={() => setPlaying(p => !p)} style={{ ...ctrlStyle, width: 50, height: 50, fontSize: 22, background: 'var(--accent)' }}>
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={() => setElapsed(Math.min(current.dur, elapsed + 15))} style={ctrlStyle}>⏭</button>
        </div>

        {/* Hype mechanic */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setHyped(true);
              setHypeCount(c => c + 1);
              setTimeout(() => setHyped(false), 800);
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 9999,
              border: `1px solid ${hyped ? 'rgba(255,80,41,.65)' : 'rgba(255,80,41,.4)'}`,
              background: hyped ? 'rgba(255,80,41,.26)' : 'rgba(255,80,41,.1)',
              color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10,
              letterSpacing: '.1em', cursor: 'pointer', textTransform: 'uppercase',
              transition: 'all 120ms',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            {hyped ? 'Hyped!' : 'Hype this'}
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,.32)', letterSpacing: '.08em' }}>● at {fmt(elapsed)}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,80,41,.55)', marginLeft: 'auto' }}>{hypeCount.toLocaleString()} hypes this show</span>
        </div>
      </div>

      {/* DJ IDENTITY BLOCK */}
      <div style={{
        background: 'rgba(185,131,255,.06)', border: '1px solid rgba(185,131,255,.16)',
        borderRadius: 12, padding: '18px 22px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '2px solid rgba(185,131,255,.3)', background: `linear-gradient(135deg,${current.color},#b983ff)` }}>🎛️</div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 1 }}>{current.dj}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(240,235,229,.35)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 5 }}>{djHandle}</div>
          <div style={{ fontSize: 11, color: 'rgba(185,131,255,.65)' }}>Earns promoter cuts on every ticket sold — locked in our charter.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setFollowing(f => !f)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(185,131,255,.45)', background: following ? 'rgba(185,131,255,.22)' : 'rgba(185,131,255,.12)', color: '#b983ff', transition: 'all 150ms' }}
          >
            {following ? '✓ Following' : 'Follow'}
          </button>
          <button style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: 'rgba(240,235,229,.6)', transition: 'all 150ms' }}>
            Tip
          </button>
        </div>
      </div>

      {/* UP-NEXT CRATE (live shows only) */}
      {isLive && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.16em', color: 'rgba(240,235,229,.32)' }}>Up Next in Crate</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {CRATE.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', background: t.next ? 'rgba(255,80,41,.05)' : undefined, border: t.next ? '1px solid rgba(255,80,41,.1)' : '1px solid transparent', transition: 'background 120ms' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,.22)', width: 16, flexShrink: 0, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.next
                    ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'ihype-pulse 1.4s ease-in-out infinite' }} />
                    : i + 1
                  }
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 6, flexShrink: 0, background: `linear-gradient(135deg,${t.color},#b983ff)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎵</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(240,235,229,.5)' }}>{t.artist}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,.28)', marginLeft: 'auto', flexShrink: 0 }}>{fmt(t.dur)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--line)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--ink)' : 'rgba(240,235,229,.5)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem',
            cursor: 'pointer', transition: 'all 150ms', marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SCHEDULE RAIL (upcoming tab) */}
      {tab === 'upcoming' && (
        <div>
          {SCHEDULE.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderRadius: 10, border: s.chip === 'tonight' ? '1px solid rgba(255,80,41,.22)' : '1px solid rgba(255,255,255,.06)',
              background: s.chip === 'tonight' ? 'rgba(255,80,41,.04)' : 'var(--bg2)',
              marginBottom: 8, cursor: 'pointer', transition: 'background 150ms',
            }}>
              <span style={{
                padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.14em', flexShrink: 0,
                background: s.chip === 'tonight' ? 'rgba(255,80,41,.14)' : s.chip === 'tomorrow' ? 'rgba(185,131,255,.12)' : 'rgba(255,255,255,.05)',
                color: s.chip === 'tonight' ? 'var(--accent)' : s.chip === 'tomorrow' ? '#b983ff' : 'rgba(240,235,229,.38)',
              }}>
                {s.chip === 'tonight' ? 'Tonight' : s.chip === 'tomorrow' ? 'Tomorrow' : 'This Week'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(240,235,229,.42)' }}>{s.dj} · {s.genre}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(240,235,229,.32)', flexShrink: 0 }}>{s.time.split(' · ')[1]}</div>
              <button
                onClick={e => { e.stopPropagation(); setNotifying(n => ({ ...n, [s.id]: !n[s.id] })); }}
                style={{
                  padding: '5px 11px', borderRadius: 6, fontSize: 11, flexShrink: 0,
                  border: notifying[s.id] ? '1px solid rgba(185,131,255,.45)' : '1px solid rgba(255,255,255,.1)',
                  background: notifying[s.id] ? 'rgba(185,131,255,.1)' : 'transparent',
                  color: notifying[s.id] ? '#b983ff' : 'rgba(240,235,229,.55)',
                  cursor: 'pointer', transition: 'all 150ms',
                }}
              >
                {notifying[s.id] ? '🔔 On' : 'Notify me'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ON-AIR OFFLINE STATE */}
      {tab === 'on-air' && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px', border: '1px solid rgba(255,255,255,.08)' }}>📻</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>No show on air right now</div>
          <p style={{ fontSize: 13, color: 'rgba(240,235,229,.5)', marginBottom: 20 }}>DJs go live on audio — no video. Check back soon or set a reminder.</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 9999, background: 'rgba(185,131,255,.09)', border: '1px solid rgba(185,131,255,.22)', fontSize: 13, color: '#b983ff', marginBottom: 18 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b983ff', display: 'inline-block' }} />
            Next: Late Night Frequencies · Tonight 11 PM
          </div>
        </div>
      )}

      {tab === 'saved' && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(240,235,229,.5)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔖</div>
          <p>No saved shows yet — tap the bookmark on any show.</p>
        </div>
      )}

      {/* SHOWS GRID (on-air + saved tabs) */}
      {tab !== 'upcoming' && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => play(s)}
              style={{
                border: `1px solid ${current.id === s.id ? 'rgba(255,80,41,.35)' : 'rgba(255,255,255,.06)'}`,
                borderRadius: 10, padding: '18px 20px',
                background: current.id === s.id ? 'rgba(255,80,41,.06)' : 'var(--bg2)',
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
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'ihype-pulse 1.4s infinite' }} />
                    Live
                  </span>
                )}
                {s.status === 'saved' && (
                  <span style={{ padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', background: 'rgba(34,229,212,.12)', color: 'var(--venue)' }}>
                    ▶ {fmt(s.dur)}
                  </span>
                )}
                {s.status === 'upcoming' && (
                  <span style={{ padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', background: 'rgba(255,255,255,.06)', color: 'rgba(240,235,229,.55)' }}>
                    Starts {s.scheduledAt}
                  </span>
                )}
                {s.status !== 'upcoming' && (
                  <button
                    onClick={e => toggleSave(s.id, e)}
                    title={s.userSaved ? 'Remove from saved' : 'Save for later'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.userSaved ? 'var(--venue)' : 'rgba(240,235,229,.5)', fontSize: 16, padding: 4, transition: 'color 150ms' }}
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
    </div>
  );
}

const ctrlStyle: React.CSSProperties = {
  width: 42, height: 42, borderRadius: '50%', border: 'none',
  background: 'rgba(255,255,255,.08)', color: 'var(--ink)',
  cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 150ms',
};
