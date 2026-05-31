'use client';

import React from 'react';
import type { WbTrack } from '@/types/workbench';
import { IcPlay, IcHeart } from './icons';

export function Panel({ title, link, onLink, children, style }: {
  title: string; link?: string; onLink?: () => void; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section style={{
      border: '1px solid var(--line-2)', borderRadius: 12,
      background: 'var(--bg-2)', overflow: 'hidden',
      boxShadow: '0 2px 16px rgba(0,0,0,.28)',
      ...style
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--line)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(255,255,255,.02)',
      }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', color: 'var(--ink)' }}>{title}</div>
        {link && <button onClick={onLink} style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.12em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer', transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-2)')}
        >{link}</button>}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, delta, color }: { label: string; value: string; delta: string; color: string }) {
  return (
    <div style={{
      padding: '16px 18px', border: '1px solid var(--line-2)', borderRadius: 12,
      background: 'var(--bg-2)', position: 'relative', overflow: 'hidden',
      boxShadow: '0 2px 16px rgba(0,0,0,.22)',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.025) 0%, transparent 50%)', pointerEvents: 'none' }} />
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-d)', fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.02em', marginTop: 8, color }}>{delta}</div>
    </div>
  );
}

export function TrackCard({ track, active, onClick }: { track: WbTrack; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: 9, border: `1px solid ${active ? track.color + '80' : 'var(--line-2)'}`,
      borderRadius: 10, background: active ? 'var(--bg-2)' : 'var(--bg-3)', textAlign: 'left',
      transition: 'border-color .2s, box-shadow .2s, transform .15s', cursor: 'pointer', width: '100%',
      boxShadow: active ? `0 4px 20px ${track.color}28, 0 2px 8px rgba(0,0,0,.25)` : '0 1px 6px rgba(0,0,0,.18)',
      transform: active ? 'translateY(-1px)' : 'none',
    }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.3)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-2)'; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 6px rgba(0,0,0,.18)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-2)'; } }}
    >
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 7, marginBottom: 9, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}70)` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,.28), transparent 65%)' }} />
        <div style={{ position: 'absolute', left: 10, bottom: 10, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.3)' }}>
          <IcPlay s={12} />
        </div>
        <div style={{ position: 'absolute', right: 8, top: 8, padding: '3px 7px', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff3e9a', display: 'flex', alignItems: 'center', gap: 3 }}>
          <IcHeart s={10} c="#ff3e9a" /> {track.hypeCount}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, letterSpacing: '-.01em', color: 'var(--ink)' }}>{track.title}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{track.artistName} · {track.duration}</div>
    </button>
  );
}
