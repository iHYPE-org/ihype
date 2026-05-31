'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────
// Discover · Seeds — swipeable 15–30s clip feed.
//
// ← / left-drag  → skip
// → / right-drag → save the full track to the user's queue
// ↑ / up-drag    → HYPE the artist
//
// The component manages its own stack progression and visual state.
// Wire the three callbacks to your real endpoints; the component does
// not call the network on its own.
// ─────────────────────────────────────────────────────────────────

export type SeedsSwipeStackTrack = {
  id: string;
  title: string;
  artistName: string;
  album?: string | null;
  /** A hex color used as the gradient base for the seed card. */
  color: string;
  /** Full track duration as a display string ("3:24"). */
  durationLabel: string;
  /** Current HYPE count for the underlying track. */
  hypeCount: number;
};

export type SeedsSwipeStackSeed = {
  id: string;
  trackId: string;
  /** Seed duration in seconds (15..30). */
  durationSec: number;
  /** Short prose describing the seed moment, e.g. "the drop after the bridge". */
  hook: string;
  /** Optional artist quote shown on the card. */
  intro?: string | null;
};

type ExitDirection = 'skip' | 'save' | 'hype' | null;

export type SeedsSwipeStackProps = {
  seeds: SeedsSwipeStackSeed[];
  tracks: SeedsSwipeStackTrack[];
  /** Called when the user swipes right or presses →. Persist the save server-side. */
  onSave?: (seed: SeedsSwipeStackSeed, track: SeedsSwipeStackTrack) => void | Promise<void>;
  /** Called when the user swipes left, presses ←, or the seed times out. */
  onSkip?: (seed: SeedsSwipeStackSeed, track: SeedsSwipeStackTrack, reason: 'manual' | 'timeout') => void | Promise<void>;
  /** Called when the user swipes up or presses ↑. */
  onHype?: (seed: SeedsSwipeStackSeed, track: SeedsSwipeStackTrack) => void | Promise<void>;
};

const REACTION = {
  skip: { label: 'SKIP', color: '#ff5029', rotate: -12 },
  save: { label: 'SAVE', color: '#22e5d4', rotate: 12 },
  hype: { label: 'HYPE!', color: '#ff3e9a', rotate: 0 },
} as const;

