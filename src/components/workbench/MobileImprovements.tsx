'use client';
import React, { useState, useEffect, useRef } from 'react';
import { T } from './MobilePrimitives';
import type { WorkbenchData } from '@/types/workbench';

// ─── HypeFab — thumb-reachable hype action ────────────────────
export function HypeFab({ onHype, disabled, bottom = 150 }: { onHype?: () => void; disabled?: boolean; bottom?: number }) {
  const [pop, setPop] = useState(false);

  function fire() {
    if (disabled) { onHype?.(); return; }
    setPop(true);
    setTimeout(() => setPop(false), 360);
    onHype?.();
  }

  return (
    <button onClick={fire} aria-label="Hype" style={{
      position: 'absolute', right: 16, bottom, zIndex: 55,
      display: 'inline-flex', alignItems: 'center', gap: 9,
      padding: '0 18px 0 6px', height: 56, borderRadius: 999,
      border: 'none', cursor: 'pointer', color: '#fff',
      background: disabled ? T.bg4 : T.accent,
      boxShadow: disabled ? 'none' : '0 4px 20px rgba(255,80,41,.4), 0 10px 26px rgba(0,0,0,.4)',
      transition: 'background .2s',
    }}>
      <span style={{
        width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: 'rgba(255,255,255,.16)',
        transform: pop ? 'scale(1.18)' : 'scale(1)',
        transition: 'transform .18s cubic-bezier(.34,1.56,.64,1)',
      }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/></svg>
      </span>
      <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', color: disabled ? T.ink3 : '#fff' }}>Hype</span>
    </button>
  );
}

// ─── HypeMeter — weekly hype budget strip ─────────────────────
export function HypeMeter({ hypesLeft = 0, total = 5, onTap }: { hypesLeft?: number; total?: number; onTap?: () => void }) {
  const spent = hypesLeft <= 0;
  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 16px', background: T.bg2, borderTop: `1px solid ${T.line}`,
      border: 'none', cursor: 'pointer', color: T.ink, flexShrink: 0, textAlign: 'left',
    }}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill={spent ? T.ink3 : T.accent}><path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/></svg>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i < hypesLeft ? T.accent : 'transparent',
            border: i < hypesLeft ? 'none' : `1.5px solid ${T.line2}`,
            boxShadow: i < hypesLeft ? '0 0 8px rgba(255,80,41,.5)' : 'none',
          }} />
        ))}
      </span>
      <span style={{ flex: 1, fontFamily: T.fm, fontSize: 11, letterSpacing: '.02em', color: T.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {spent
          ? 'Out of hype — resets Mon'
          : <><b style={{ color: T.ink }}>{hypesLeft}</b> left this week · resets Mon</>
        }
      </span>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}

// ─── OfflineBanner ────────────────────────────────────────────
export function OfflineBanner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 18px 1rem', padding: '.6rem .85rem', borderRadius: 14, border: `1px solid ${T.line2}`, background: T.bg4 }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,184,74,.14)', color: T.amber }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v1.5M12 20.5V22M2 12h1.5M20.5 12H22"/></svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.fb, fontWeight: 700, fontSize: 12.5, color: T.ink }}>Offline</div>
        <div style={{ fontFamily: T.fm, fontSize: 10.5, color: T.ink2 }}>Your tickets still work without signal.</div>
      </div>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5L20 7"/></svg>
    </div>
  );
}

// ─── SeedsOnHome — discovery doorway on the home screen ───────
export function SeedsOnHome({ data, onOpen }: { data: WorkbenchData; onOpen: () => void }) {
  const seeds = data.tracks.slice(0, 4);
  return (
    <div style={{ margin: '0 0 1.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 18px .7rem' }}>
        <div>
          <div style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.purple, marginBottom: 3 }}>Seed your feed</div>
          <h2 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', margin: 0 }}>Picks for tonight</h2>
        </div>
        <button onClick={onOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontFamily: T.fm, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>
          Start swiping
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14m-5-6 5 6-5 6"/></svg>
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 18px 4px', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
        {seeds.map((s, i) => (
          <button key={s.id} onClick={onOpen} style={{ flexShrink: 0, width: 132, scrollSnapAlign: 'start', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <span style={{ display: 'block', width: 132, height: 132, borderRadius: 16, background: `linear-gradient(150deg,${s.color},#1a1612 92%)`, position: 'relative', overflow: 'hidden', border: `1px solid ${T.line}` }}>
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="rgba(255,255,255,.92)"><path d="M6 4l14 8L6 20z"/></svg>
              </span>
              <span style={{ position: 'absolute', left: 8, top: 8, padding: '2px 7px', borderRadius: 999, background: 'rgba(10,8,5,.5)', backdropFilter: 'blur(4px)', fontFamily: T.fm, fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff' }}>0:30</span>
            </span>
            <div style={{ fontFamily: T.fb, fontWeight: 700, fontSize: 13, color: T.ink, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.artistName}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── LiveActivityPlus — countdown to doors ────────────────────
export function LiveActivityPlus({ show, onOpen }: { show?: { name: string; venue: string; minutesUntilDoors: number } | null; onOpen?: () => void }) {
  if (!show) return null;
  const horizon = show.minutesUntilDoors * 60;
  const target = useRef(Date.now() + horizon * 1000);
  const [left, setLeft] = useState(horizon);

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.round((target.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = Math.floor(left / 3600);
  const mm = Math.floor((left % 3600) / 60);
  const ss = left % 60;
  const clock = `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const pct = 1 - left / horizon;

  return (
    <button onClick={onOpen} style={{
      display: 'block', width: 'calc(100% - 2.3rem)', margin: '0 18px 1rem',
      padding: '.85rem .95rem .9rem', borderRadius: 18, cursor: 'pointer',
      border: '1px solid rgba(255,60,60,.32)',
      background: 'linear-gradient(135deg,rgba(255,60,60,.16),rgba(255,80,41,.04))',
      color: T.ink, textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg,#ff3c3c,#ff5029)', display: 'grid', placeItems: 'center', color: '#fff' }}>
          <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 6a1.5 1.5 0 0 0 0 3v3h12V9a1.5 1.5 0 0 0 0-3V3H2v3Z"/><path d="M9 3v10" strokeDasharray="1.4 1.4"/></svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#ff3c3c' }} />
            <span style={{ fontFamily: T.fm, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#ff3c3c', whiteSpace: 'nowrap' }}>Tonight · live</span>
          </div>
          <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em' }}>{show.name} · {show.venue}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3 }}>doors in</div>
          <div style={{ fontFamily: T.fm, fontWeight: 700, fontSize: 17, color: T.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '.01em' }}>{clock}</div>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.08)', marginTop: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 999, background: `linear-gradient(90deg,${T.accent},${T.pink})` }} />
      </div>
    </button>
  );
}
