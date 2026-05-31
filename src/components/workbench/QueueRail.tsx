'use client';

import React from 'react';
import type { WbTrack } from '@/types/workbench';
import { IcDot, IcHeart } from './icons';

export function QueueRail({ tracks, currentIdx, onPick, onClear }: {
  tracks: WbTrack[]; currentIdx: number; onPick: (i: number) => void; onClear?: () => void;
}) {
  const durMin = tracks.reduce((a, t) => a + t.durationSec, 0);
  return (
    <aside style={{
      width: 'var(--queue-w)', borderLeft: '1px solid var(--line-2)',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(10,8,5,0.85)', backdropFilter: 'blur(12px)',
      overflow: 'hidden', gridColumn: 2, gridRow: 2,
    }}>
      {/* Head */}
      <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'rgba(255,255,255,.02)' }}>
        <div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.01em' }}>Queue</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em', marginTop: 4 }}>
            {tracks.length} tracks · {Math.floor(durMin / 60)}m
          </div>
        </div>
        <button
          onClick={() => { if (window.confirm('Clear the queue?')) onClear?.(); }}
          style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer', transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-2)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
        >Clear</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {tracks.map((t, i) => {
          const active = i === currentIdx;
          return (
            <button key={t.id} onClick={() => onPick(i)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, transition: 'background .15s',
              background: active ? `rgba(${parseInt(t.color.slice(1,3),16)},${parseInt(t.color.slice(3,5),16)},${parseInt(t.color.slice(5,7),16)},.07)` : 'transparent',
              border: active ? `1px solid ${t.color}30` : '1px solid transparent',
              cursor: 'pointer', textAlign: 'left',
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.03)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 6, flexShrink: 0, position: 'relative', overflow: 'hidden',
                background: `linear-gradient(135deg, ${t.color}, ${t.color}70)`,
                boxShadow: active ? `0 2px 10px ${t.color}40` : 'none',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.25), transparent 60%)' }} />
                {active && (
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.35)' }}>
                    <IcDot c={t.color} s={6} />
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: active ? 'var(--ink)' : 'var(--ink)' }}>{t.title}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.03em', marginTop: 2 }}>{t.artistName}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{t.duration}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff3e9a' }}>
                  <IcHeart s={9} c="#ff3e9a" /> {t.hypeCount}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 20px 18px', borderTop: '1px solid var(--line)', flexShrink: 0, background: 'rgba(255,255,255,.015)' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '.18em', textTransform: 'uppercase' }}>Curated by</div>
        <div style={{ fontFamily: 'var(--f-s)', fontStyle: 'italic', fontSize: 17, marginTop: 5, color: 'var(--ink-2)' }}>iHYPE · Discovery Queue</div>
      </div>
    </aside>
  );
}
