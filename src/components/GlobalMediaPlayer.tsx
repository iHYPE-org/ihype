'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import Image from 'next/image';
import { FanPlaylistManager } from '@/components/FanPlaylistManager';
import { PlayerQueuePanel } from '@/components/PlayerQueuePanel';
import { usePlayerKeyboard } from '@/lib/usePlayerKeyboard';

export type MediaTrack = {
  id: string;
  title: string;
  artistName: string;
  url: string;
  mediaId?: string | null;
  artistProfileSlug?: string | null;
  notes?: string | null;
  artworkUrl?: string | null;
  shareUrl?: string | null;
};

export type RepeatMode = 'off' | 'one' | 'all';

const SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const;
const SLEEP_PRESETS = [15, 30, 45, 60] as const; // minutes

type MediaPlayerStableValue = {
  currentTrack: MediaTrack | null;
  canGoBack: boolean;
  canGoForward: boolean;
  queue: MediaTrack[];
  currentIndex: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isMuted: boolean;
  isAutoplay: boolean;
  playbackRate: number;
  sleepMinutes: number | null;
  history: MediaTrack[];
  playTrack: (track: MediaTrack, queue?: MediaTrack[]) => void;
  addToQueue: (track: MediaTrack) => void;
  removeFromQueue: (id: string) => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  cycleSpeed: () => void;
  toggleMute: () => void;
  toggleAutoplay: () => void;
  cycleSleepTimer: () => void;
  cancelSleepTimer: () => void;
};

type MediaPlayerVolatileValue = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  sleepRemainingSeconds: number | null;
};

type MediaPlayerContextValue = MediaPlayerStableValue & MediaPlayerVolatileValue;

const MediaPlayerStableCtx = createContext<MediaPlayerStableValue | null>(null);
const MediaPlayerVolatileCtx = createContext<MediaPlayerVolatileValue>({
  currentTime: 0, duration: 0, isPlaying: false, volume: 0.85, sleepRemainingSeconds: null
});
const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null);

type PersistedPlayerState = {
  queue: MediaTrack[];
  currentIndex: number;
  currentTrack: MediaTrack | null;
  volume: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  playbackRate: number;
  isAutoplay: boolean;
  isMuted: boolean;
};

const STORAGE_KEY = 'ihype-global-media-player';

