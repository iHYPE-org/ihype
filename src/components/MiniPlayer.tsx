'use client';

import { useEffect, useRef, useState } from 'react';
import { playerStore } from '@/lib/player-store';
import { updateMediaSession } from '@/lib/media-session';

export function MiniPlayer() {
  const [state, setState] = useState(() => playerStore.get());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 5. Unlock audio context on first touch (iOS background audio)
    function unlockAudio() {
      audioRef.current?.play().catch(() => {});
      document.removeEventListener('touchstart', unlockAudio);
    }
    document.addEventListener('touchstart', unlockAudio, { once: true });
    return () => document.removeEventListener('touchstart', unlockAudio);
  }, []);

  useEffect(() => {
    // 6. Media Session API
    updateMediaSession(playerStore.get());
    setState(playerStore.get());
    const unsub = playerStore.subscribe(() => {
      setState(playerStore.get());
      updateMediaSession(playerStore.get());
    });
    return () => { unsub(); };
  }, []);

  if (!state) return null;

  function togglePlay() {
    if (!state) return;
    playerStore.set({ ...state, isPlaying: !state.isPlaying });
  }

  return (
    <div
      className="ihype-mini-player"
      style={{
        position: 'fixed',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        left: 0,
        right: 0,
        zIndex: 901,
        background: 'var(--panel, rgba(16,13,9,.95))',
        borderTop: '1px solid var(--line)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .ihype-mini-player {
            bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important;
          }
        }
      `}</style>
      {/* 5. Hidden audio element for iOS background audio unlock */}
      <audio ref={audioRef} playsInline style={{ display: 'none' }} />
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
