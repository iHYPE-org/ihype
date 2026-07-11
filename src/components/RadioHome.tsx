'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FollowButton } from '@/components/FollowButton';
import { parseShowProductionPlan, sumProductionPlanDurationSecs } from '@/lib/show-composer';

type ShowStatus = 'live' | 'saved' | 'upcoming';

type Track = { id: string; title: string; artistName: string; dur: number };

interface Show {
  id: string;
  title: string;
  dj: string;
  djProfileId: string | null;
  genre: string;
  dur: number;
  color: string;
  status: ShowStatus;
  hypeCount: number;
  startsAt: string | null;
  tracks: Track[];
  userSaved?: boolean;
}

type Tab = 'on-air' | 'saved' | 'upcoming';

type ApiRadioShow = {
  id: string;
  title: string;
  status: string;
  startsAt: string | null;
  hypeCount?: number;
  headlinerProfile?: { id: string; name: string; genres?: string[] } | null;
  radioTracks?: { id: string; title: string; artistName: string | null; position: number; durationSecs: number | null }[];
  productionPlan?: unknown;
};

const PALETTE = ['#ff5029', '#22e5d4', '#b983ff', '#ff3e9a'];

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function wfBars(seedStr: string) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 233280;
  const r: number[] = [];
  let s = seed * 9301 + 49297;
  for (let i = 0; i < 44; i++) {
    s = (s * 9301 + 49297) % 233280;
    r.push(18 + Math.round((s / 233280) * 80));
  }
  return r;
}

function scheduleChip(startsAt: string): 'tonight' | 'tomorrow' | 'week' {
  const d = new Date(startsAt);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'tonight';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow';
  return 'week';
}