function shuffleAfter<T>(arr: T[], fromIndex: number): T[] {
  const head = arr.slice(0, fromIndex + 1);
  const tail = arr.slice(fromIndex + 1);
  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tail[i], tail[j]] = [tail[j], tail[i]];
  }
  return [...head, ...tail];
}

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const completedMediaIdsRef = useRef<Set<string>>(new Set());
  const originalQueueRef = useRef<MediaTrack[]>([]);
  const preMuteVolumeRef = useRef(0.85);
  const autoplayFetchingRef = useRef(false);

  const [queue, setQueue] = useState<MediaTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTrack, setCurrentTrack] = useState<MediaTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [history, setHistory] = useState<MediaTrack[]>([]);

  // Sleep timer
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState<number | null>(null);
  const sleepEndTimeRef = useRef<number | null>(null);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  usePlayerKeyboard(audioRef, {
    togglePlayPause: useCallback(() => {
      setCurrentTrack(t => { if (t) setIsPlaying(v => !v); return t; });
    }, []),
    skipNext: useCallback(() => {
      setQueue(prev => { setCurrentIndex(ci => { const n = ci >= 0 && ci < prev.length - 1 ? ci + 1 : ci; if (n !== ci) { setCurrentTrack(prev[n] ?? null); setIsPlaying(true); } return n; }); return prev; });
    }, []),
    skipPrevious: useCallback(() => {
      setQueue(prev => { setCurrentIndex(ci => { const p = ci > 0 ? ci - 1 : ci; if (p !== ci) { setCurrentTrack(prev[p] ?? null); setIsPlaying(true); } return p; }); return prev; });
    }, []),
    toggleMute: useCallback(() => {
      setIsMuted(m => {
        const next = !m;
        const a = audioRef.current;
        if (a) a.volume = next ? 0 : preMuteVolumeRef.current;
        return next;
      });
    }, []),
    setCurrentTime,
  });

  // ── Restore persisted state ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as PersistedPlayerState;
      setQueue(p.queue ?? []);
      setCurrentIndex(p.currentIndex ?? -1);
      setCurrentTrack(p.currentTrack ?? null);
      const vol = p.volume ?? 0.85;
      setVolumeState(vol);
      preMuteVolumeRef.current = vol;
      if (p.repeatMode) setRepeatModeState(p.repeatMode);
      if (typeof p.isShuffle === 'boolean') setIsShuffle(p.isShuffle);
      if (p.playbackRate) setPlaybackRateState(p.playbackRate);
      if (typeof p.isAutoplay === 'boolean') setIsAutoplay(p.isAutoplay);
      if (typeof p.isMuted === 'boolean') setIsMuted(p.isMuted);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // ── Persist state ──────────────────────────────────────────────────────────
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const payload: PersistedPlayerState = {
        queue: queue.map(({ id, title, artistName, url, artistProfileSlug }) => ({ id, title, artistName, url, artistProfileSlug })) as MediaTrack[],
        currentIndex,
        currentTrack: currentTrack ? { id: currentTrack.id, title: currentTrack.title, artistName: currentTrack.artistName, url: currentTrack.url, artistProfileSlug: currentTrack.artistProfileSlug } as MediaTrack : null,
        volume, repeatMode, isShuffle, playbackRate, isAutoplay, isMuted
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, 500);
  }, [queue, currentIndex, currentTrack, volume, repeatMode, isShuffle, playbackRate, isAutoplay, isMuted]);

  // ── Volume / mute sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // ── Playback rate sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = playbackRate;
  }, [playbackRate]);

  // ── Sleep timer countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (sleepMinutes === null) {
      sleepEndTimeRef.current = null;
      setSleepRemainingSeconds(null);
      return;
    }
    sleepEndTimeRef.current = Date.now() + sleepMinutes * 60 * 1000;
    setSleepRemainingSeconds(sleepMinutes * 60);
    const interval = setInterval(() => {
      const end = sleepEndTimeRef.current;
      if (!end) { clearInterval(interval); return; }
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(interval);
        setSleepMinutes(null);
        setSleepRemainingSeconds(null);
        sleepEndTimeRef.current = null;
        setIsPlaying(false);
      } else {
        setSleepRemainingSeconds(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepMinutes]);

  // ── Preload next track ─────────────────────────────────────────────────────
  useEffect(() => {
    const pre = preloadRef.current;
    if (!pre) return;
    const nextUrl = queue[currentIndex + 1]?.url;
    if (nextUrl && nextUrl !== pre.src) {
      pre.src = nextUrl;
      pre.preload = 'auto';
      pre.load();
    } else if (!nextUrl) {
      pre.removeAttribute('src');
      pre.load();
    }
  }, [currentIndex, queue]);

  // ── Media Session API ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!currentTrack) { navigator.mediaSession.metadata = null; return; }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artistName,
      artwork: currentTrack.artworkUrl
        ? [
            { src: currentTrack.artworkUrl, sizes: '512x512', type: 'image/jpeg' },
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          ]
        : [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    });
    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const a = audioRef.current;
      if (a && a.currentTime > 4) { a.currentTime = 0; setCurrentTime(0); return; }
      setQueue(prev => { setCurrentIndex(ci => { const p = ci > 0 ? ci - 1 : ci; if (p !== ci) { setCurrentTrack(prev[p] ?? null); setIsPlaying(true); } return p; }); return prev; });
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      setQueue(prev => { setCurrentIndex(ci => { const n = ci >= 0 && ci < prev.length - 1 ? ci + 1 : ci; if (n !== ci) { setCurrentTrack(prev[n] ?? null); setIsPlaying(true); } return n; }); return prev; });
    });
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      const a = audioRef.current;
      if (a && d.seekTime != null) { a.currentTime = d.seekTime; setCurrentTime(d.seekTime); }
    });
    navigator.mediaSession.setActionHandler('seekforward', (d) => {
      const a = audioRef.current;
      if (a) { a.currentTime = Math.min(a.duration || 0, a.currentTime + (d.seekOffset ?? 10)); setCurrentTime(a.currentTime); }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (d) => {
      const a = audioRef.current;
      if (a) { a.currentTime = Math.max(0, a.currentTime - (d.seekOffset ?? 10)); setCurrentTime(a.currentTime); }
    });
  }, [currentTrack]);

  // ── Track history ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return;
    setHistory(prev => {
      // Avoid duplicating the most-recent entry when pausing/resuming
      if (prev[0]?.id === currentTrack.id) return prev;
      return [currentTrack, ...prev].slice(0, 30);
    });
  }, [currentTrack]);

  // ── Autoplay radio fetch ───────────────────────────────────────────────────
  function fetchRadioTracks(existingQueue: MediaTrack[], afterIndex: number) {
    if (autoplayFetchingRef.current) return;
    autoplayFetchingRef.current = true;
    const excludeIds = existingQueue.map(t => t.mediaId).filter(Boolean).join(',');
    void fetch(`/api/radio?exclude=${encodeURIComponent(excludeIds)}`)
      .then(r => r.json())
      .then(data => {
        const radioTracks: MediaTrack[] = (data.tracks ?? []).map((t: {
          hexId: string; title: string; notes: string | null;
          url: string; artistName: string; artistSlug: string; artworkUrl: string | null;
        }) => ({
          id: `radio-${t.hexId}`,
          title: t.title,
          artistName: t.artistName,
          url: t.url,
          mediaId: t.hexId,
          artistProfileSlug: t.artistSlug,
          notes: t.notes,
          artworkUrl: t.artworkUrl,
          shareUrl: `/artists/${t.artistSlug}`
        }));
        if (radioTracks.length > 0) {
          setQueue(q => [...q, ...radioTracks.filter(rt => !q.some(qt => qt.id === rt.id))]);
          // Auto-start the first radio track
          setCurrentIndex(afterIndex + 1);
          setCurrentTrack(radioTracks[0] ?? null);
          setIsPlaying(true);
        }
      })
      .catch(() => {})
      .finally(() => { autoplayFetchingRef.current = false; });
  }

  // ── Audio event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncTime = () => {
      setCurrentTime(audio.currentTime);
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && Number.isFinite(audio.duration) && audio.duration > 0) {
        navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: audio.currentTime });
      }
      if (currentTrack?.mediaId && Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime / audio.duration >= 0.9) {
        persistCompletedMediaListen(currentTrack);
      }
    };
    const syncDuration = () => setDuration(audio.duration || 0);
    const syncPlay = () => { setIsPlaying(true); if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; };
    const syncPause = () => { setIsPlaying(false); if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; };

    const onEnded = () => {
      persistCompletedMediaListen(currentTrack);
      setCurrentTime(0);

      if (repeatMode === 'one') {
        audio.currentTime = 0;
        void audio.play().catch(() => setIsPlaying(false));
        return;
      }

      setIsPlaying(false);
      setCurrentIndex(index => {
        const hasNext = index >= 0 && index < queue.length - 1;
        if (hasNext) {
          const next = index + 1;
          setCurrentTrack(queue[next] ?? null);
          setIsPlaying(true);
          return next;
        }
        if (repeatMode === 'all' && queue.length > 0) {
          setCurrentTrack(queue[0] ?? null);
          setIsPlaying(true);
          return 0;
        }
        // Queue exhausted — fetch radio tracks if autoplay is on
        if (isAutoplay) fetchRadioTracks(queue, index);
        return index;
      });
    };

    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('play', syncPlay);
    audio.addEventListener('pause', syncPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('play', syncPlay);
      audio.removeEventListener('pause', syncPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack, queue, repeatMode, isAutoplay]);

  // ── Playback control ───────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    if (audio.src !== currentTrack.url) {
      const pre = preloadRef.current;
      if (pre && pre.src === currentTrack.url && pre.readyState >= 2) {
        audio.src = pre.src;
        audio.currentTime = 0;
      } else {
        audio.src = currentTrack.url;
      }
      audio.load();
      audio.playbackRate = playbackRate;
      audio.volume = isMuted ? 0 : volume;
      setCurrentTime(0);
    }
    if (isPlaying) {
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  function persistCompletedMediaListen(track: MediaTrack | null) {
    if (!track?.mediaId) return;
    if (completedMediaIdsRef.current.has(track.mediaId)) return;
    completedMediaIdsRef.current.add(track.mediaId);
    void fetch('/api/media-listens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: track.mediaId, title: track.title, mediaUrl: track.url, artistName: track.artistName, artistProfileSlug: track.artistProfileSlug ?? undefined })
    }).catch(() => {});
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const playTrack = useCallback((track: MediaTrack, nextQueue?: MediaTrack[]) => {
    setQueue(prev => {
      const resolved = nextQueue ?? prev;
      if (nextQueue) originalQueueRef.current = nextQueue;
      const idx = resolved.findIndex(item => item.id === track.id);
      setCurrentIndex(idx);
      setCurrentTrack(track);
      setIsPlaying(true);
      return resolved;
    });
  }, []);

  const togglePlayback = useCallback(() => {
    setCurrentTrack(t => { if (t) setIsPlaying(v => !v); return t; });
  }, []);

  const playNext = useCallback(() => {
    setQueue(prev => {
      setCurrentIndex(ci => {
        const next = ci >= 0 && ci < prev.length - 1 ? ci + 1 : ci;
        if (next !== ci) { setCurrentTrack(prev[next] ?? null); setIsPlaying(true); }
        return next;
      });
      return prev;
    });
  }, []);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) { audio.currentTime = 0; setCurrentTime(0); return; }
    setQueue(prev => {
      setCurrentIndex(ci => {
        const p = ci > 0 ? ci - 1 : ci;
        if (p !== ci) { setCurrentTrack(prev[p] ?? null); setIsPlaying(true); }
        return p;
      });
      return prev;
    });
  }, []);

  const seekTo = useCallback((time: number) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(time)) return;
    a.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((v: number) => {
    preMuteVolumeRef.current = v;
    setVolumeState(v);
    if (isMuted) setIsMuted(false); // unmute on volume change
  }, [isMuted]);

  const addToQueue = useCallback((track: MediaTrack) => {
    setQueue(prev => prev.some(t => t.id === track.id) ? prev : [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      if (idx < currentIndex) setCurrentIndex(ci => ci - 1);
      return prev.filter(t => t.id !== id);
    });
  }, [currentIndex]);

  const cycleRepeat = useCallback(() => {
    setRepeatModeState(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off');
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => {
      const next = !prev;
      setCurrentIndex(ci => {
        setQueue(q => {
          if (next) {
            originalQueueRef.current = q;
            return shuffleAfter(q, ci);
          }
          const orig = originalQueueRef.current;
          if (!orig.length) return q;
          const played = new Set(q.slice(0, ci + 1).map(t => t.id));
          const remaining = orig.filter(t => !played.has(t.id));
          return [...q.slice(0, ci + 1), ...remaining];
        });
        return ci;
      });
      return next;
    });
  }, []);

  const cycleSpeed = useCallback(() => {
    setPlaybackRateState(prev => {
      const idx = SPEEDS.indexOf(prev as typeof SPEEDS[number]);
      const next = SPEEDS[(idx + 1) % SPEEDS.length] ?? 1;
      const a = audioRef.current;
      if (a) a.playbackRate = next;
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(m => {
      const next = !m;
      const a = audioRef.current;
      if (a) a.volume = next ? 0 : preMuteVolumeRef.current;
      return next;
    });
  }, []);

  const toggleAutoplay = useCallback(() => setIsAutoplay(v => !v), []);

  const cycleSleepTimer = useCallback(() => {
    setSleepMinutes(prev => {
      if (prev === null) return SLEEP_PRESETS[0];
      const idx = SLEEP_PRESETS.indexOf(prev as typeof SLEEP_PRESETS[number]);
      return idx >= 0 && idx < SLEEP_PRESETS.length - 1 ? SLEEP_PRESETS[idx + 1] : null;
    });
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepMinutes(null);
    setSleepRemainingSeconds(null);
    sleepEndTimeRef.current = null;
  }, []);

  const stableValue = useMemo<MediaPlayerStableValue>(
    () => ({
      currentTrack, canGoBack: currentIndex > 0,
      canGoForward: currentIndex >= 0 && currentIndex < queue.length - 1,
      queue, currentIndex, repeatMode, isShuffle, isMuted, isAutoplay, playbackRate,
      sleepMinutes, history,
      playTrack, addToQueue, removeFromQueue, togglePlayback,
      playNext, playPrevious, seekTo, setVolume,
      cycleRepeat, toggleShuffle, cycleSpeed, toggleMute, toggleAutoplay,
      cycleSleepTimer, cancelSleepTimer
    }),
    [currentIndex, currentTrack, queue, repeatMode, isShuffle, isMuted, isAutoplay, playbackRate, sleepMinutes, history]
  );

  const volatileValue = useMemo<MediaPlayerVolatileValue>(
    () => ({ currentTime, duration, isPlaying, volume, sleepRemainingSeconds }),
    [currentTime, duration, isPlaying, volume, sleepRemainingSeconds]
  );

  return (
    <MediaPlayerStableCtx.Provider value={stableValue}>
      <MediaPlayerVolatileCtx.Provider value={volatileValue}>
        {children}
        <audio ref={audioRef} preload="metadata" />
        <audio ref={preloadRef} preload="auto" style={{ display: 'none' }} />
      </MediaPlayerVolatileCtx.Provider>
    </MediaPlayerStableCtx.Provider>
  );
}

export function useMediaPlayer(): MediaPlayerContextValue {
  const stable = useContext(MediaPlayerStableCtx);
  if (!stable) throw new Error('useMediaPlayer must be used within MediaPlayerProvider');
  const volatile = useContext(MediaPlayerVolatileCtx);
  return useMemo(() => ({ ...stable, ...volatile }), [stable, volatile]);
}

// ── SVG icons (dock-only) ────────────────────────────────────────────────────
const DkPlay    = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>;
const DkPause   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
const DkSkipP   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="19 4 9 12 19 20"/><rect x="5" y="4" width="2" height="16"/></svg>;
const DkSkipN   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20"/><rect x="17" y="4" width="2" height="16"/></svg>;
const DkShuffle = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>;
const DkRepeat  = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;

// Deterministic pseudo-random bar heights per track id — a stable stand-in
// for a real audio-derived waveform, which needs offline analysis we don't
// run today. Same track always renders the same shape.
function seededWaveform(seed: string, bars = 46): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    out.push(0.22 + ((h >>> 8) % 1000) / 1000 * 0.78);
  }
  return out;
}

