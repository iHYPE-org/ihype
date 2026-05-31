'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Registers global keyboard shortcuts for the media player.
 * Must be called inside a Client Component / hook context.
 *
 * Shortcuts (skipped when focus is in an input/textarea/select):
 *   Space     → toggle play/pause
 *   ←         → seek back 10 s
 *   →         → seek forward 10 s
 *   N         → skip to next track
 *   P         → skip to previous track (or restart if >4 s in)
 *   M         → toggle mute
 */
export function usePlayerKeyboard(
  audioRef: RefObject<HTMLAudioElement | null>,
  handlers: {
    togglePlayPause: () => void;
    skipNext: () => void;
    skipPrevious: () => void;
    toggleMute: () => void;
    setCurrentTime: (t: number) => void;
  },
) {
  const { togglePlayPause, skipNext, skipPrevious, toggleMute, setCurrentTime } = handlers;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const a = audioRef.current;
        if (a) { a.currentTime = Math.max(0, a.currentTime - 10); setCurrentTime(a.currentTime); }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const a = audioRef.current;
        if (a && Number.isFinite(a.duration)) { a.currentTime = Math.min(a.duration, a.currentTime + 10); setCurrentTime(a.currentTime); }
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        skipNext();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        const a = audioRef.current;
        if (a && a.currentTime > 4) { a.currentTime = 0; setCurrentTime(0); return; }
        skipPrevious();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [audioRef, togglePlayPause, skipNext, skipPrevious, toggleMute, setCurrentTime]);
}
