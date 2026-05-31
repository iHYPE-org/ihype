'use client';

import React from 'react';
import type { MediaTrack } from '@/components/GlobalMediaPlayer';

type DockPanel = 'queue' | 'history' | null;

const btnBase: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px 4px',
};

interface PlayerQueuePanelProps {
  panel: DockPanel;
  setPanel: (p: DockPanel) => void;
  upcomingTracks: MediaTrack[];
  history: MediaTrack[];
  isAutoplay: boolean;
  toggleAutoplay: () => void;
  playTrack: (track: MediaTrack, queue?: MediaTrack[]) => void;
  removeFromQueue: (id: string) => void;
  queue: MediaTrack[];
}

export function PlayerQueuePanel({
  panel,
  setPanel,
  upcomingTracks,
  history,
  isAutoplay,
  toggleAutoplay,
  playTrack,
  removeFromQueue,
  queue,
}: PlayerQueuePanelProps) {
  if (panel === null) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '100%', right: 0, width: 300, maxHeight: 340,
      display: 'flex', flexDirection: 'column',
      background: 'var(--surface-1, #1a1714)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px 8px 0 0', zIndex: 10,
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {(['queue', 'history'] as DockPanel[]).map(p => (
          <button
            key={p}
            onClick={() => setPanel(p)}
            style={{
              ...btnBase, flex: 1, padding: '6px 8px', fontSize: '0.68rem',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              opacity: panel === p ? 1 : 0.4,
              borderBottom: panel === p ? '2px solid var(--accent, #ff5029)' : '2px solid transparent',
              fontWeight: panel === p ? 700 : 400,
            }}
            type="button"
          >
            {p === 'queue' ? `Up next (${upcomingTracks.length})` : `History (${history.length})`}
          </button>
        ))}
        <button onClick={() => setPanel(null)} style={{ ...btnBase, padding: '6px 10px', opacity: 0.4, fontSize: '0.8rem' }} type="button">✕</button>
      </div>

      {/* Content */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '0.4rem' }}>
        {panel === 'queue' && (
          upcomingTracks.length === 0
            ? <p style={{ fontSize: '0.75rem', opacity: 0.4, margin: '0.5rem 0.25rem' }}>{isAutoplay ? 'Radio will load more when queue ends.' : 'Queue is empty.'}</p>
            : upcomingTracks.map((track, i) => (
              <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px', borderRadius: 4 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '0.6rem', opacity: 0.35, width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => playTrack(track, queue)}>
                  <div style={{ fontSize: '0.77rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                  <div style={{ fontSize: '0.67rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artistName}</div>
                </div>
                <button onClick={() => removeFromQueue(track.id)} style={{ ...btnBase, opacity: 0.3, fontSize: '0.65rem' }} title="Remove" type="button">✕</button>
              </div>
            ))
        )}
        {panel === 'history' && (
          history.length === 0
            ? <p style={{ fontSize: '0.75rem', opacity: 0.4, margin: '0.5rem 0.25rem' }}>Nothing played yet this session.</p>
            : history.map((track, i) => (
              <div key={`${track.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px', borderRadius: 4 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '0.6rem', opacity: 0.35, width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => playTrack(track)}>
                  <div style={{ fontSize: '0.77rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                  <div style={{ fontSize: '0.67rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artistName}</div>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Autoplay toggle footer (queue panel only) */}
      {panel === 'queue' && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>Autoplay radio</span>
          <button
            onClick={toggleAutoplay}
            type="button"
            style={{ ...btnBase, fontSize: '0.68rem', fontWeight: 700, opacity: isAutoplay ? 1 : 0.4, color: isAutoplay ? 'var(--accent, #ff5029)' : 'inherit' }}
          >
            {isAutoplay ? 'On' : 'Off'}
          </button>
        </div>
      )}
    </div>
  );
}
