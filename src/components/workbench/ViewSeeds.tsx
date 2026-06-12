'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { IcPlay, IcPause } from './icons';

// XP per action
const XP = { save: 10, hype: 5, skip: 1 } as const;

type SeedAction = 'save' | 'skip' | 'hype';

type SeedTrack = {
  id: string;
  title: string;
  artistName: string;
  duration?: string;
  durationSec?: number;
  hypeCount: number;
  color: string;
  album: string;
  mediaUrl: string;
  city?: string;
  profileSlug?: string;
  reason?: string;
};

/** Deterministic waveform from a string ID so each card looks distinct */
function waveformFromId(id: string): number[] {
  const bars = 28;
  return Array.from({ length: bars }, (_, i) => {
    let h = 0;
    for (let j = 0; j < id.length; j++) h = (h * 31 + id.charCodeAt(j)) >>> 0;
    h = (h ^ (i * 2654435761)) >>> 0;
    return 20 + (h % 80); // 20–100%
  });
}

/** Generate a mesh of color stops for pseudo-album-art */
function meshFromColor(color: string): string {
  return [
    `radial-gradient(ellipse 80% 60% at 20% 20%, ${color}cc 0%, transparent 65%)`,
    `radial-gradient(ellipse 60% 80% at 80% 80%, ${color}99 0%, transparent 65%)`,
    `radial-gradient(ellipse 50% 50% at 50% 50%, #ff3e9a44 0%, transparent 70%)`,
    'linear-gradient(135deg, #0d0b08 0%, #1a1209 100%)',
  ].join(', ');
}

/** Animated waveform bars */
function WaveformBars({ heights, playing }: { heights: number[]; playing: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, width: '100%' }}>
      {heights.map((h, i) => (
        <i
          key={i}
          style={{
            flex: 1,
            borderRadius: 99,
            display: 'block',
            height: `${h}%`,
            background: playing ? 'rgba(34,229,212,.9)' : 'rgba(255,255,255,.45)',
            transformOrigin: 'bottom',
            animation: playing ? `waveBar${(i % 5) + 1} ${0.6 + (i % 7) * 0.07}s ease-in-out infinite alternate` : 'none',
            transition: 'background .3s',
          }}
        />
      ))}
    </div>
  );
}