export function SeedsSwipeStack({ seeds, tracks, onSave, onSkip, onHype }: SeedsSwipeStackProps) {
  const trackById = React.useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const validSeeds = React.useMemo(
    () => seeds.filter((s) => trackById.has(s.trackId)),
    [seeds, trackById]
  );

  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exit, setExit] = useState<ExitDirection>(null);
  const [stats, setStats] = useState({ saves: 0, skips: 0, hyped: 0 });
  const [flash, setFlash] = useState<{ kind: ExitDirection; track: SeedsSwipeStackTrack } | null>(null);
  const [progress, setProgress] = useState(0);

  const seed = validSeeds[idx];
  const track = seed ? trackById.get(seed.trackId)! : null;
  const nextSeed1 = validSeeds[(idx + 1) % Math.max(validSeeds.length, 1)];
  const nextSeed2 = validSeeds[(idx + 2) % Math.max(validSeeds.length, 1)];
  const nextTrack1 = nextSeed1 ? trackById.get(nextSeed1.trackId) : null;
  const nextTrack2 = nextSeed2 ? trackById.get(nextSeed2.trackId) : null;

  // Advance helper — committed reaction triggers slide-out then increment.
  const advanceRef = useRef<(kind: Exclude<ExitDirection, null>, silent?: boolean) => void>(() => {});
  advanceRef.current = (kind, silent = false) => {
    if (!seed || !track) return;
    setExit(kind);
    if (!silent) {
      if (kind === 'save') {
        setStats((s) => ({ ...s, saves: s.saves + 1 }));
        setFlash({ kind: 'save', track });
        window.setTimeout(() => setFlash(null), 1800);
        void onSave?.(seed, track);
      } else if (kind === 'skip') {
        setStats((s) => ({ ...s, skips: s.skips + 1 }));
        void onSkip?.(seed, track, 'manual');
      } else if (kind === 'hype') {
        setStats((s) => ({ ...s, hyped: s.hyped + 1 }));
        void onHype?.(seed, track);
      }
    } else if (kind === 'skip') {
      void onSkip?.(seed, track, 'timeout');
    }
    window.setTimeout(() => {
      setIdx((i) => (i + 1) % validSeeds.length);
      setExit(null);
      setDrag({ x: 0, y: 0, active: false });
      setProgress(0);
    }, 260);
  };
  const advance = useCallback((kind: Exclude<ExitDirection, null>, silent = false) => {
    advanceRef.current(kind, silent);
  }, []);

  // Auto-advance progress timer
  useEffect(() => {
    if (!seed) return;
    setProgress(0);
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const p = (performance.now() - start) / (seed.durationSec * 1000);
      if (p >= 1) {
        advance('skip', true);
        return;
      }
      setProgress(p);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [seed?.id, advance]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') advance('skip');
      else if (e.key === 'ArrowRight') advance('save');
      else if (e.key === 'ArrowUp') advance('hype');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  // Pointer drag
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const x0 = e.clientX;
    const y0 = e.clientY;
    setDrag({ x: 0, y: 0, active: true });
    const onMove = (ev: PointerEvent) => setDrag({ x: ev.clientX - x0, y: ev.clientY - y0, active: true });
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (dx < -120) advance('skip');
      else if (dx > 120) advance('save');
      else if (dy < -110) advance('hype');
      else setDrag({ x: 0, y: 0, active: false });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [advance]);

  if (!seed || !track) {
    return (
      <div style={{ padding: '40px 32px', textAlign: 'center', color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: 13, letterSpacing: '.04em' }}>
        No seeds in your pool yet. Keep listening — we'll build the algorithm as you HYPE.
      </div>
    );
  }

  let tx = drag.x;
  let ty = drag.y;
  let rot = drag.x * 0.06;
  if (exit === 'skip') { tx = -800; rot = -25; }
  else if (exit === 'save') { tx = 800; rot = 25; }
  else if (exit === 'hype') { ty = -700; rot = 0; }

  const skipOpa = Math.min(1, Math.max(0, -drag.x / 180));
  const saveOpa = Math.min(1, Math.max(0,  drag.x / 180));
  const hypeOpa = Math.min(1, Math.max(0, -drag.y / 180));

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, gap: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: '#ff5029', marginBottom: 10 }}>
            ● SEEDS · 15–30s CLIPS · YOUR ALGORITHM
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>
            Discover
          </h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 580, lineHeight: 1.5 }}>
            Short clips from artists you might love. <strong style={{ color: 'var(--ink)' }}>Swipe right</strong> to save the
            full track to your queue, <strong style={{ color: 'var(--ink)' }}>left</strong> to skip,{' '}
            <strong style={{ color: 'var(--ink)' }}>up</strong> to HYPE the artist. Keyboard works too.
          </p>
        </div>
        <SessionStats stats={stats} />
      </div>

      <Stage
        seed={seed}
        track={track}
        nextTrack1={nextTrack1 ?? null}
        nextTrack2={nextTrack2 ?? null}
        tx={tx}
        ty={ty}
        rot={rot}
        active={drag.active}
        progress={progress}
        skipOpa={skipOpa}
        saveOpa={saveOpa}
        hypeOpa={hypeOpa}
        onPointerDown={onPointerDown}
        flash={flash}
      />

      <ActionRail onSkip={() => advance('skip')} onHype={() => advance('hype')} onSave={() => advance('save')} />

      <UpNext seeds={validSeeds} tracks={trackById} cursor={idx + 1} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function SessionStats({ stats }: { stats: { saves: number; skips: number; hyped: number } }) {
  return (
    <div style={{ display: 'flex', gap: 18, padding: '10px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
      {[
        { c: '#ff3e9a', n: stats.hyped, l: 'HYPED' },
        { c: '#22e5d4', n: stats.saves, l: 'SAVED' },
        { c: 'var(--ink-3)', n: stats.skips, l: 'SKIPPED' },
      ].map((row) => (
        <div key={row.l} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: row.c }} />
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, letterSpacing: '-.015em', color: 'var(--ink)' }}>
            {row.n}
          </span>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.16em' }}>{row.l}</span>
        </div>
      ))}
    </div>
  );
}