function repeatLabel(mode: RepeatMode) {
  if (mode === 'one') return '1';
  if (mode === 'all') return '∞';
  return '';
}

function fmtSleep(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

type DockPanel = 'queue' | 'history' | null;

export function SitePlayerDock() {
  const {
    currentTrack, isPlaying, currentTime, duration,
    queue, currentIndex, repeatMode, isShuffle, isMuted, isAutoplay, playbackRate,
    sleepMinutes, sleepRemainingSeconds, history,
    togglePlayback, playNext, playPrevious, seekTo, playTrack, setVolume,
    removeFromQueue, cycleRepeat, toggleShuffle, cycleSpeed,
    toggleMute, toggleAutoplay, cycleSleepTimer, cancelSleepTimer,
    volume
  } = useMediaPlayer();

  const [panel, setPanel] = useState<DockPanel>(null);
  const [copied, setCopied] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const progress = duration > 0 ? currentTime / duration : 0;
  const fmt = (s: number) => { const sec = Math.floor(s); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  const waveform = useMemo(() => currentTrack ? seededWaveform(currentTrack.id) : [], [currentTrack?.id]);

  const upcomingTracks = queue.slice(currentIndex + 1);
  const rLabel = repeatLabel(repeatMode);

  if (!currentTrack) return null;

  function togglePanel(p: DockPanel) {
    setPanel(prev => prev === p ? null : p);
  }

  async function shareCurrentTrack() {
    if (!currentTrack) return;
    const url = currentTrack.shareUrl
      ? (currentTrack.shareUrl.startsWith('http') ? currentTrack.shareUrl : window.location.origin + currentTrack.shareUrl)
      : currentTrack.artistProfileSlug
        ? `${window.location.origin}/artists/${currentTrack.artistProfileSlug}`
        : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied */ }
  }

  const btnBase: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px 4px' };

  return (
    <div className={`site-dock${mobileExpanded ? ' site-dock-expanded' : ''}`} role="region" aria-label="Media player">

      {/* ── Queue / history popover ───────────────────────────────────────── */}
      <PlayerQueuePanel
        panel={panel}
        setPanel={setPanel}
        upcomingTracks={upcomingTracks}
        history={history}
        isAutoplay={isAutoplay}
        toggleAutoplay={toggleAutoplay}
        playTrack={playTrack}
        removeFromQueue={removeFromQueue}
        queue={queue}
      />

      {/* ── Left: art + meta (tap to expand controls on mobile) ────────────── */}
      <div
        className="site-dock-l"
        onClick={() => setMobileExpanded(v => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={mobileExpanded}
        aria-label={mobileExpanded ? 'Collapse player controls' : 'Expand player controls'}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMobileExpanded(v => !v); } }}
      >
        <div className="site-dock-art" style={{ position: 'relative', background: currentTrack ? 'linear-gradient(135deg,#ff5029,#ff3e9a80)' : '#161310' }}>
          {currentTrack?.artworkUrl && <Image src={currentTrack.artworkUrl} alt={currentTrack.title} fill sizes="42px" style={{ objectFit: 'cover', borderRadius: 5 }} />}
        </div>
        <div className="site-dock-meta">
          <div className="site-dock-title">{currentTrack?.title ?? 'Nothing playing'}</div>
          <div className="site-dock-artist">{currentTrack?.artistName ?? 'Pick a track to start'}</div>
        </div>
        <svg className="site-dock-expand-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </div>

      {/* ── Mobile-only play/pause (collapsed-bar shortcut; hidden once expanded or on desktop) ── */}
      <button
        className="site-dock-play site-dock-mobile-play"
        onClick={e => { e.stopPropagation(); togglePlayback(); }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        type="button"
      >
        {isPlaying ? <DkPause /> : <DkPlay />}
      </button>

      {/* ── Center: controls + scrubber ──────────────────────────────────── */}
      <div className="site-dock-c">
        <div className="site-dock-ctrls">
          <button className="site-dock-btn" onClick={toggleShuffle} aria-label="Toggle shuffle" title="Shuffle" type="button"
            style={{ opacity: isShuffle ? 1 : 0.4, color: isShuffle ? 'var(--accent, #ff5029)' : 'inherit' }}>
            <DkShuffle />
          </button>
          <button className="site-dock-btn" onClick={playPrevious} aria-label="Previous" type="button"><DkSkipP /></button>
          <button className="site-dock-play" onClick={togglePlayback} aria-label={isPlaying ? 'Pause' : 'Play'} type="button">
            {isPlaying ? <DkPause /> : <DkPlay />}
          </button>
          <button className="site-dock-btn" onClick={playNext} aria-label="Next" type="button"><DkSkipN /></button>
          <button className="site-dock-btn" onClick={cycleRepeat} aria-label="Cycle repeat"
            title={repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'} type="button"
            style={{ opacity: repeatMode !== 'off' ? 1 : 0.4, color: repeatMode !== 'off' ? 'var(--accent, #ff5029)' : 'inherit', position: 'relative' }}>
            <DkRepeat />
            {rLabel && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: '0.55rem', fontWeight: 700, lineHeight: 1 }}>{rLabel}</span>}
          </button>
        </div>
        <div className="site-dock-scrub">
          <span className="site-dock-time">{fmt(currentTime)}</span>
          <div
            className="site-dock-track site-dock-waveform"
            role="slider"
            aria-label="Playback position"
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration); }}
          >
            {waveform.map((h, i) => (
              <span
                key={i}
                className="site-dock-wave-bar"
                style={{
                  height: `${h * 100}%`,
                  background: i / waveform.length <= progress ? 'var(--accent, #ff5029)' : 'var(--line-2)',
                }}
              />
            ))}
          </div>
          <span className="site-dock-time">{fmt(duration)}</span>
        </div>
      </div>

      {/* ── Right: volume + utility controls ─────────────────────────────── */}
      <div className="site-dock-r" style={{ alignItems: 'center', gap: 4 }}>

        {/* Mute + volume */}
        <button className="site-dock-btn" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'} title={isMuted ? 'Unmute (M)' : 'Mute (M)'} type="button"
          style={{ opacity: isMuted ? 0.4 : 0.6, fontSize: '0.75rem' }}>
          {isMuted ? '🔇' : '🔊'}
        </button>
        <input
          aria-label="Volume"
          type="range" min={0} max={1} step={0.05}
          value={isMuted ? 0 : volume}
          onChange={e => setVolume(Number(e.target.value))}
          style={{ width: 48, accentColor: 'var(--accent, #ff5029)', opacity: 0.6 }}
        />

        {/* Speed */}
        <button className="site-dock-btn" onClick={cycleSpeed} aria-label="Cycle speed" title="Playback speed" type="button"
          style={{ fontSize: '0.6rem', fontWeight: 700, opacity: playbackRate !== 1 ? 1 : 0.5, minWidth: 26 }}>
          {playbackRate}×
        </button>

        {/* Sleep timer */}
        <button className="site-dock-btn" onClick={sleepMinutes !== null ? cancelSleepTimer : cycleSleepTimer}
          aria-label="Sleep timer" title={sleepMinutes ? `Sleep in ${sleepRemainingSeconds !== null ? fmtSleep(sleepRemainingSeconds) : '—'} — click to cancel` : 'Sleep timer'} type="button"
          style={{ fontSize: '0.62rem', opacity: sleepMinutes !== null ? 1 : 0.45, color: sleepMinutes !== null ? 'var(--accent, #ff5029)' : 'inherit', minWidth: 28, fontWeight: sleepMinutes !== null ? 700 : 400 }}>
          {sleepMinutes !== null && sleepRemainingSeconds !== null ? fmtSleep(sleepRemainingSeconds) : '💤'}
        </button>

        {/* Share */}
        <button className="site-dock-btn" onClick={shareCurrentTrack} aria-label="Share track" title="Copy track link" type="button"
          style={{ opacity: currentTrack ? (copied ? 1 : 0.5) : 0.2, fontSize: '0.7rem', color: copied ? 'var(--accent, #ff5029)' : 'inherit' }}
          disabled={!currentTrack}>
          {copied ? '✓' : '⬆'}
        </button>

        {/* Queue / History toggle */}
        <button className="site-dock-btn" onClick={() => togglePanel('queue')} aria-label="Toggle queue" title="Queue & history" type="button"
          style={{ opacity: panel !== null ? 1 : 0.5, color: panel !== null ? 'var(--accent, #ff5029)' : 'inherit', fontSize: '0.85rem', position: 'relative' }}>
          ≡
          {upcomingTracks.length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, fontSize: '0.5rem', background: 'var(--accent, #ff5029)', color: '#fff', borderRadius: 8, padding: '0 3px', lineHeight: 1.4 }}>
              {upcomingTracks.length}
            </span>
          )}
        </button>

        <FanPlaylistManager currentTrack={currentTrack} playTrack={playTrack} />
      </div>
    </div>
  );
}
