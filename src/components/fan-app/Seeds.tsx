'use client';

import { useState, useRef, useCallback } from 'react';
import { useApp } from './context';
import { IHYPE_DATA } from '@/lib/data';
import { track } from '@/lib/analytics';

const SEEDS = [
  { artist: 'Nyla', track: 'Goldenrod', tag: 'NEW NEAR YOU', tint: '#22e5d4', grad: 'linear-gradient(135deg,#22e5d4 0%,#0a0805 100%)' },
  { artist: 'Wax Tropic', track: 'Heatwave', tag: 'RISING', tint: '#b983ff', grad: 'linear-gradient(135deg,#b983ff 0%,#0a0805 100%)' },
  { artist: 'Midnight Echo', track: 'Carousel', tag: 'HYPE MOMENT', tint: '#ff5029', grad: 'linear-gradient(135deg,#ff5029 0%,#0a0805 100%)' },
  { artist: 'Sunroom', track: 'Paper Cup', tag: 'TRENDING', tint: '#ffb84a', grad: 'linear-gradient(135deg,#ffb84a 0%,#0a0805 100%)' },
  { artist: 'Cold Harbor', track: 'Tidewater', tag: 'AMBIENT PICK', tint: '#5b8cff', grad: 'linear-gradient(135deg,#5b8cff 0%,#0a0805 100%)' },
];

function CircleBtn({ icon, label, color, bg, onClick }: { icon: React.ReactNode; label: string; color: string; bg: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: bg, border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .15s var(--ease-spring)' }}>
        {icon}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
    </button>
  );
}

export function Seeds() {
  const { useHype, openSheet, toast, prefs } = useApp();
  const [idx, setIdx] = useState(0);
  const [burst, setBurst] = useState(false);
  const dragRef = useRef({ x: 0, y: 0, dragging: false });
  const cardRef = useRef<HTMLDivElement>(null);

  const seed = SEEDS[idx % SEEDS.length];
  const nextSeed = SEEDS[(idx + 1) % SEEDS.length];

  const advance = useCallback(() => setIdx(i => i + 1), []);

  const hype = () => {
    if (!useHype()) {
      toast('Weekly hype budget empty — resets Monday');
      return;
    }
    setBurst(true);
    setTimeout(() => setBurst(false), 800);
    track('hype_seed', { artist: seed.artist, track: seed.track });
    const show = IHYPE_DATA.shows.find(s => s.artist === seed.artist);
    if (show) openSheet('live-event', show);
    else advance();
  };

  const skip = () => { track('skip_seed', { artist: seed.artist }); advance(); };
  const save = () => { track('save_seed', { artist: seed.artist }); toast(`Saved — ${seed.track}`); advance(); };

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, dragging: true };
    if (cardRef.current) cardRef.current.style.transition = 'none';
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    const dx = e.clientX - dragRef.current.x;
    if (cardRef.current) cardRef.current.style.transition = '';
    if (Math.abs(dx) > 60) {
      dx > 0 ? hype() : skip();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingTop: 8 }}>
      {/* Trending marquee */}
      <div style={{ width: '100%', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 18, fontFamily: 'var(--font-mono)', fontSize: '.64rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', animation: 'marquee 20s linear infinite', whiteSpace: 'nowrap' }}>
          {['↑ Midnight Echo', '↑ Wax Tropic', '↑ Nyla', '→ Cold Harbor', '↑ Sunroom', '→ DJ Caro', '↑ Midnight Echo', '↑ Wax Tropic'].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      {/* Card stack */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 340, height: 380 }}>
        {/* Back card */}
        <div style={{ position: 'absolute', inset: 0, top: 12, left: 12, right: -12, borderRadius: 24, background: nextSeed.grad, opacity: .4, transform: 'scale(.96)', pointerEvents: 'none' }} />

        {/* Front card */}
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          style={{ position: 'absolute', inset: 0, borderRadius: 24, background: seed.grad, overflow: 'hidden', cursor: 'grab', userSelect: 'none', touchAction: 'none', transition: 'transform .2s var(--ease-spring)' }}
        >
          {/* Shimmer */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.08) 50%,transparent 100%)', animation: 'shimmer 2s ease-in-out 1', pointerEvents: 'none' }} />

          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 22px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', color: seed.tint, marginBottom: 6, fontWeight: 600 }}>● {seed.tag}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-.02em', lineHeight: 1.1, marginBottom: 4 }}>{seed.track}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '.85rem', color: 'var(--ink-2)', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); openSheet('artist-profile', { artist: seed.artist }); }}>{seed.artist}</div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              {['dream-pop', 'live', 'lo-fi'].map(t => (
                <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: '.62rem', padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,.1)', color: 'var(--ink-2)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Play button */}
          <button onClick={(e) => { e.stopPropagation(); }} style={{ position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: '1.5px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
          </button>

          {/* Burst overlay */}
          {burst && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${seed.tint}`, animation: 'burst .6s ease-out forwards' }} />
            </div>
          )}
        </div>
      </div>

      {/* Swipe hint */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.64rem', letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 }}>
        ← skip · swipe · hype →
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
        <CircleBtn onClick={skip} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>} label="skip" color="var(--ink-3)" bg="var(--bg-raised)" />
        <CircleBtn onClick={hype} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="#ff5029" stroke="#ff5029" strokeWidth="1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>} label="hype" color="var(--accent)" bg="rgba(255,80,41,.15)" />
        <CircleBtn onClick={save} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>} label="save" color="var(--role-fan)" bg="rgba(185,131,255,.12)" />
      </div>

      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}