/** Frosted action pill button */
function ActionBtn({
  label, icon, color, size = 56, onClick, active, title,
}: {
  label: string; icon: React.ReactNode; color: string; size?: number;
  onClick: () => void; active?: boolean; title?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: active || hov ? `${color}22` : 'var(--bg-2)',
        border: `1.5px solid ${active || hov ? color : `${color}55`}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', gap: 3, transition: 'all .18s ease',
        boxShadow: active || hov ? `0 0 14px ${color}44` : 'none',
        color,
      }}
    >
      {icon}
      <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .7 }}>{label}</span>
    </button>
  );
}

/** Animated number that counts up when value changes */
function AnimCount({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    const diff = value - prev.current;
    const steps = Math.min(Math.abs(diff), 8);
    let step = 0;
    const iv = setInterval(() => {
      step++;
      setDisplay(Math.round(prev.current + diff * (step / steps)));
      if (step >= steps) { clearInterval(iv); prev.current = value; }
    }, 40);
    return () => clearInterval(iv);
  }, [value]);
  return <span style={{ color, fontWeight: 700 }}>{display > 0 ? (display < 10 && value > 0 ? `+${display}` : display) : '—'}</span>;
}

/** Radial progress arc for daily quest */
function RadialProgress({ value, max, color }: { value: number; max: number; color: string }) {
  const r = 22, cx = 28, cy = 28, stroke = 4;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const dash = circ * pct;
  return (
    <svg width={56} height={56} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray .5s ease' }}
      />
      <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize={12} fontFamily="var(--f-m)" fontWeight={700}>{value}/{max}</text>
    </svg>
  );
}

export function ViewSeeds({
  data,
  seedPlaying,
  setSeedPlaying,
  onSave,
}: {
  data: WorkbenchData;
  seedPlaying: boolean;
  setSeedPlaying: (v: boolean) => void;
  onSave?: (idx: number) => void;
}) {
  // ── Deck state ────────────────────────────────────────────────
  const [deck, setDeck] = useState<SeedTrack[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [deckExhausted, setDeckExhausted] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('ihype-seeds-genre-filter') ?? '[]'); } catch { return []; }
  });
  const [showGenrePicker, setShowGenrePicker] = useState(false);

  const [deckIdx, setDeckIdx] = useState(0);

  // ── Session stats ─────────────────────────────────────────────
  const [sessionStats, setSessionStats] = useState({ saved: 0, skipped: 0, hyped: 0, xp: 0 });
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());

  // ── Swipe hint (dismissed after first interaction) ────────────
  const [showHint, setShowHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hintWobble, setHintWobble] = useState(false);

  // ── Saved seeds history ───────────────────────────────────────
  type HistorySeed = { id: string; title: string; artistName: string; action: string };
  const [seedHistory, setSeedHistory] = useState<HistorySeed[]>([]);
  useEffect(() => {
    fetch('/api/discover/history')
      .then(r => r.ok ? r.json() : null)
      .then((d: { seeds?: HistorySeed[] } | null) => { if (d?.seeds?.length) setSeedHistory(d.seeds); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Battle mode ───────────────────────────────────────────────
  type BattleTrack = { id: string; title: string; artistName: string; hypeCount: number; color: string };
  const [battleOpen, setBattleOpen] = useState(false);
  const [battle, setBattle] = useState<{ a: BattleTrack; b: BattleTrack; endsAt: string } | null>(null);
  const [voted, setVoted] = useState<'a' | 'b' | null>(null);
  const [loadingBattle, setLoadingBattle] = useState(false);
  const [voteBounce, setVoteBounce] = useState<'a' | 'b' | null>(null);

  const openBattle = async () => {
    setBattleOpen(true);
    setVoted(null);
    setBattle(null);
    setVoteBounce(null);
    setLoadingBattle(true);
    try {
      const res = await fetch('/api/discover/battle');
      const d = await res.json() as { battle: { a: BattleTrack; b: BattleTrack; endsAt: string } | null };
      setBattle(d.battle);
    } catch {
      setBattle(null);
    } finally {
      setLoadingBattle(false);
    }
  };

  const voteBattle = async (side: 'a' | 'b') => {
    if (voted || !battle) return;
    setVoted(side);
    setVoteBounce(side);
    setTimeout(() => setVoteBounce(null), 600);
    const track = side === 'a' ? battle.a : battle.b;
    try {
      await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'media', targetId: track.id }),
      });
    } catch { /* non-blocking */ }
  };

  const battleCountdown = (endsAt: string) => {
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return 'Battle ended';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `Battle ends in ${h}h ${m}m`;
  };

  // ── Audio (Web Audio API fallback tone) ───────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  // ── Drag / swipe state ────────────────────────────────────────
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [flyOff, setFlyOff] = useState<{ x: number; y: number; rot: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragXRef = useRef(0);
  const dragYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // ── Seen persistence ─────────────────────────────────────────
  const SEEN_KEY = 'ihype-seeds-seen-v1';
  function loadSeen(): string[] {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); } catch { return []; }
  }
  function saveSeen(ids: string[]) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-400))); } catch {}
  }

  // ── Fetch deck ────────────────────────────────────────────────
  const fetchDeck = useCallback(async (genres: string[], seenIds: string[]) => {
    setLoadingDiscover(true);
    try {
      const genreQ = genres.length ? `&genres=${encodeURIComponent(genres.join(','))}` : '';
      const res = await fetch(`/api/discover/seeds?seen=${seenIds.join(',')}${genreQ}`);
      if (!res.ok) throw new Error('Failed');
      const result = await res.json() as { seeds?: SeedTrack[] };
      const seeds = result.seeds ?? [];
      setDeck(seeds);
      setDeckIdx(0);
      setDeckExhausted(seeds.length === 0);
    } catch {
      setFetchError(true);
      const fallback: SeedTrack[] = data.tracks.map(t => ({
        id: t.id,
        title: t.title,
        artistName: t.artistName,
        durationSec: t.durationSec,
        hypeCount: t.hypeCount,
        color: t.color,
        album: t.album,
        mediaUrl: t.mediaUrl || '',
        reason: 'Recommended based on your hypes',
      }));
      setDeck(fallback);
      setDeckIdx(0);
    } finally {
      setLoadingDiscover(false);
    }
  }, [data.tracks]);

  // Persist genre filter to localStorage
  useEffect(() => {
    try { localStorage.setItem('ihype-seeds-genre-filter', JSON.stringify(genreFilter)); } catch {}
  }, [genreFilter]);

  useEffect(() => {
    setFetchError(false);
    const seen = loadSeen();
    fetchDeck(genreFilter, seen);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreFilter]);

  // ── Swipe hint: show after 1.2s, wobble card, dismiss on first action ─
  useEffect(() => {
    const HINT_KEY = 'ihype-seeds-hint-dismissed';
    if (typeof localStorage !== 'undefined' && localStorage.getItem(HINT_KEY)) return;
    hintTimerRef.current = setTimeout(() => {
      setShowHint(true);
      setTimeout(() => setHintWobble(true), 200);
      setTimeout(() => setHintWobble(false), 1400);
    }, 1200);
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem('ihype-seeds-hint-dismissed', '1'); } catch {}
  }, []);

  // ── Action handler ────────────────────────────────────────────
  const handleAction = useCallback((track: SeedTrack, action: SeedAction, fromDrag = false, dragDx = 0, dragDy = 0) => {
    if (actionedIds.has(track.id)) return;
    dismissHint();
    setActionedIds(prev => new Set([...prev, track.id]));

    const flyX = action === 'hype' ? 700 : action === 'skip' ? -700 : fromDrag ? dragDx * 3 : 0;
    const flyY = action === 'save' ? -800 : fromDrag ? dragDy * 2 : 0;
    const rot  = action === 'hype' ? 25  : action === 'skip' ? -25 : dragDx * 0.15;
    setFlyOff({ x: flyX, y: flyY, rot });

    setTimeout(() => {
      setFlyOff(null);
      setDeckIdx(i => i + 1);
      setSeedPlaying(false);

      setSessionStats(prev => ({
        ...prev,
        saved:   action === 'save'  ? prev.saved + 1  : prev.saved,
        skipped: action === 'skip'  ? prev.skipped + 1 : prev.skipped,
        hyped:   action === 'hype'  ? prev.hyped + 1  : prev.hyped,
        xp: prev.xp + XP[action],
      }));

      const seen = loadSeen();
      saveSeen([...seen, track.id]);

      if (action === 'save') {
        const globalIdx = data.tracks.findIndex(t => t.id === track.id);
        if (globalIdx >= 0) onSave?.(globalIdx);
      }

      const remaining = deck.length - (deckIdx + 1);
      if (remaining <= 3) fetchDeck(genreFilter, loadSeen());
    }, 320);

    fetch(`/api/discover/seeds/${encodeURIComponent(track.id)}/${action}`, { method: 'POST' }).catch(() => {});
  }, [actionedIds, deck.length, deckIdx, genreFilter, data.tracks, onSave, fetchDeck, setSeedPlaying, dismissHint]);

  // ── Audio tone (fallback when no real mediaUrl) ───────────────
  useEffect(() => {
    if (!seedPlaying) {
      try { oscRef.current?.stop(); } catch {}
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      oscRef.current = null;
      return;
    }

    const frontTrack = deck[deckIdx % Math.max(deck.length, 1)];
    if (frontTrack?.mediaUrl) return;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 220;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 15);
    audioCtxRef.current = ctx;
    oscRef.current = osc;

    const timer = setTimeout(() => setSeedPlaying(false), 15000);
    return () => {
      clearTimeout(timer);
      try { osc.stop(); } catch {}
      ctx.close();
    };
  }, [seedPlaying, deck, deckIdx, setSeedPlaying]);

  // ── Derived state ─────────────────────────────────────────────
  const frontTrack = deck.length > 0 ? deck[deckIdx % deck.length] : null;
  const nextTracks = deck.length > 1
    ? [deck[(deckIdx + 1) % deck.length], deck[(deckIdx + 2) % deck.length], deck[(deckIdx + 3) % deck.length]].filter(Boolean)
    : [];
  const waveHeights = frontTrack ? waveformFromId(frontTrack.id) : Array(28).fill(50);
  const totalReviewed = sessionStats.saved + sessionStats.skipped + sessionStats.hyped;

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (!frontTrack) return;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); void handleAction(frontTrack, 'skip'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); void handleAction(frontTrack, 'hype'); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); void handleAction(frontTrack, 'save'); }
      if (e.key === ' ')          { e.preventDefault(); setSeedPlaying(!seedPlaying); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [frontTrack, handleAction, setSeedPlaying, seedPlaying]);

  // ── Pointer drag handlers ─────────────────────────────────────
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragXRef.current = 0;
    dragYRef.current = 0;
    setIsPressed(true);
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragXRef.current = dx;
    dragYRef.current = dy;
    if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      setIsDragging(true);
      setIsPressed(false);
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setDragX(dragXRef.current);
      setDragY(dragYRef.current);
    });
  }

  function handlePointerUp() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const dx = dragXRef.current;
    const dy = dragYRef.current;
    if (isDragging && frontTrack) {
      if (dx > 100)       handleAction(frontTrack, 'hype', true, dx, dy);
      else if (dx < -100) handleAction(frontTrack, 'skip', true, dx, dy);
      else if (dy < -100) handleAction(frontTrack, 'save', true, dx, dy);
    }
    setIsPressed(false);
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
    dragStart.current = null;
    dragXRef.current = 0;
    dragYRef.current = 0;
  }

  const GENRES = ['Hip-Hop', 'Electronic', 'R&B', 'Indie', 'Jazz', 'Soul', 'House', 'Punk'];

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe injections */}
      <style>{`
        @keyframes waveBar1 { from { transform: scaleY(.55) } to { transform: scaleY(1) } }
        @keyframes waveBar2 { from { transform: scaleY(.7)  } to { transform: scaleY(.9) } }
        @keyframes waveBar3 { from { transform: scaleY(.4)  } to { transform: scaleY(1) } }
        @keyframes waveBar4 { from { transform: scaleY(.8)  } to { transform: scaleY(.6) } }
        @keyframes waveBar5 { from { transform: scaleY(.5)  } to { transform: scaleY(.95) } }
        @keyframes seedWobble {
          0%   { transform: scale(1) rotate(0deg) }
          20%  { transform: scale(1.01) rotate(-3deg) }
          40%  { transform: scale(1.01) rotate(3deg) }
          60%  { transform: scale(1.01) rotate(-2deg) }
          80%  { transform: scale(1.01) rotate(2deg) }
          100% { transform: scale(1) rotate(0deg) }
        }
        @keyframes hintFadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes arrowPulseL { 0%,100%{opacity:.4;transform:translateX(0)} 50%{opacity:1;transform:translateX(-5px)} }
        @keyframes arrowPulseR { 0%,100%{opacity:.4;transform:translateX(0)} 50%{opacity:1;transform:translateX(5px)} }
        @keyframes arrowPulseU { 0%,100%{opacity:.4;transform:translateY(0)} 50%{opacity:1;transform:translateY(-5px)} }
      `}</style>

      <div style={{ padding: '32px 48px 48px', maxWidth: 1600, margin: '0 auto' }}>
        {/* Battle Modal */}
        {battleOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,8,5,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setBattleOpen(false); }}>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 18, padding: '32px 36px', maxWidth: 640, width: '90vw', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--ink)' }}>⚔️ Battle Mode</div>
                  {battle && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{battleCountdown(battle.endsAt)}</div>}
                </div>
                <button onClick={() => setBattleOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
              </div>

              {loadingBattle ? (
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  {[0, 1].map(i => (
                    <div key={i} style={{ flex: 1, height: 180, borderRadius: 12, background: 'var(--bg-3)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : !battle ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 14 }}>
                  Not enough tracks for a battle yet. Check back soon!
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                    {(['a', 'b'] as const).map((side, si) => {
                      const track = side === 'a' ? battle.a : battle.b;
                      const isVoted = voted === side;
                      const isBouncing = voteBounce === side;
                      return (
                        <React.Fragment key={side}>
                          {si === 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 40 }}>
                              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--ink-3)', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>VS</div>
                            </div>
                          )}
                          <button
                            onClick={() => voteBattle(side)}
                            disabled={!!voted}
                            style={{
                              flex: 1, border: isVoted ? '2px solid #b983ff' : '1px solid var(--line-2)',
                              borderRadius: 12, padding: '20px 16px', background: isVoted ? 'rgba(185,131,255,.12)' : 'var(--bg-3)',
                              cursor: voted ? 'default' : 'pointer', textAlign: 'left', transition: 'all .2s',
                              transform: isBouncing ? 'scale(1.06)' : 'scale(1)',
                              boxShadow: isVoted ? '0 0 0 2px rgba(185,131,255,.4)' : undefined,
                            }}
                          >
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: track.color || '#333', marginBottom: 12 }} />
                            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 16, letterSpacing: '-.01em', color: 'var(--ink)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                            <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>{track.artistName}</div>
                            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              🔥 {(track.hypeCount ?? 0).toLocaleString()} hypes
                            </div>
                            {isVoted && (
                              <div style={{ marginTop: 10, fontFamily: 'var(--f-m)', fontWeight: 700, fontSize: 13, color: '#b983ff', letterSpacing: '.06em' }}>✓ You voted!</div>
                            )}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {!voted && (
                    <div style={{ textAlign: 'center', marginTop: 18, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>Click a card to cast your vote</div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* View head */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
              DISCOVER · 15–30s clips · {data.city || 'Your city'}
            </div>
            <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 38, letterSpacing: '-.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>
              Seeds <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-2)' }}>— decide in 15 seconds.</em>
            </h1>
            <p style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 8, maxWidth: '60ch' }}>
              Hand-cut hooks from new uploads. Save it, hype it, skip it. Save-rate becomes the algorithm.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, position: 'relative' }}>
            {genreFilter.length === 1 && deck.length > 0 && (
              <button
                onClick={() => {
                  const filtered = deck.filter((_, i) => i >= deckIdx);
                  if (filtered.length > 0 && !seedPlaying) setSeedPlaying(true);
                }}
                style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: '#22e5d4', border: '1px solid rgba(34,229,212,.35)', background: 'rgba(34,229,212,.08)' }}
              >▶ Play {genreFilter[0]}</button>
            )}
            <button
              onClick={openBattle}
              style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: '#b983ff', border: '1px solid rgba(185,131,255,.35)', background: 'rgba(185,131,255,.08)' }}
            >⚔️ Battle</button>
            <button
              onClick={() => setShowGenrePicker(p => !p)}
              style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: genreFilter.length ? 'var(--accent)' : 'var(--ink-2)', border: genreFilter.length ? '1px solid rgba(255,80,41,.4)' : '1px solid transparent', background: 'none' }}
            >⚙ Filters{genreFilter.length > 0 ? ` (${genreFilter.length})` : ''}</button>
            {showGenrePicker && (
              <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>Genre filter</div>
                {GENRES.map(g => {
                  const on = genreFilter.includes(g);
                  return (
                    <button key={g} onClick={() => setGenreFilter(prev => on ? prev.filter(x => x !== g) : [...prev, g])}
                      style={{ padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontFamily: 'var(--f-b)', fontSize: 13, cursor: 'pointer', background: on ? 'rgba(255,80,41,.12)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-2)', border: on ? '1px solid rgba(255,80,41,.3)' : '1px solid transparent' }}
                    >{g}</button>
                  );
                })}
                {genreFilter.length > 0 && (
                  <button onClick={() => setGenreFilter([])} style={{ marginTop: 4, padding: '6px 10px', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.06em', cursor: 'pointer', background: 'none', color: 'var(--ink-3)', border: 'none' }}>Clear all</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3-col seeds stage */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px 1fr', gap: 30, alignItems: 'flex-start', paddingTop: 8 }}>

          {/* Left col — live session stats */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>SESSION</div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
              {[
                { k: 'Reviewed', v: totalReviewed, c: 'var(--ink)' },
                { k: 'Saved',    v: sessionStats.saved,    c: '#22e5d4' },
                { k: 'Skipped',  v: sessionStats.skipped,  c: '#ff6b5a' },
                { k: 'HYPEd',    v: sessionStats.hyped,    c: '#ff3e9a' },
              ].map(r => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontFamily: 'var(--f-m)', fontSize: 12, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>{r.k}</span>
                  <AnimCount value={r.v} color={r.c} />
                </div>
              ))}
              <div style={{ paddingTop: 10, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--f-m)', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>XP earned</span>
                <AnimCount value={sessionStats.xp} color="#ffb84a" />
              </div>
              {(data.hypeStreak ?? 0) > 0 && (
                <div style={{ paddingTop: 10, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--f-m)', fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>Hype streak</span>
                  <span style={{ color: 'var(--accent)', fontFamily: 'var(--f-d)', fontWeight: 700 }}>🔥 {data.hypeStreak}d</span>
                </div>
              )}
            </div>

            {/* Daily quest — radial arc */}
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: 18, marginBottom: 4 }}>DAILY QUEST</div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <RadialProgress value={Math.min(sessionStats.saved, 5)} max={5} color="#22e5d4" />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Save 5 seeds today</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', lineHeight: 1.5 }}>
                  {sessionStats.saved >= 5
                    ? <span style={{ color: '#22e5d4', fontWeight: 700 }}>✓ Complete! +60 XP</span>
                    : `${5 - sessionStats.saved} more · 60 XP + badge`}
                </div>
              </div>
            </div>
          </aside>

          {/* Center col — card stack */}
          <div>
            {fetchError && deck.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 460, gap: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 40 }}>⚡</div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>Couldn&apos;t load seeds</div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '28ch', lineHeight: 1.5 }}>Check your connection and try again.</div>
                <button
                  onClick={() => { setFetchError(false); fetchDeck(genreFilter, loadSeen()); }}
                  style={{ marginTop: 8, padding: '10px 20px', borderRadius: 8, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: '#fff', background: 'linear-gradient(135deg, var(--accent), #ff3e9a)' }}
                >
                  Retry
                </button>
              </div>
            ) : loadingDiscover && deck.length === 0 ? (
              <div style={{ height: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 13 }}>
                Loading seeds…
              </div>
            ) : deckExhausted && genreFilter.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 460, gap: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 48 }}>🎉</div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>You&apos;ve reviewed everything</div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '28ch', lineHeight: 1.5 }}>Check back tomorrow 🎉</div>
                <button onClick={() => fetchDeck(genreFilter, [])} style={{ marginTop: 8, padding: '10px 20px', borderRadius: 8, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: '#fff', background: 'linear-gradient(135deg, var(--accent), #ff3e9a)' }}>Refresh</button>
              </div>
            ) : deck.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 460, gap: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 48 }}>🌱</div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>No seeds for this genre</div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '28ch', lineHeight: 1.5 }}>Try clearing the genre filter.</div>
                {genreFilter.length > 0 && (
                  <button onClick={() => setGenreFilter([])} style={{ marginTop: 8, padding: '10px 20px', borderRadius: 8, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: '#fff', background: 'linear-gradient(135deg, var(--accent), #ff3e9a)' }}>Clear filters</button>
                )}
              </div>
            ) : frontTrack ? (<>

              {/* Card stack */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '380/540', margin: '0 auto' }}>
                {/* Behind cards */}
                {[deck[(deckIdx + 2) % deck.length], deck[(deckIdx + 1) % deck.length]].map((t, i) => (
                  <div key={t.id} style={{
                    position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden',
                    boxShadow: '0 30px 60px -10px rgba(0,0,0,.6)',
                    transformOrigin: 'center bottom',
                    transform: `translateY(${(2 - i) * 13}px) scale(${.87 + i * 0.06})`,
                    opacity: .22 + i * .22,
                    zIndex: i,
                    background: meshFromColor(t.color),
                  }} />
                ))}

                {/* Front card */}
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden', zIndex: 5,
                    boxShadow: isPressed
                      ? '0 12px 36px -6px rgba(0,0,0,.7), 0 0 0 2px rgba(255,255,255,.1)'
                      : '0 40px 80px -10px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.07)',
                    transform: flyOff
                      ? `translateX(${flyOff.x}px) translateY(${flyOff.y}px) rotate(${flyOff.rot}deg)`
                      : isDragging
                        ? `translateX(${dragX}px) translateY(${dragY * 0.3}px) rotate(${dragX * 0.06}deg)`
                        : isPressed
                          ? 'scale(0.97)'
                          : hintWobble
                            ? undefined
                            : 'scale(1)',
                    animation: hintWobble ? 'seedWobble 1.2s ease-in-out' : undefined,
                    transition: flyOff
                      ? 'transform .32s cubic-bezier(.4,0,.2,1)'
                      : isDragging ? 'none'
                      : hintWobble ? 'none'
                      : 'transform .15s ease, box-shadow .15s ease',
                    touchAction: 'none',
                    userSelect: 'none',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    willChange: 'transform',
                  }}
                >
                  {/* Mesh background */}
                  <div style={{ position: 'absolute', inset: 0, background: meshFromColor(frontTrack.color) }} />
                  {/* Noise texture overlay */}
                  <div style={{ position: 'absolute', inset: 0, opacity: .06, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '200px 200px' }} />
                  {/* Vignette */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.0) 35%, rgba(0,0,0,.7) 80%, rgba(0,0,0,.92) 100%)' }} />

                  {/* Center album art placeholder */}
                  <div style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)', width: 120, height: 120, borderRadius: 18, background: `${frontTrack.color}55`, border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${frontTrack.color}66, 0 8px 24px rgba(0,0,0,.5)`, backdropFilter: 'blur(8px)' }}>
                    <svg width={44} height={44} viewBox="0 0 24 24" fill="rgba(255,255,255,.6)"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
                  </div>

                  {/* Drag tint overlays */}
                  {dragX > 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(34,229,212,${Math.min(dragX / 100, 1) * 0.5})`, pointerEvents: 'none', borderRadius: 24 }} />}
                  {dragX < 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(255,60,60,${Math.min(-dragX / 100, 1) * 0.5})`, pointerEvents: 'none', borderRadius: 24 }} />}
                  {dragY < 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(34,229,212,${Math.min(-dragY / 100, 1) * 0.5})`, pointerEvents: 'none', borderRadius: 24 }} />}

                  {/* Action pill badges */}
                  {dragX > 50 && <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 9, padding: '7px 16px', borderRadius: 99, background: 'rgba(34,229,212,.92)', backdropFilter: 'blur(6px)', color: '#fff', fontFamily: 'var(--f-m)', fontWeight: 800, fontSize: 14, letterSpacing: '.1em', opacity: Math.min((dragX - 50) / 50, 1), pointerEvents: 'none' }}>♥ HYPE</div>}
                  {dragX < -50 && <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 9, padding: '7px 16px', borderRadius: 99, background: 'rgba(255,60,60,.92)', backdropFilter: 'blur(6px)', color: '#fff', fontFamily: 'var(--f-m)', fontWeight: 800, fontSize: 14, letterSpacing: '.1em', opacity: Math.min((-dragX - 50) / 50, 1), pointerEvents: 'none' }}>✕ SKIP</div>}
                  {dragY < -50 && <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9, padding: '7px 16px', borderRadius: 99, background: 'rgba(255,184,74,.92)', backdropFilter: 'blur(6px)', color: '#fff', fontFamily: 'var(--f-m)', fontWeight: 800, fontSize: 14, letterSpacing: '.1em', opacity: Math.min((-dragY - 50) / 50, 1), pointerEvents: 'none' }}>↑ SAVE</div>}

                  {/* Playing indicator */}
                  {seedPlaying && (
                    <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, padding: '6px 14px', borderRadius: 99, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: '#22e5d4', whiteSpace: 'nowrap' }}>
                      ● PLAYING
                    </div>
                  )}

                  {/* Tags */}
                  <div style={{ position: 'absolute', top: 20, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 3 }}>
                    <span style={{ padding: '5px 11px', borderRadius: 99, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.14em', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />SEED
                    </span>
                    {frontTrack.city && (
                      <span style={{ padding: '5px 11px', borderRadius: 99, background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.14em', fontWeight: 700, color: '#fff' }}>{frontTrack.city.toUpperCase()}</span>
                    )}
                  </div>

                  {/* Waveform */}
                  <div style={{ position: 'absolute', bottom: 128, left: 22, right: 22, zIndex: 3 }}>
                    <WaveformBars heights={waveHeights} playing={seedPlaying} />
                  </div>

                  {/* Body */}
                  <div style={{ position: 'absolute', bottom: 64, left: 22, right: 22, zIndex: 3, color: '#fff' }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.03em', lineHeight: .95, textShadow: '0 2px 16px rgba(0,0,0,.5)' }}>{frontTrack.title}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'rgba(255,255,255,.75)', letterSpacing: '.1em', marginTop: 6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{frontTrack.artistName}</span>
                      {frontTrack.durationSec && <span style={{ opacity: .5 }}>·</span>}
                      {frontTrack.durationSec && <span style={{ opacity: .6, fontFamily: 'var(--f-m)', fontSize: 12 }}>{Math.floor(frontTrack.durationSec / 60)}:{String(frontTrack.durationSec % 60).padStart(2, '0')}</span>}
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,.07)', fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.08em', color: 'rgba(255,255,255,.65)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="#ff3e9a"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>
                      {frontTrack.hypeCount.toLocaleString()} hypes
                    </span>
                    <span>{deck.length - deckIdx} left in deck</span>
                  </div>
                </div>

                {/* Swipe hint overlay */}
                {showHint && !isDragging && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 20, borderRadius: 24, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', animation: 'hintFadeIn .4s ease' }}>
                    {/* Left arrow — skip */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, animation: 'arrowPulseL 1.2s ease-in-out infinite' }}>
                      <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="rgba(255,107,90,.9)" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                      <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.1em', color: 'rgba(255,107,90,.8)', textTransform: 'uppercase' }}>Skip</span>
                    </div>
                    {/* Center — up arrow save */}
                    <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: 'arrowPulseU 1.2s ease-in-out infinite' }}>
                      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="rgba(255,184,74,.9)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                      <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.1em', color: 'rgba(255,184,74,.8)', textTransform: 'uppercase' }}>Save</span>
                    </div>
                    {/* Right arrow — hype */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, animation: 'arrowPulseR 1.2s ease-in-out infinite' }}>
                      <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="rgba(34,229,212,.9)" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                      <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.1em', color: 'rgba(34,229,212,.8)', textTransform: 'uppercase' }}>Hype</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls — frosted pill buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 26 }}>
                <ActionBtn
                  title="Skip (←)" label="Skip"
                  color="#ff6b5a"
                  icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>}
                  onClick={() => handleAction(frontTrack, 'skip')}
                />
                <ActionBtn
                  title="Preview (Space)" label={seedPlaying ? 'Pause' : 'Play'}
                  color="#22e5d4" size={52} active={seedPlaying}
                  icon={seedPlaying ? <IcPause s={20} /> : <IcPlay s={20} />}
                  onClick={() => setSeedPlaying(!seedPlaying)}
                />
                <ActionBtn
                  title="Save to queue (↑)" label="Save"
                  color="#ffb84a" size={68}
                  icon={<svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}
                  onClick={() => handleAction(frontTrack, 'save')}
                />
                <ActionBtn
                  title="HYPE (→)" label="Hype"
                  color="#ff3e9a" active={actionedIds.has(frontTrack.id)}
                  icon={<svg width={20} height={20} viewBox="0 0 24 24" fill={actionedIds.has(frontTrack.id) ? '#ff3e9a' : 'none'} stroke="#ff3e9a" strokeWidth="2"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>}
                  onClick={() => handleAction(frontTrack, 'hype')}
                />
              </div>
              <div style={{ textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.12em', marginTop: 12, textTransform: 'uppercase' }}>← Skip · ↑ Save · → Hype · Space Play/Pause</div>

            </>) : null}
          </div>

          {/* Right col — up next + why this seed */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>UP NEXT</div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {nextTracks.length > 0 ? nextTracks.map((t, i) => (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: 11, alignItems: 'center', opacity: 1 - i * 0.2 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 8, background: meshFromColor(t.color), boxShadow: `0 2px 8px ${t.color}44` }} />
                  <div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em' }}>{t.artistName}</div>
                  </div>
                </div>
              )) : (
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', padding: '8px 0', textAlign: 'center' }}>{deckExhausted ? 'Deck complete' : 'Loading more…'}</div>
              )}
            </div>

            {frontTrack?.reason && (
              <>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: 18, marginBottom: 4 }}>WHY THIS SEED?</div>
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  {frontTrack.reason}
                </div>
              </>
            )}

            {genreFilter.length > 0 && (
              <div style={{ background: 'rgba(255,80,41,.06)', border: '1px solid rgba(255,80,41,.2)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>FILTERED BY</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {genreFilter.map(g => (
                    <span key={g} style={{ padding: '3px 9px', borderRadius: 99, background: 'rgba(255,80,41,.12)', color: 'var(--accent)', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em' }}>{g}</span>
                  ))}
                </div>
              </div>
            )}
          {/* Saved & Hyped history */}
          {seedHistory.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Saved &amp; Hyped</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {seedHistory.slice(0, 8).map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 7 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{h.artistName}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: h.action === 'hype' ? '#ff3e9a' : '#22e5d4', flexShrink: 0, marginLeft: 8 }}>
                      {h.action === 'hype' ? '♥' : '↑'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          </aside>

        </div>
      </div>
    </>
  );
}
