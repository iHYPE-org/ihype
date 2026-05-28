'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShell';
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
  const bars = 20;
  return Array.from({ length: bars }, (_, i) => {
    let h = 0;
    for (let j = 0; j < id.length; j++) h = (h * 31 + id.charCodeAt(j)) >>> 0;
    h = (h ^ (i * 2654435761)) >>> 0;
    return 28 + (h % 65); // 28–92%
  });
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
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [showGenrePicker, setShowGenrePicker] = useState(false);

  // Pointer in the deck (cards are never removed, just advanced past)
  const [deckIdx, setDeckIdx] = useState(0);

  // ── Session stats ─────────────────────────────────────────────
  const [sessionStats, setSessionStats] = useState({ saved: 0, skipped: 0, hyped: 0, xp: 0 });
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());

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
      const data = await res.json() as { seeds?: SeedTrack[] };
      const seeds = data.seeds ?? [];

      // Map API shape to SeedTrack (discover/seeds returns slightly different shape from discover/tracks)
      // Fall back to discover/tracks shape if storageUrl is present
      setDeck(seeds);
      setDeckIdx(0);
      if (seeds.length === 0) {
        setDeckExhausted(true);
      } else {
        setDeckExhausted(false);
      }
    } catch {
      // Fallback: use data.tracks from workbench data
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

  useEffect(() => {
    const seen = loadSeen();
    fetchDeck(genreFilter, seen);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreFilter]);

  // ── Action handler ────────────────────────────────────────────
  const handleAction = useCallback(async (track: SeedTrack, action: SeedAction) => {
    if (actionedIds.has(track.id)) return;
    setActionedIds(prev => new Set([...prev, track.id]));

    // Advance card
    setDeckIdx(i => i + 1);
    setSeedPlaying(false);

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      saved:   action === 'save'  ? prev.saved + 1  : prev.saved,
      skipped: action === 'skip'  ? prev.skipped + 1 : prev.skipped,
      hyped:   action === 'hype'  ? prev.hyped + 1  : prev.hyped,
      xp: prev.xp + XP[action],
    }));

    // Persist seen
    const seen = loadSeen();
    saveSeen([...seen, track.id]);

    // If this was a save, also load into player queue
    if (action === 'save') {
      const globalIdx = data.tracks.findIndex(t => t.id === track.id);
      if (globalIdx >= 0) onSave?.(globalIdx);
    }

    // Record action in backend
    try {
      await fetch(`/api/discover/seeds/${encodeURIComponent(track.id)}/${action}`, {
        method: 'POST',
      });
    } catch {
      // Non-blocking — action is already recorded locally
    }

    // Load more cards when we're near the end of the deck
    const remaining = deck.length - (deckIdx + 1);
    if (remaining <= 3) {
      const seen = loadSeen();
      fetchDeck(genreFilter, seen);
    }
  }, [actionedIds, deck.length, deckIdx, genreFilter, data.tracks, onSave, fetchDeck, setSeedPlaying]);

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
    if (frontTrack?.mediaUrl) return; // real audio plays elsewhere

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
  const waveHeights = frontTrack ? waveformFromId(frontTrack.id) : Array(20).fill(50);
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

  // ── Genre picker options ──────────────────────────────────────
  const GENRES = ['Hip-Hop', 'Electronic', 'R&B', 'Indie', 'Jazz', 'Soul', 'House', 'Punk'];

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 48px 48px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Battle Modal */}
      {battleOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,8,5,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setBattleOpen(false); }}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 18, padding: '32px 36px', maxWidth: 640, width: '90vw', position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--ink)' }}>⚔️ Battle Mode</div>
                {battle && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{battleCountdown(battle.endsAt)}</div>}
              </div>
              <button onClick={() => setBattleOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
            </div>

            {loadingBattle ? (
              /* Loading skeleton */
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                {[0, 1].map(i => (
                  <div key={i} style={{ flex: 1, height: 180, borderRadius: 12, background: 'var(--bg-3)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                ))}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-3)', flexShrink: 0 }} />
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
          <button
            onClick={openBattle}
            style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: '#b983ff', border: '1px solid rgba(185,131,255,.35)', background: 'rgba(185,131,255,.08)' }}
          >
            ⚔️ Battle
          </button>
          <button
            onClick={() => setShowGenrePicker(p => !p)}
            style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: genreFilter.length ? 'var(--accent)' : 'var(--ink-2)', border: genreFilter.length ? '1px solid rgba(255,80,41,.4)' : '1px solid transparent', background: 'none' }}
          >
            ⚙ Filters{genreFilter.length > 0 ? ` (${genreFilter.length})` : ''}
          </button>
          {showGenrePicker && (
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>Genre filter</div>
              {GENRES.map(g => {
                const on = genreFilter.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => setGenreFilter(prev => on ? prev.filter(x => x !== g) : [...prev, g])}
                    style={{ padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontFamily: 'var(--f-b)', fontSize: 13, cursor: 'pointer', background: on ? 'rgba(255,80,41,.12)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-2)', border: on ? '1px solid rgba(255,80,41,.3)' : '1px solid transparent' }}
                  >{g}</button>
                );
              })}
              {genreFilter.length > 0 && (
                <button onClick={() => setGenreFilter([])} style={{ marginTop: 4, padding: '6px 10px', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.06em', cursor: 'pointer', background: 'none', color: 'var(--ink-3)', border: 'none' }}>
                  Clear all
                </button>
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
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
            {[
              { k: 'Reviewed', v: totalReviewed > 0 ? `${totalReviewed}` : '—', c: 'var(--ink)' },
              { k: 'Saved',    v: sessionStats.saved   > 0 ? `+${sessionStats.saved}`   : '—', c: '#22e5d4' },
              { k: 'Skipped',  v: sessionStats.skipped > 0 ? String(sessionStats.skipped) : '—', c: '#ff6b5a' },
              { k: 'Hyped',    v: sessionStats.hyped   > 0 ? `+${sessionStats.hyped}`   : '—', c: 'var(--pink)' },
            ].map(r => (
              <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontFamily: 'var(--f-m)', fontSize: 11 }}>
                <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>{r.k}</span>
                <span style={{ color: r.c, fontWeight: 600 }}>{r.v}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--f-m)', fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>XP earned</span>
              <span style={{ color: '#ffb84a', fontWeight: 600 }}>+{sessionStats.xp} XP</span>
            </div>
          </div>

          {/* Daily quest */}
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: 18, marginBottom: 4 }}>DAILY QUEST</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14 }}>Save 5 seeds today</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: i < sessionStats.saved ? 'var(--accent)' : 'var(--bg-3)' }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
              {sessionStats.saved} / 5 · 60 XP + Seed Curator badge
            </div>
          </div>
        </aside>

        {/* Center col — card stack */}
        <div>
          {loadingDiscover && deck.length === 0 ? (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 13 }}>
              Loading seeds…
            </div>
          ) : deckExhausted && genreFilter.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 380, gap: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>You&apos;ve reviewed everything</div>
              <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '28ch', lineHeight: 1.5 }}>
                Check back tomorrow 🎉
              </div>
              <button onClick={() => fetchDeck(genreFilter, [])} style={{ marginTop: 8, padding: '10px 20px', borderRadius: 8, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: '#fff', background: 'linear-gradient(135deg, var(--accent), var(--pink))' }}>
                Refresh
              </button>
            </div>
          ) : deck.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 380, gap: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>🌱</div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>No seeds for this genre</div>
              <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '28ch', lineHeight: 1.5 }}>
                Try clearing the genre filter.
              </div>
              {genreFilter.length > 0 && (
                <button onClick={() => setGenreFilter([])} style={{ marginTop: 8, padding: '10px 20px', borderRadius: 8, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: '#fff', background: 'linear-gradient(135deg, var(--accent), var(--pink))' }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : frontTrack ? (<>

            {/* Card stack */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '380/520', margin: '0 auto' }}>
              {/* behind cards */}
              {[deck[(deckIdx + 2) % deck.length], deck[(deckIdx + 1) % deck.length]].map((t, i) => (
                <div key={t.id} style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', transformOrigin: 'center bottom', transform: `translateY(${(2 - i) * 13}px) scale(${.87 + i * 0.06})`, opacity: .28 + i * .27, zIndex: i, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }} />
              ))}

              {/* Front card */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', zIndex: 5 }}>
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${frontTrack.color} 0%, #ff3e9a 60%, #221c16 100%)` }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.75) 100%)' }} />

                {/* Playing indicator */}
                {seedPlaying && (
                  <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 10, padding: '5px 12px', borderRadius: 99, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: '#22e5d4', animation: 'pulse 1.4s infinite', whiteSpace: 'nowrap' }}>
                    ● PLAYING
                  </div>
                )}

                {/* Tags */}
                <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 3 }}>
                  <span style={{ padding: '5px 10px', borderRadius: 99, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)', fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.14em', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />SEED
                  </span>
                  {frontTrack.city && (
                    <span style={{ padding: '5px 10px', borderRadius: 99, background: 'rgba(255,255,255,.18)', fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.14em', fontWeight: 700, color: '#fff' }}>{frontTrack.city.toUpperCase()}</span>
                  )}
                </div>

                {/* Waveform */}
                <div style={{ position: 'absolute', bottom: 170, left: 24, right: 24, height: 36, display: 'flex', alignItems: 'flex-end', gap: 3, zIndex: 3 }}>
                  {waveHeights.map((h, i) => (
                    <i key={i} style={{ flex: 1, background: seedPlaying ? 'rgba(34,229,212,.8)' : 'rgba(255,255,255,.55)', borderRadius: 99, display: 'block', height: `${h}%`, transition: 'background .3s' }} />
                  ))}
                </div>

                {/* Body */}
                <div style={{ position: 'absolute', bottom: 60, left: 22, right: 22, zIndex: 3, color: '#fff' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-.03em', lineHeight: .95, textShadow: '0 2px 12px rgba(0,0,0,.4)' }}>{frontTrack.title}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'rgba(255,255,255,.8)', letterSpacing: '.1em', marginTop: 6, textTransform: 'uppercase' }}>{frontTrack.artistName}</div>
                </div>

                {/* Footer */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,.08)', fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.08em', color: 'rgba(255,255,255,.7)' }}>
                  <span>♥ {frontTrack.hypeCount} hype</span>
                  <span>{deck.length - deckIdx} left in deck</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 24 }}>
              <button title="Skip (←)" aria-label="Skip seed" onClick={() => handleAction(frontTrack, 'skip')} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid rgba(255,107,90,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ff6b5a' }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
              <button title="Preview (Space)" aria-label={seedPlaying ? 'Pause preview' : 'Play preview'} onClick={() => setSeedPlaying(!seedPlaying)} style={{ width: 56, height: 56, borderRadius: '50%', background: seedPlaying ? 'rgba(34,229,212,.1)' : 'var(--bg-2)', border: `1px solid ${seedPlaying ? 'rgba(34,229,212,.6)' : 'var(--line-2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: seedPlaying ? '#22e5d4' : 'var(--ink-2)' }}>
                {seedPlaying ? <IcPause s={20} /> : <IcPlay s={20} />}
              </button>
              <button title="Save to queue (↑)" aria-label="Save seed to queue" onClick={() => handleAction(frontTrack, 'save')} style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid rgba(34,229,212,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#22e5d4' }}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l14 7-14 7V5z" fill="currentColor" opacity=".2"/><path d="M5 5l14 7-14 7V5z"/></svg>
              </button>
              <button
                title="HYPE (→)"
                aria-label="Hype this track"
                onClick={() => handleAction(frontTrack, 'hype')}
                style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-2)', border: `1px solid ${actionedIds.has(frontTrack.id) ? 'rgba(255,62,154,.8)' : 'rgba(255,62,154,.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: actionedIds.has(frontTrack.id) ? '#ff3e9a' : 'var(--pink)' }}
              >
                <svg width={22} height={22} viewBox="0 0 24 24" fill={actionedIds.has(frontTrack.id) ? '#ff3e9a' : 'currentColor'}>
                  <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>
                </svg>
              </button>
            </div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginTop: 14, textTransform: 'uppercase' }}>← Skip · ↑ Save · → Hype · Space Play/Pause</div>

          </>) : null}
        </div>

        {/* Right col — up next + why this seed */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>UP NEXT</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nextTracks.length > 0 ? nextTracks.map((t, i) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: 10, alignItems: 'center', opacity: 1 - i * 0.2 }}>
                <div style={{ width: 42, height: 42, borderRadius: 6, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }} />
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13 }}>{t.title}</div>
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
        </aside>

      </div>
    </div>
  );
}
