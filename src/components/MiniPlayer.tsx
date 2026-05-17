'use client';

import { useEffect, useState } from 'react';
import { playerStore } from '@/lib/player-store';

export function MiniPlayer() {
  const [state, setState] = useState(() => playerStore.get());

  useEffect(() => {
    setState(playerStore.get());
    const unsub = playerStore.subscribe(() => setState(playerStore.get()));
    return () => { unsub(); };
  }, []);

  if (!state) return null;

  function togglePlay() {
    if (!state) return;
    playerStore.set({ ...state, isPlaying: !state.isPlaying });
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(56px + env(safe-area-inset-bottom))',
        left: 0,
        right: 0,
        zIndex: 200,
        background: 'var(--panel, rgba(16,13,9,.95))',
        borderTop: '1px solid var(--line)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--line)' }}>
        <div
          style={{
            height: '100%',
            width: `${(state.progress ?? 0) * 100}%`,
            background: 'var(--accent, #ff5029)',
            transition: 'width 1s linear',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {state.trackTitle}
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {state.artistName}
          </div>
        </div>
        <button
          onClick={togglePlay}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--accent, #ff5029)',
            border: 'none',
            color: '#fff',
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
        >
          {state.isPlaying ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  );
}
