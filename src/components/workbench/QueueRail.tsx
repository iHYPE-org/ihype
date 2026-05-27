'use client';

import React from 'react';
import type { WbTrack } from '@/components/WorkbenchShell';
import { IcDot, IcHeart } from './icons';

export function QueueRail({ tracks, currentIdx, onPick, onClear }: {
  tracks: WbTrack[]; currentIdx: number; onPick: (i: number) => void; onClear?: () => void;
}) {
  const durMin = tracks.reduce((a, t) => a + t.durationSec, 0);
  return (
    <aside style={{
      width: 'var(--queue-w)', borderLeft: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden',
      gridColumn: 3, gridRow: 2,
    }}>
      {/* Head */}
      <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em' }}>Queue</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>
            {tracks.length} tracks · {Math.floor(durMin / 60)}m
          </div>
        </div>
        <button
          onClick={() => { if (window.confirm('Clear the queue?')) onClear?.(); }}
          style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.1em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}
        >Clear</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {tracks.map((t, i) => {
          const active = i === currentIdx;
          return (
            <button key={t.id} onClick={() => onPick(i)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 6, transition: 'background .15s',
              background: active ? 'rgba(255,255,255,.04)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 4, flexShrink: 0, position: 'relative',
                background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`,
              }}>
                {active && (
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)' }}>
                    <IcDot c={t.color} s={6} />
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{t.title}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 2 }}>{t.artistName}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff3e9a' }}>
                <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', width: 30, textAlign: 'right' }}>{t.duration}</div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 20px 18px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em' }}>CURATED BY</div>
        <div style={{ fontFamily: 'var(--f-s)', fontStyle: 'italic', fontSize: 18, marginTop: 4, color: 'var(--ink)' }}>iHYPE · Discovery Queue</div>
      </div>
    </aside>
  );
}