function Stage(props: {
  seed: SeedsSwipeStackSeed;
  track: SeedsSwipeStackTrack;
  nextTrack1: SeedsSwipeStackTrack | null;
  nextTrack2: SeedsSwipeStackTrack | null;
  tx: number;
  ty: number;
  rot: number;
  active: boolean;
  progress: number;
  skipOpa: number;
  saveOpa: number;
  hypeOpa: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  flash: { kind: ExitDirection; track: SeedsSwipeStackTrack } | null;
}) {
  const { seed, track, nextTrack1, nextTrack2, tx, ty, rot, active, progress, skipOpa, saveOpa, hypeOpa, onPointerDown, flash } = props;

  return (
    <div style={{ position: 'relative', height: 420, marginBottom: 14, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {nextTrack2 && (
        <div style={{
          position: 'absolute', width: 330, height: 380, borderRadius: 18,
          background: `linear-gradient(135deg, ${nextTrack2.color}, ${nextTrack2.color}80)`,
          transform: 'translateY(-14px) scale(.86)', opacity: 0.35, filter: 'blur(1px)',
        }} />
      )}
      {nextTrack1 && (
        <div style={{
          position: 'absolute', width: 360, height: 400, borderRadius: 18,
          background: `linear-gradient(135deg, ${nextTrack1.color}, ${nextTrack1.color}80)`,
          transform: 'translateY(-8px) scale(.93)', opacity: 0.55,
        }} />
      )}

      <div
        onPointerDown={onPointerDown}
        style={{
          position: 'relative', width: 390, height: 410, borderRadius: 20,
          padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${track.color}, ${track.color}80)`,
          transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
          transition: active ? 'none' : 'transform .26s cubic-bezier(.6,.02,.2,1)',
          cursor: active ? 'grabbing' : 'grab',
          boxShadow: '0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08) inset',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 18%, rgba(255,255,255,.25), transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 90%, rgba(0,0,0,.35), transparent 55%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'rgba(255,255,255,.85)', letterSpacing: '.18em', maxWidth: 260 }}>
            ● SEED · {seed.durationSec}s · {seed.hook.toUpperCase()}
          </div>
          {track.album && (
            <span style={{ padding: '3px 8px', background: 'rgba(0,0,0,.3)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 9, color: 'rgba(255,255,255,.85)', letterSpacing: '.08em' }}>
              {track.album}
            </span>
          )}
        </div>

        <div style={{ position: 'relative', marginTop: 'auto' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'rgba(255,255,255,.8)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 8 }}>
            {track.artistName}
          </div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 0.95, color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,.25)' }}>
            {track.title}
          </div>
          {seed.intro && (
            <div style={{ fontFamily: 'var(--f-s)', fontStyle: 'italic', fontSize: 18, color: 'rgba(255,255,255,.85)', marginTop: 14, maxWidth: 300, lineHeight: 1.3 }}>
              {seed.intro}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 36, marginBottom: 10 }}>
            {Array.from({ length: 60 }).map((_, i) => {
              const seeded = ((i * 13 + 7) % 5) / 5;
              const h = 8 + (0.6 + seeded * 0.4) * 28;
              const past = i / 60 < progress;
              return (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: h,
                    background: past ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.28)',
                    borderRadius: 2,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'rgba(255,255,255,.85)', letterSpacing: '.06em', minWidth: 36 }}>
              0:{String(Math.floor(progress * seed.durationSec)).padStart(2, '0')}
            </span>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'rgba(255,255,255,.7)', letterSpacing: '.14em' }}>
              SEED · {seed.durationSec}s of {track.durationLabel}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--f-m)', fontSize: 11, color: '#fff' }}>
              ♡ {track.hypeCount}
            </span>
          </div>
        </div>

        {(['skip', 'save', 'hype'] as const).map((kind) => {
          const opa = kind === 'skip' ? skipOpa : kind === 'save' ? saveOpa : hypeOpa;
          const r = REACTION[kind];
          return (
            <div
              key={kind}
              style={{
                position: 'absolute', top: '40%', left: '50%',
                fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 54, letterSpacing: '-.02em',
                padding: '8px 22px', border: '4px solid', borderRadius: 12, pointerEvents: 'none',
                color: r.color, borderColor: r.color,
                opacity: opa, transform: `translate(-50%,-50%) rotate(${r.rotate}deg) scale(${0.8 + opa * 0.2})`,
              }}
            >
              {r.label}
            </div>
          );
        })}
      </div>

      {flash && flash.track && (
        <div style={{ position: 'absolute', top: 24, right: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--line-2)', borderRadius: 10, background: 'var(--bg-3)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0, background: `linear-gradient(135deg, ${flash.track.color}, ${flash.track.color}80)` }} />
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.16em' }}>SAVED TO QUEUE</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, marginTop: 3, color: 'var(--ink)' }}>{flash.track.title}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)', marginTop: 2 }}>{flash.track.artistName}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionRail({ onSkip, onHype, onSave }: { onSkip: () => void; onHype: () => void; onSave: () => void }) {
  const ROW = { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 12, padding: '14px 18px', borderRadius: 10, border: '1px solid', background: 'transparent', cursor: 'pointer' };
  const STACK = { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'flex-start' as const, gap: 2 };
  const LABEL = { fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.12em', fontWeight: 600 };
  const KEY = { fontFamily: 'var(--f-m)', fontSize: 9, opacity: 0.6, letterSpacing: '.16em' };
  const ICON = { fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, width: 24, display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 8, marginBottom: 22 }}>
      <button type="button" onClick={onSkip} style={{ ...ROW, borderColor: 'rgba(255,80,41,.3)', background: 'rgba(255,80,41,.05)', color: '#ff5029' }}>
        <span style={ICON}>←</span>
        <span style={STACK}><span style={LABEL}>SKIP</span><span style={KEY}>←</span></span>
      </button>
      <button type="button" onClick={onHype} style={{ ...ROW, borderColor: 'rgba(255,62,154,.3)', background: 'rgba(255,62,154,.05)', color: '#ff3e9a' }}>
        <span style={ICON}>♥</span>
        <span style={STACK}><span style={LABEL}>HYPE THE ARTIST</span><span style={KEY}>↑</span></span>
      </button>
      <button type="button" onClick={onSave} style={{ ...ROW, borderColor: 'rgba(34,229,212,.3)', background: 'rgba(34,229,212,.05)', color: '#22e5d4' }}>
        <span style={STACK}><span style={LABEL}>SAVE TO QUEUE</span><span style={KEY}>→</span></span>
        <span style={ICON}>→</span>
      </button>
    </div>
  );
}

function UpNext({ seeds, tracks, cursor }: { seeds: SeedsSwipeStackSeed[]; tracks: Map<string, SeedsSwipeStackTrack>; cursor: number }) {
  const tail = seeds.slice(cursor).concat(seeds.slice(0, cursor));
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, letterSpacing: '-.005em', color: 'var(--ink)' }}>
          Up next · personalized for you
        </div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em' }}>
          Tuned to your HYPE log · {seeds.length} seeds in your pool today
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {tail.slice(0, 5).map((s) => {
          const t = tracks.get(s.trackId);
          if (!t) return null;
          return (
            <div key={s.id}>
              <div style={{ width: '100%', aspectRatio: '1', borderRadius: 6, marginBottom: 8, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }}>
                <span style={{ position: 'absolute', right: 8, top: 8, padding: '3px 8px', background: 'rgba(0,0,0,.55)', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 9, borderRadius: 99, letterSpacing: '.08em' }}>
                  {s.durationSec}s
                </span>
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{t.artistName}</div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, marginTop: 3, color: 'var(--ink)' }}>{t.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
