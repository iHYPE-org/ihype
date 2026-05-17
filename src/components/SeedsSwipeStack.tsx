'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

export type SeedsSwipeStackTrack = {
  id: string;
  title: string;
  artistName: string;
  album?: string;
  color: string;
  durationLabel: string;
  hypeCount: number;
};

export type SeedsSwipeStackSeed = {
  id: string;
  trackId: string;
  reason?: string;
};

type Props = {
  seeds: SeedsSwipeStackSeed[];
  tracks: SeedsSwipeStackTrack[];
  onSave: (seed: SeedsSwipeStackSeed) => void;
  onSkip: (seed: SeedsSwipeStackSeed) => void;
  onHype: (seed: SeedsSwipeStackSeed) => void;
  selectedGenres?: string[];
  onGenresChange?: (genres: string[]) => void;
};

const GENRE_OPTIONS = [
  'Electronic', 'Hip-Hop', 'Rock', 'Jazz', 'Indie', 'Folk', 'R&B', 'Pop', 'Other'
];

function IcPlay({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20" />
    </svg>
  );
}

function IcHeart({ s = 16, filled = false }: { s?: number; filled?: boolean }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IcBookmark({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IcX({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function SeedsSwipeStack({ seeds, tracks, onSave, onSkip, onHype, selectedGenres, onGenresChange }: Props) {
  const [extraSeeds, setExtraSeeds] = useState<SeedsSwipeStackSeed[]>([]);
  const [radioMode, setRadioMode] = useState(false);
  function toggleGenre(g: string) {
    if (!onGenresChange) return;
    const current = selectedGenres ?? [];
    if (current.includes(g)) onGenresChange(current.filter((x) => x !== g));
    else onGenresChange([...current, g]);
  }
  const activeSeedList = [...extraSeeds, ...seeds];
  const [index, setIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | 'up' | null>(null);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [lastSkipped, setLastSkipped] = useState<SeedsSwipeStackSeed | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);

  useEffect(() => {
    setIndex(0);
    setExtraSeeds([]);
  }, [seeds]);

  // Auto-fade undo after 5 seconds.
  useEffect(() => {
    if (!undoVisible) return;
    const t = setTimeout(() => {
      setUndoVisible(false);
      setLastSkipped(null);
    }, 5000);
    return () => clearTimeout(t);
  }, [undoVisible, lastSkipped]);

  const seed = activeSeedList[index];
  const track = seed ? tracks.find(t => t.id === seed.trackId) : null;
  const nextSeed = activeSeedList[index + 1];
  const nextTrack = nextSeed ? tracks.find(t => t.id === nextSeed.trackId) : null;

  const advance = useCallback((dir: 'left' | 'right' | 'up') => {
    if (!seed) return;
    setSwipeDir(dir);
    if (dir === 'right') onSave(seed);
    else if (dir === 'left') {
      onSkip(seed);
      setLastSkipped(seed);
      setUndoVisible(true);
    }
    else if (dir === 'up') onHype(seed);
    setTimeout(() => {
      setIndex(i => i + 1);
      setSwipeDir(null);
      setDragDx(0);
    }, 240);
  }, [seed, onSave, onSkip, onHype]);

  const handleUndo = useCallback(() => {
    if (!lastSkipped) return;
    // Re-insert the skipped seed at the current position (front of remaining queue).
    setExtraSeeds(prev => [lastSkipped, ...prev]);
    // Walk index back so the inserted seed is shown next.
    setIndex(i => Math.max(0, i - 1));
    setLastSkipped(null);
    setUndoVisible(false);
  }, [lastSkipped]);

  // Keyboard navigation: ArrowRight = hype, ArrowLeft = skip, ArrowDown = save.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (!seed) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); advance('up'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); advance('left'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); advance('right'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, seed]);

  // Radio mode: auto-advance after 30 seconds if user hasn't interacted.
  useEffect(() => {
    if (!radioMode) return;
    if (!seed) return;
    const t = setTimeout(() => {
      advance('left');
    }, 30_000);
    return () => clearTimeout(t);
  }, [radioMode, seed, index, advance]);

  function handleMouseDown(e: React.MouseEvent) {
    dragStartX.current = e.clientX;
    setDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setDragDx(e.clientX - dragStartX.current);
  }

  function handleMouseUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragDx > 80) advance('right');
    else if (dragDx < -80) advance('left');
    else setDragDx(0);
  }

  const done = index >= activeSeedList.length;

  const cardRotate = swipeDir === 'left' ? -20
    : swipeDir === 'right' ? 20
    : swipeDir === 'up' ? -5
    : dragging ? dragDx * 0.06
    : 0;

  const cardTx = swipeDir === 'left' ? -400
    : swipeDir === 'right' ? 400
    : dragging ? dragDx
    : 0;

  const cardTy = swipeDir === 'up' ? -400 : 0;

  const tintLeft = dragDx < -20 ? Math.min(1, Math.abs(dragDx) / 120) : 0;
  const tintRight = dragDx > 20 ? Math.min(1, dragDx / 120) : 0;

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-3)', marginBottom: 10 }}>
          ● DISCOVER · SEEDS · PERSONALIZED FOR YOU
        </div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>
          Discover
        </h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 480, lineHeight: 1.5 }}>
          New tracks seeded from artists you already HYPE. Save to library, skip, or HYPE to signal.
        </p>

        {onGenresChange ? (
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)', marginRight: 4 }}>
              GENRES
            </span>
            {GENRE_OPTIONS.map((g) => {
              const active = (selectedGenres ?? []).includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontFamily: 'var(--f-m)',
                    fontSize: 11,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--line-2)',
                    background: active ? 'rgba(255,80,41,.14)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--ink-2)'
                  }}
                >
                  {g}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setRadioMode((v) => !v)}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                borderRadius: 999,
                fontFamily: 'var(--f-m)',
                fontSize: 11,
                cursor: 'pointer',
                border: radioMode ? '1px solid #22e5d4' : '1px solid var(--line-2)',
                background: radioMode ? 'rgba(34,229,212,.12)' : 'transparent',
                color: radioMode ? '#22e5d4' : 'var(--ink-2)'
              }}
              aria-pressed={radioMode}
              title="Auto-advance every 30 seconds"
            >
              {radioMode ? '● RADIO ON' : '○ RADIO'}
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        {/* Card stack */}
        <div style={{ position: 'relative', width: 340, height: 440, flexShrink: 0 }}>
          {/* Back card */}
          {nextTrack && !done && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 16,
              background: `linear-gradient(160deg, ${nextTrack.color}50 0%, ${nextTrack.color}20 100%), var(--bg-2)`,
              border: '1px solid var(--line)', transform: 'scale(0.95) translateY(12px)', zIndex: 0,
            }} />
          )}

          {/* Main card */}
          {!done && track ? (
            <div
              ref={cardRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                position: 'absolute', inset: 0, borderRadius: 16, zIndex: 1,
                background: `linear-gradient(160deg, ${track.color}60 0%, ${track.color}20 100%), var(--bg-2)`,
                border: `1px solid ${track.color}50`,
                cursor: dragging ? 'grabbing' : 'grab',
                transform: `translateX(${cardTx}px) translateY(${cardTy}px) rotate(${cardRotate}deg)`,
                transition: dragging ? 'none' : 'transform .24s cubic-bezier(.22,.68,0,1.2)',
                userSelect: 'none', overflow: 'hidden',
              }}
            >
              {/* Skip tint */}
              {tintLeft > 0 && (
                <div style={{ position: 'absolute', inset: 0, background: `rgba(255,80,41,${tintLeft * 0.35})`, zIndex: 2, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, color: '#ff5029', border: '3px solid #ff5029', borderRadius: 8, padding: '6px 18px', transform: 'rotate(-12deg)', opacity: tintLeft }}>SKIP</div>
                </div>
              )}
              {/* Save tint */}
              {tintRight > 0 && (
                <div style={{ position: 'absolute', inset: 0, background: `rgba(34,229,212,${tintRight * 0.35})`, zIndex: 2, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, color: '#22e5d4', border: '3px solid #22e5d4', borderRadius: 8, padding: '6px 18px', transform: 'rotate(12deg)', opacity: tintRight }}>SAVE</div>
                </div>
              )}

              <div style={{ padding: 24, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                {/* Artwork */}
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, background: `linear-gradient(135deg, ${track.color}, ${track.color}80)`, position: 'relative', overflow: 'hidden', marginBottom: 20, flex: '0 0 auto', maxHeight: 220 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.3), transparent 65%)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)' }}>
                    <IcPlay s={20} />
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 6 }}>
                    {seed.reason ?? 'Recommended for you'}
                  </div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', color: 'var(--ink)', lineHeight: 1.1 }}>{track.title}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', marginTop: 6, letterSpacing: '.04em' }}>
                    {track.artistName}
                    {track.album ? ` · ${track.album}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{track.durationLabel}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff3e9a', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IcHeart s={10} filled /> {track.hypeCount.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Queue indicator */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 12 }}>
                  {activeSeedList.slice(0, 6).map((_, i) => (
                    <div key={i} style={{ width: i === index ? 16 : 6, height: 4, borderRadius: 2, background: i === index ? track.color : 'rgba(255,255,255,.15)', transition: 'width .2s, background .2s' }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>You're all caught up</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em' }}>Check back tomorrow for new seeds</div>
              <button type="button" onClick={() => setIndex(0)}
                style={{ marginTop: 8, padding: '9px 20px', background: 'var(--ink)', color: 'var(--bg)', border: 'none', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, cursor: 'pointer' }}>
                Replay seeds
              </button>
            </div>
          )}
        </div>

        {/* Action buttons + info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 4 }}>
            {done ? 'DONE' : `${index + 1} / ${activeSeedList.length} SEEDS`}
          </div>

          <button type="button" onClick={() => !done && advance('right')} disabled={done}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'rgba(34,229,212,.08)', border: '1px solid rgba(34,229,212,.3)', borderRadius: 10, fontFamily: 'var(--f-m)', fontSize: 12, color: '#22e5d4', cursor: done ? 'default' : 'pointer', opacity: done ? 0.4 : 1 }}>
            <IcBookmark s={14} /> Save to library
          </button>

          <button type="button" onClick={() => !done && advance('up')} disabled={done}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'rgba(255,62,154,.08)', border: '1px solid rgba(255,62,154,.3)', borderRadius: 10, fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff3e9a', cursor: done ? 'default' : 'pointer', opacity: done ? 0.4 : 1 }}>
            <IcHeart s={14} /> HYPE it
          </button>

          <button type="button" onClick={() => !done && advance('left')} disabled={done}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', cursor: done ? 'default' : 'pointer', opacity: done ? 0.4 : 1 }}>
            <IcX s={14} /> Skip
          </button>

          {undoVisible && lastSkipped ? (
            <button
              type="button"
              onClick={handleUndo}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 16px', background: 'rgba(255,255,255,.08)',
                border: '1px solid var(--line)', borderRadius: 10,
                fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink)',
                cursor: 'pointer',
                animation: 'fadeOut 5s forwards',
              }}
            >
              ↶ Undo last skip
            </button>
          ) : null}

          <div style={{ marginTop: 8, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.16em', color: 'var(--ink-3)', marginBottom: 8 }}>HOW IT WORKS</div>
            <div style={{ fontFamily: 'var(--f-b)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
              Seeds are seeded from artists you already HYPE. Save → adds to library. HYPE → signals the artist. Skip → trains your feed.
            </div>
            <div style={{ marginTop: 10, fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.16em', color: 'var(--ink-3)', marginBottom: 6 }}>KEYBOARD</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              ← Skip · → HYPE · ↓ Save
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