function scheduleTime(startsAt: string) {
  return new Date(startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function nextUpLabel(s: Show) {
  if (!s.startsAt) return s.title;
  const chip = scheduleChip(s.startsAt);
  const when = chip === 'tonight' ? 'Tonight' : chip === 'tomorrow' ? 'Tomorrow' : new Date(s.startsAt).toLocaleDateString('en-US', { weekday: 'short' });
  return `${s.title} · ${when} ${scheduleTime(s.startsAt)}`;
}

export function RadioHome() {
  const [shows, setShows] = useState<Show[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<Tab>('on-air');
  const [toast, setToast] = useState<string | null>(null);
  const [hyped, setHyped] = useState(false);
  const [hypeCounts, setHypeCounts] = useState<Record<string, number>>({});
  const [listeners, setListeners] = useState<number | null>(null);
  const [notifying, setNotifying] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Load real radio shows
  useEffect(() => {
    fetch('/api/shows?radioShows=1')
      .then(r => (r.ok ? r.json() : []))
      .then((data: ApiRadioShow[]) => {
        if (!Array.isArray(data)) { setShows([]); return; }
        const savedIds = (() => {
          try { return JSON.parse(localStorage.getItem('ihype_saved_shows') || '[]') as string[]; } catch { return []; }
        })();
        const mapped: Show[] = data.map((s, i) => {
          const tracks: Track[] = (s.radioTracks ?? []).map(t => ({
            id: t.id, title: t.title, artistName: t.artistName ?? (s.headlinerProfile?.name ?? 'iHYPE Radio'), dur: t.durationSecs ?? 0,
          }));
          const trackDur = tracks.reduce((sum, t) => sum + t.dur, 0);
          // Shows authored via the newer Radio Show Creator carry their real
          // duration in productionPlan (mediaItems/voiceOvers/ad clips) instead
          // of the legacy radioTracks table — sum that before ever falling
          // back to a fabricated default.
          const plan = parseShowProductionPlan(s.productionPlan);
          const planDur = plan ? sumProductionPlanDurationSecs(plan) : 0;
          return {
            id: s.id,
            title: s.title,
            dj: s.headlinerProfile?.name ?? 'iHYPE Radio',
            djProfileId: s.headlinerProfile?.id ?? null,
            genre: s.headlinerProfile?.genres?.[0] ?? 'Radio',
            dur: trackDur > 0 ? trackDur : planDur > 0 ? planDur : 3600,
            color: PALETTE[i % PALETTE.length],
            status: s.status === 'LIVE' ? 'live' : s.status === 'SCHEDULED' ? 'upcoming' : 'saved',
            hypeCount: s.hypeCount ?? 0,
            startsAt: s.startsAt,
            tracks,
            userSaved: savedIds.includes(s.id),
          };
        });
        setShows(mapped);
        setHypeCounts(Object.fromEntries(mapped.map(m => [m.id, m.hypeCount])));
        const live = mapped.find(m => m.status === 'live');
        const firstPlayable = mapped.find(m => m.status !== 'upcoming');
        setCurrentId((live ?? firstPlayable ?? mapped[0])?.id ?? null);
      })
      .catch(() => setShows([]));
  }, []);

  const current = useMemo(() => (shows ?? []).find(s => s.id === currentId) ?? null, [shows, currentId]);
  const anyLive = (shows ?? []).some(s => s.status === 'live');
  const upcoming = useMemo(
    () => (shows ?? []).filter(s => s.status === 'upcoming' && s.startsAt).sort((a, b) => +new Date(a.startsAt!) - +new Date(b.startsAt!)),
    [shows]
  );

  // Real listener count (RSVP-based, same source the API's own live count uses)
  useEffect(() => {
    if (!anyLive) return;
    let cancelled = false;
    const load = () =>
      fetch('/api/radio/listeners')
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (!cancelled && d && typeof d.total === 'number') setListeners(d.total); })
        .catch(() => {});
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [anyLive]);

  // Restore playback position on current show change
  useEffect(() => {
    if (!current) return;
    const saved = parseInt(localStorage.getItem(`ihype_radio_pos_${current.id}`) || '0');
    setElapsed(saved);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist playback position
  useEffect(() => {
    if (!current) return;
    localStorage.setItem(`ihype_radio_pos_${current.id}`, String(elapsed));
  }, [elapsed, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback timer
  useEffect(() => {
    if (playing && current) {
      timer.current = setInterval(() => setElapsed(e => (e >= current.dur ? 0 : e + 1)), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, current]);

  function play(show: Show) {
    if (show.status === 'upcoming') return;
    const savedPos = parseInt(localStorage.getItem(`ihype_radio_pos_${show.id}`) || '0');
    setCurrentId(show.id);
    setElapsed(savedPos);
    setPlaying(true);
  }

  function toggleSave(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setShows(ss => {
      if (!ss) return ss;
      const updated = ss.map(s => (s.id === id ? { ...s, userSaved: !s.userSaved } : s));
      const savedIds = updated.filter(s => s.userSaved).map(s => s.id);
      localStorage.setItem('ihype_saved_shows', JSON.stringify(savedIds));
      return updated;
    });
    const show = (shows ?? []).find(s => s.id === id);
    showToast(show?.userSaved ? 'Removed from saved' : '✓ Saved to library');
  }

  async function hypeShow() {
    if (!current) return;
    setHyped(true);
    setTimeout(() => setHyped(false), 800);
    try {
      const res = await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'show', targetId: current.id, positionSeconds: elapsed }),
      });
      if (res.status === 401) { showToast('Log in to hype shows'); return; }
      const data = await res.json();
      if (res.ok && typeof data.hypeCount === 'number') {
        setHypeCounts(c => ({ ...c, [current.id]: data.hypeCount }));
        if (data.action === 'unhyped') showToast('Hype removed');
      }
    } catch { /* best-effort */ }
  }

  async function toggleNotify(showId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const wasOn = !!notifying[showId];
    setNotifying(n => ({ ...n, [showId]: !wasOn }));
    try {
      const res = await fetch(`/api/shows/${showId}/rsvp`, { method: 'POST' });
      if (res.status === 401) {
        setNotifying(n => ({ ...n, [showId]: wasOn }));
        showToast('Log in to get notified');
        return;
      }
      const data = await res.json();
      if (res.ok) setNotifying(n => ({ ...n, [showId]: !!data.going }));
      else setNotifying(n => ({ ...n, [showId]: wasOn }));
    } catch {
      setNotifying(n => ({ ...n, [showId]: wasOn }));
    }
  }

  const pct = current && current.dur > 0 ? (elapsed / current.dur) * 100 : 0;
  void pct;
  const isLive = current?.status === 'live';
  const bars = current ? wfBars(current.id) : [];
  const playedCount = current ? (isLive ? bars.length : Math.round((elapsed / current.dur) * bars.length)) : 0;
  const currentHypes = current ? hypeCounts[current.id] ?? current.hypeCount : 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'on-air', label: 'On Air' },
    { id: 'saved', label: 'Saved' },
    { id: 'upcoming', label: 'Schedule' },
  ];

  const filtered = (shows ?? []).filter(s => {
    if (tab === 'on-air') return s.status === 'live' || s.status === 'saved';
    if (tab === 'saved') return s.userSaved;
    if (tab === 'upcoming') return s.status === 'upcoming';
    return true;
  });

  const djHandle = current ? `@${current.dj.toLowerCase().replace(/[\s.]+/g, '')}` : '';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 100px' }}>
      <style>{`
        @keyframes ihype-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes ihype-pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes ihype-radio-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ihype-bar-dance { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(.55); } }
        .radio-rise { animation: ihype-radio-rise .5s cubic-bezier(.22,1,.36,1) both; }
        .radio-rise-2 { animation-delay: 80ms; }
        .radio-rise-3 { animation-delay: 150ms; }
        .radio-rise-4 { animation-delay: 220ms; }
        .radio-bar-live { animation: ihype-bar-dance 1.1s ease-in-out infinite; transform-origin: bottom; }
        @media (prefers-reduced-motion: reduce) {
          .radio-rise, .radio-rise-2, .radio-rise-3, .radio-rise-4 { animation: none; }
          .radio-bar-live { animation: none; }
        }
      `}</style>

      {/* Always-on station entry point */}
      <a className="radio-rise" href="/radio/station" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,80,41,.08)', border: '1px solid rgba(255,80,41,.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)', animation: 'ihype-pulse-dot 1.4s infinite' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>The station never stops →</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-a50)', flexShrink: 0 }}>Always on</span>
        </div>
      </a>

      {/* DJ entry point into Radio Show Creator */}
      <a className="radio-rise radio-rise-2" href="/radio/studio" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
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

      {/* LOADING SKELETON */}
      {shows === null && (
        <div style={{ borderRadius: 14, padding: '24px 28px', marginBottom: 24, border: '1px solid var(--line)', background: 'rgba(255,255,255,.02)' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div className="ihype-skeleton" style={{ width: 80, height: 80, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'grid', gap: 10 }}>
              <div className="ihype-skeleton" style={{ width: 110, height: 20, borderRadius: 9999 }} />
              <div className="ihype-skeleton" style={{ width: '55%', height: 20, borderRadius: 6 }} />
              <div className="ihype-skeleton" style={{ width: '35%', height: 13, borderRadius: 5 }} />
            </div>
          </div>
        </div>
      )}

      {/* NOW PLAYING PLAYER */}
      {current && (
      <div className="radio-rise radio-rise-3" style={{
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
                  Live{listeners !== null ? ` · ${listeners} listening` : ''}
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, background: 'rgba(34,229,212,.08)', border: '1px solid rgba(34,229,212,.2)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--venue)', textTransform: 'uppercase' }}>
                  ▶ Auto-saved · relisten anytime
                </div>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{current.title}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-a65)' }}>{current.dj} · {current.genre}</div>
          </div>
        </div>

        {/* Waveform scrubber (44 bars, click to seek) */}
        <div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, cursor: isLive ? 'default' : 'pointer', padding: '0 2px', marginBottom: 6 }}
            onClick={e => {
              if (isLive || !current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setElapsed(Math.round(fraction * current.dur));
            }}
          >
            {bars.map((h, i) => {
              const isActiveBar = !isLive && i === playedCount - 1;
              const bg = isActiveBar ? '#fff' : i < playedCount ? 'var(--accent)' : 'rgba(255,255,255,.11)';
              const opacity = isActiveBar ? 1 : i < playedCount ? 0.9 : 1;
              const danceClass = isLive && playing ? 'radio-bar-live' : undefined;
              return (
                <div className={danceClass} key={i} style={{
                  flex: 1, borderRadius: '2px 2px 0 0', minWidth: 2,
                  height: `${h}%`, background: bg, opacity, transition: 'height 300ms ease',
                  animationDelay: danceClass ? `${(i % 8) * 90}ms` : undefined,
                }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-a50)' }}>
            <span>{isLive ? '● LIVE' : fmt(elapsed)}</span>
            <span>{isLive ? (listeners !== null ? `${listeners} listening` : 'On air') : fmt(current.dur)}</span>
          </div>
        </div>

        {/* Transport controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
          <button aria-label="Back 15 seconds" onClick={() => setElapsed(Math.max(0, elapsed - 15))} style={ctrlStyle}>⏮</button>
          <button aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(p => !p)} style={{ ...ctrlStyle, width: 50, height: 50, fontSize: 22, background: 'var(--accent)' }}>
            {playing ? '⏸' : '▶'}
          </button>
          <button aria-label="Forward 15 seconds" onClick={() => setElapsed(Math.min(current.dur, elapsed + 15))} style={ctrlStyle}>⏭</button>
        </div>

        {/* Hype mechanic */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <button
            onClick={hypeShow}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44,
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-a32)', letterSpacing: '.08em' }}>● at {fmt(elapsed)}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,80,41,.55)', marginLeft: 'auto' }}>{currentHypes.toLocaleString()} hypes this show</span>
        </div>
      </div>
      )}

      {/* DJ IDENTITY BLOCK */}
      {current && (
      <div className="radio-rise radio-rise-4" style={{
        background: 'rgba(185,131,255,.06)', border: '1px solid rgba(185,131,255,.16)',
        borderRadius: 12, padding: '18px 22px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '2px solid rgba(185,131,255,.3)', background: `linear-gradient(135deg,${current.color},#b983ff)` }}>🎛️</div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 1 }}>{current.dj}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-a35)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 5 }}>{djHandle}</div>
          <div style={{ fontSize: 11, color: 'rgba(185,131,255,.65)' }}>Earns promoter cuts on every ticket sold — locked in our charter.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {current.djProfileId && (
            <div style={{ width: 120 }}>
              <FollowButton profileId={current.djProfileId} />
            </div>
          )}
          <button style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: 'var(--ink-a60)', transition: 'all 150ms' }}>
            Tip
          </button>
        </div>
      </div>
      )}

      {/* UP-NEXT CRATE (live shows only) */}
      {current && isLive && current.tracks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.16em', color: 'var(--ink-a32)' }}>Up Next in Crate</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {current.tracks.map((t, i) => {
              const isNext = i === 0;
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', background: isNext ? 'rgba(255,80,41,.05)' : undefined, border: isNext ? '1px solid rgba(255,80,41,.1)' : '1px solid transparent', transition: 'background 120ms' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-a22)', width: 16, flexShrink: 0, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isNext
                      ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'ihype-pulse 1.4s ease-in-out infinite' }} />
                      : i + 1
                    }
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: 6, flexShrink: 0, background: `linear-gradient(135deg,${PALETTE[i % PALETTE.length]},#b983ff)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎵</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-a50)' }}>{t.artistName}</div>
                  </div>
                  {t.dur > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-a28)', marginLeft: 'auto', flexShrink: 0 }}>{fmt(t.dur)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--line)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--ink)' : 'var(--ink-a50)',
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
          {upcoming.length === 0 && shows !== null && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-a50)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
              <p>Nothing scheduled yet — DJs post new shows all the time.</p>
            </div>
          )}
          {upcoming.map(s => {
            const chip = s.startsAt ? scheduleChip(s.startsAt) : 'week';
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderRadius: 10, border: chip === 'tonight' ? '1px solid rgba(255,80,41,.22)' : '1px solid var(--line)',
                background: chip === 'tonight' ? 'rgba(255,80,41,.04)' : 'var(--bg2)',
                marginBottom: 8, cursor: 'pointer', transition: 'background 150ms',
              }}>
                <span style={{
                  padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.14em', flexShrink: 0,
                  background: chip === 'tonight' ? 'rgba(255,80,41,.14)' : chip === 'tomorrow' ? 'rgba(185,131,255,.12)' : 'rgba(255,255,255,.05)',
                  color: chip === 'tonight' ? 'var(--accent)' : chip === 'tomorrow' ? '#b983ff' : 'var(--ink-a38)',
                }}>
                  {chip === 'tonight' ? 'Tonight' : chip === 'tomorrow' ? 'Tomorrow' : 'This Week'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-a42)' }}>{s.dj} · {s.genre}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-a32)', flexShrink: 0 }}>{s.startsAt ? scheduleTime(s.startsAt) : ''}</div>
                <button
                  onClick={e => toggleNotify(s.id, e)}
                  style={{
                    minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '5px 11px', borderRadius: 6, fontSize: 11, flexShrink: 0,
                    border: notifying[s.id] ? '1px solid rgba(185,131,255,.45)' : '1px solid rgba(255,255,255,.1)',
                    background: notifying[s.id] ? 'rgba(185,131,255,.1)' : 'transparent',
                    color: notifying[s.id] ? '#b983ff' : 'var(--ink-a55)',
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                >
                  {notifying[s.id] ? '🔔 On' : 'Notify me'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ON-AIR OFFLINE STATE */}
      {tab === 'on-air' && shows !== null && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px', border: '1px solid rgba(255,255,255,.08)' }}>📻</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>No show on air right now</div>
          <p style={{ fontSize: 13, color: 'var(--ink-a50)', marginBottom: 20 }}>DJs go live on audio — no video. Check back soon or set a reminder.</p>
          {upcoming[0] && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 9999, background: 'rgba(185,131,255,.09)', border: '1px solid rgba(185,131,255,.22)', fontSize: 13, color: '#b983ff', marginBottom: 18 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b983ff', display: 'inline-block' }} />
              Next: {nextUpLabel(upcoming[0])}
            </div>
          )}
        </div>
      )}

      {tab === 'saved' && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-a50)' }}>
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
                border: `1px solid ${current?.id === s.id ? 'rgba(255,80,41,.35)' : 'var(--line)'}`,
                borderRadius: 10, padding: '18px 20px',
                background: current?.id === s.id ? 'rgba(255,80,41,.06)' : 'var(--bg2)',
                opacity: s.status === 'upcoming' ? 0.5 : 1,
                cursor: s.status === 'upcoming' ? 'default' : 'pointer',
                transition: 'all 150ms',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 8, marginBottom: 12, background: `linear-gradient(135deg,${s.color},#b983ff)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎵</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-a55)', marginBottom: 8 }}>{s.dj} · {s.genre}</div>
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
                  <span style={{ padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', background: 'var(--line)', color: 'var(--ink-a55)' }}>
                    Starts {s.startsAt ? nextUpLabel(s).split('· ')[1] ?? '' : 'soon'}
                  </span>
                )}
                {s.status !== 'upcoming' && (
                  <button
                    onClick={e => toggleSave(s.id, e)}
                    title={s.userSaved ? 'Remove from saved' : 'Save for later'}
                    style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: s.userSaved ? 'var(--venue)' : 'var(--ink-a50)', fontSize: 16, padding: 4, transition: 'color 150ms' }}
                  >
                    {s.userSaved ? '🔖' : '🏷️'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: 32, fontSize: 11, color: 'var(--ink-a30)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.12em' }}>
        iHYPE Radio · Audio only · No video · Saved shows available anytime
      </p>
    </div>
  );
}

const ctrlStyle: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%', border: 'none',
  background: 'rgba(255,255,255,.08)', color: 'var(--ink)',
  cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 150ms',
};
