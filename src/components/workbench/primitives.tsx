'use client';

import React from 'react';
import type { WbTrack } from '@/components/WorkbenchShell';
import { IcPlay, IcHeart } from './icons';

export function Panel({ title, link, onLink, children, style }: {
  title: string; link?: string; onLink?: () => void; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden', ...style }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, letterSpacing: '-.005em', color: 'var(--ink)' }}>{title}</div>
        {link && <button onClick={onLink} style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.1em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>{link}</button>}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, delta, color }: { label: string; value: string; delta: string; color: string }) {
  return (
    <div style={{ padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.16em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-d)', fontSize: 26, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--ink)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.02em', marginTop: 6, color }}>{delta}</div>
    </div>
  );
}

export function TrackCard({ track, active, onClick }: { track: WbTrack; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: 8, border: `1px solid ${active ? track.color : 'var(--line)'}`,
      borderRadius: 8, background: 'var(--bg-3)', textAlign: 'left',
      transition: 'border-color .2s', cursor: 'pointer', width: '100%',
    }}>
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 5, marginBottom: 8, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}80)` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,.25), transparent 65%)' }} />
        <div style={{ position: 'absolute', left: 10, bottom: 10, width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IcPlay s={12} />
        </div>
        <div style={{ position: 'absolute', right: 8, top: 8, padding: '2px 7px', background: 'rgba(0,0,0,.5)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff3e9a', display: 'flex', alignItems: 'center', gap: 3 }}>
          <IcHeart s={10} c="#ff3e9a" /> {track.hypeCount}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, letterSpacing: '-.005em', color: 'var(--ink)' }}>{track.title}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{track.artistName} · {track.duration}</div>
    </button>
  );
}
