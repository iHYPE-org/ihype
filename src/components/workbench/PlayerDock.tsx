'use client';

import React, { useState } from 'react';
import type { WbTrack } from '@/components/WorkbenchShell';
import { IcHeart, IcShuffle, IcSkipP, IcPause, IcPlay, IcSkipN, IcRepeat, IcQueue, IcVol } from './icons';
import { fmtTime } from './types';

export function PlayerDock({ track, playing, onToggle, onNext, onPrev, progress, onSeek, setProgress }: {
  track: WbTrack; playing: boolean; onToggle: () => void;
  onNext: () => void; onPrev: () => void;
  progress: number;
  /** Preferred seek handler (seeks real audio + updates progress). Falls back to setProgress. */
  onSeek?: (ratio: number) => void;
  /** @deprecated Pass onSeek instead */
  setProgress?: (p: number) => void;
}) {
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  return (
    <footer style={{
      display: 'grid', gridTemplateColumns: '340px 1fr 340px', alignItems: 'center', gap: 24, padding: '0 22px',
      background: 'linear-gradient(180deg, var(--bg-2), var(--bg))',
      borderTop: '1px solid var(--line-2)', position: 'relative',
      gridColumn: '1 / -1',
    }}>
      {/* Top gradient accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), #ff3e9a, transparent)', opacity: .5, pointerEvents: 'none' }} />

      {/* Left: 340px — art + info + hype */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: 7, flexShrink: 0, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}80)` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.3), transparent 60%)' }} />
          {playing && (
            <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 2, alignItems: 'flex-end', height: 10, zIndex: 2 }}>
              {[{ dur: '1.1s' }, { dur: '.9s' }, { dur: '1.3s' }].map((b, i) => (
                <i key={i} style={{ width: 2, background: '#fff', borderRadius: 99, display: 'block', height: 3, animation: `eq ${b.dur} infinite` }} />
              ))}
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, letterSpacing: '-.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{track.title}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.04em', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artistName} · <span style={{ color: 'var(--ink-4)' }}>{track.album}</span></div>
        </div>
        <button aria-label="Hype this track" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid rgba(255,62,154,.3)', borderRadius: 99, color: '#ff3e9a', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 600, background: 'rgba(255,62,154,.05)', cursor: 'pointer', flexShrink: 0 }}>
          <IcHeart s={14} c="#ff3e9a" /> {track.hypeCount}
        </button>
      </div>

      {/* Center: controls + scrub */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button title="Shuffle" aria-label="Shuffle" style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcShuffle s={14} /></button>
          <button title="Previous" aria-label="Previous track" onClick={onPrev} style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcSkipP s={14} /></button>
          <button onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
            {playing ? <IcPause s={14} /> : <IcPlay s={14} />}
          </button>
          <button title="Next" aria-label="Next track" onClick={onNext} style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcSkipN s={14} /></button>
          <button title="Repeat" aria-label="Repeat" style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcRepeat s={14} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 540 }}>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', minWidth: 34, textAlign: 'center' }}>{fmtTime(progress * track.durationSec)}</span>
          <div
            style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 99, position: 'relative', cursor: 'pointer', overflow: 'visible' }}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
              if (onSeek) onSeek(ratio);
              else if (setProgress) setProgress(ratio);
            }}
          >
            <div style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: 'linear-gradient(90deg, var(--accent), #ff3e9a)', borderRadius: 99 }} />
            <div style={{ position: 'absolute', top: '50%', left: `${progress * 100}%`, transform: 'translate(-50%, -50%)', width: 11, height: 11, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,.15)' }} />
          </div>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', minWidth: 34, textAlign: 'center' }}>{track.duration}</span>
        </div>
      </div>

      {/* Right: 340px — queue + vol */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
        <button title="Queue" aria-label="Queue" style={{ width: 32, height: 32, borderRadius: 7, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcQueue s={14} /></button>
        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => setMuted(m => !m)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted ? 'var(--ink-3)' : 'var(--ink-2)', display: 'flex', alignItems: 'center', padding: 4 }}
          >
            <IcVol s={16} />
          </button>
          <div style={{ position: 'relative', width: 72, height: 3, background: 'var(--bg-4)', borderRadius: 99, cursor: 'pointer' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setVolume(v);
              setMuted(false);
            }}
          >
            <div style={{ height: '100%', width: `${(muted ? 0 : volume) * 100}%`, background: 'var(--accent)', borderRadius: 99 }} />
          </div>
        </div>
      </div>
    </footer>
  );
}
