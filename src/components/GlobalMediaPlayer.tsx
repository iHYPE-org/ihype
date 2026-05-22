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
import { FanPlaylistManager } from '@/components/FanPlaylistManager';

export type MediaTrack = {
  id: string;
  title: string;
  artistName: string;
  url: string;
  mediaId?: string | null;
  artistProfileSlug?: string | null;
  notes?: string | null;
  artworkUrl?: string | null;
};

export type RepeatMode = 'off' | 'one' | 'all';

const SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const;

type MediaPlayerStableValue = {
  currentTrack: MediaTrack | null;
  canGoBack: boolean;
  canGoForward: boolean;
  queue: MediaTrack[];
  currentIndex: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  playbackRate: number;
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
};

type MediaPlayerVolatileValue = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
};

type MediaPlayerContextValue = MediaPlayerStableValue & MediaPlayerVolatileValue;

const MediaPlayerStableCtx = createContext<MediaPlayerStableValue | null>(null);
const MediaPlayerVolatileCtx = createContext<MediaPlayerVolatileValue>({ currentTime: 0, duration: 0, isPlaying: false, volume: 0.85 });
const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null);

type PersistedPlayerState = {
  queue: MediaTrack[];
  currentIndex: number;
  currentTrack: MediaTrack | null;
  volume: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  playbackRate: number;
};

const STORAGE_KEY = 'ihype-global-media-player';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

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

  const [queue, setQueue] = useState<MediaTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTrack, setCurrentTrack] = useState<MediaTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setCurrentTrack(t => { if (t) setIsPlaying(v => !v); return t; });
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
        setQueue(prev => { setCurrentIndex(ci => { const next = ci >= 0 && ci < prev.length - 1 ? ci + 1 : ci; if (next !== ci) { setCurrentTrack(prev[next] ?? null); setIsPlaying(true); } return next; }); return prev; });
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        const a = audioRef.current;
        if (a && a.currentTime > 4) { a.currentTime = 0; setCurrentTime(0); return; }
        setQueue(prev => { setCurrentIndex(ci => { const p = ci > 0 ? ci - 1 : ci; if (p !== ci) { setCurrentTrack(prev[p] ?? null); setIsPlaying(true); } return p; }); return prev; });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      setVolumeState(p.volume ?? 0.85);
      if (p.repeatMode) setRepeatModeState(p.repeatMode);
      if (typeof p.isShuffle === 'boolean') setIsShuffle(p.isShuffle);
      if (p.playbackRate) setPlaybackRateState(p.playbackRate);
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
        volume,
        repeatMode,
        isShuffle,
        playbackRate
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, 500);
  }, [queue, currentIndex, currentTrack, volume, repeatMode, isShuffle, playbackRate]);

  // ── Volume sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  // ── Playback rate sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = playbackRate;
  }, [playbackRate]);

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
        ? [{ src: currentTrack.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
        : []
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
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      const a = audioRef.current;
      if (a && details.seekTime != null) { a.currentTime = details.seekTime; setCurrentTime(details.seekTime); }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const a = audioRef.current;
      if (a) { a.currentTime = Math.min(a.duration || 0, a.currentTime + (details.seekOffset ?? 10)); setCurrentTime(a.currentTime); }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const a = audioRef.current;
      if (a) { a.currentTime = Math.max(0, a.currentTime - (details.seekOffset ?? 10)); setCurrentTime(a.currentTime); }
    });
  }, [currentTrack]);

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
        // Replay same track
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
  }, [currentTrack, queue, repeatMode]);

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
      // If preload already has this URL buffered, swap the elements
      const pre = preloadRef.current;
      if (pre && pre.src === currentTrack.url && pre.readyState >= 2) {
        audio.src = pre.src;
        audio.currentTime = 0;
      } else {
        audio.src = currentTrack.url;
      }
      audio.load();
      audio.playbackRate = playbackRate;
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

  const setVolume = useCallback((v: number) => setVolumeState(v), []);

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
          // Restore original order, keeping current position
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

  const stableValue = useMemo<MediaPlayerStableValue>(
    () => ({
      currentTrack, canGoBack: currentIndex > 0,
      canGoForward: currentIndex >= 0 && currentIndex < queue.length - 1,
      queue, currentIndex, repeatMode, isShuffle, playbackRate,
      playTrack, addToQueue, removeFromQueue, togglePlayback,
      playNext, playPrevious, seekTo, setVolume,
      cycleRepeat, toggleShuffle, cycleSpeed
    }),
    [currentIndex, currentTrack, queue, repeatMode, isShuffle, playbackRate]
  );

  const volatileValue = useMemo<MediaPlayerVolatileValue>(
    () => ({ currentTime, duration, isPlaying, volume }),
    [currentTime, duration, isPlaying, volume]
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

export function HeaderMediaPlayer() {
  const {
    currentTrack, isPlaying, currentTime, duration, volume,
    canGoBack, canGoForward, playTrack, togglePlayback, playNext, playPrevious, seekTo, setVolume
  } = useMediaPlayer();

  return (
    <div className="header-player" role="region" aria-label="Global artist media player">
      <div className="header-player-main">
        <div className="header-player-copy">
          <strong>{currentTrack?.title ?? 'Player standby'}</strong>
          <span className="header-player-caption">
            {currentTrack
              ? `${currentTrack.artistName}${currentTrack.notes ? ` | ${currentTrack.notes}` : ''}`
              : 'Play any artist upload to keep listening while you browse.'}
          </span>
        </div>
        <div className="header-player-controls">
          <button className="media-player-button" disabled={!canGoBack} onClick={playPrevious} type="button">Prev</button>
          <button className="media-player-button media-player-button-primary" disabled={!currentTrack} onClick={togglePlayback} type="button">
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button className="media-player-button" disabled={!canGoForward} onClick={playNext} type="button">Next</button>
        </div>
      </div>
      <div className="header-player-rail">
        <div className="header-player-progress">
          <span>{formatTime(currentTime)}</span>
          <input aria-label="Playback position" className="media-player-range" max={duration || 0} min={0} onChange={e => seekTo(Number(e.target.value))} step={0.1} type="range" value={Math.min(currentTime, duration || 0)} />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="header-player-utility">
          <label className="header-player-volume">
            <span>Vol</span>
            <input aria-label="Playback volume" className="media-player-range" max={1} min={0} onChange={e => setVolume(Number(e.target.value))} step={0.05} type="range" value={volume} />
          </label>
          <FanPlaylistManager currentTrack={currentTrack} playTrack={playTrack} />
        </div>
      </div>
    </div>
  );
}

// ── SVG icons ───────────────────────────────────────────────────────────────
const DkPlay   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>;
const DkPause  = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
const DkSkipP  = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="19 4 9 12 19 20"/><rect x="5" y="4" width="2" height="16"/></svg>;
const DkSkipN  = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20"/><rect x="17" y="4" width="2" height="16"/></svg>;
const DkShuffle = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>;
const DkRepeat = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;

function repeatLabel(mode: RepeatMode) {
  if (mode === 'one') return '1';
  if (mode === 'all') return '∞';
  return '';
}

export function SitePlayerDock() {
  const {
    currentTrack, isPlaying, currentTime, duration,
    queue, currentIndex, repeatMode, isShuffle, playbackRate,
    togglePlayback, playNext, playPrevious, seekTo, playTrack,
    removeFromQueue, cycleRepeat, toggleShuffle, cycleSpeed
  } = useMediaPlayer();

  const [showQueue, setShowQueue] = useState(false);

  const progress = duration > 0 ? currentTime / duration : 0;
  const fmt = (s: number) => {
    const sec = Math.floor(s);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  const upcomingTracks = queue.slice(currentIndex + 1);
  const rLabel = repeatLabel(repeatMode);

  return (
    <div className="site-dock" role="region" aria-label="Media player" style={{ position: 'relative' }}>
      {/* Queue panel */}
      {showQueue && (
        <div
          style={{
            position: 'absolute', bottom: '100%', right: 0, width: 280, maxHeight: 320,
            overflowY: 'auto', background: 'var(--surface-1, #1a1714)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px 8px 0 0', padding: '0.5rem', zIndex: 10
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', padding: '0 0.25rem' }}>
            <span style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Up next ({upcomingTracks.length})</span>
            <button onClick={() => setShowQueue(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, color: 'inherit', fontSize: '0.8rem', padding: '0 2px' }} type="button">✕</button>
          </div>
          {upcomingTracks.length === 0 ? (
            <p style={{ fontSize: '0.75rem', opacity: 0.4, margin: '0.5rem 0.25rem' }}>Queue is empty.</p>
          ) : (
            upcomingTracks.map((track, i) => (
              <div
                key={track.id}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', borderRadius: 4, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '0.65rem', opacity: 0.4, width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => { playTrack(track, queue); }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artistName}</div>
                </div>
                <button
                  onClick={() => removeFromQueue(track.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, color: 'inherit', fontSize: '0.7rem', flexShrink: 0, padding: '2px 4px' }}
                  title="Remove from queue"
                  type="button"
                >✕</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Left: art + meta */}
      <div className="site-dock-l">
        <div className="site-dock-art" style={{ background: currentTrack ? 'linear-gradient(135deg,#ff5029,#ff3e9a80)' : '#161310' }}>
          {currentTrack?.artworkUrl && (
            <img src={currentTrack.artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 5 }} />
          )}
        </div>
        <div className="site-dock-meta">
          <div className="site-dock-title">{currentTrack?.title ?? 'Nothing playing'}</div>
          <div className="site-dock-artist">{currentTrack?.artistName ?? 'Pick a track to start'}</div>
        </div>
      </div>

      {/* Center: controls + scrubber */}
      <div className="site-dock-c">
        <div className="site-dock-ctrls">
          {/* Shuffle */}
          <button
            className="site-dock-btn"
            onClick={toggleShuffle}
            aria-label="Toggle shuffle"
            title="Shuffle"
            type="button"
            style={{ opacity: isShuffle ? 1 : 0.4, color: isShuffle ? 'var(--accent, #ff5029)' : 'inherit' }}
          >
            <DkShuffle />
          </button>

          <button className="site-dock-btn" onClick={playPrevious} aria-label="Previous" type="button"><DkSkipP /></button>
          <button className="site-dock-play" onClick={togglePlayback} aria-label={isPlaying ? 'Pause' : 'Play'} type="button">
            {isPlaying ? <DkPause /> : <DkPlay />}
          </button>
          <button className="site-dock-btn" onClick={playNext} aria-label="Next" type="button"><DkSkipN /></button>

          {/* Repeat */}
          <button
            className="site-dock-btn"
            onClick={cycleRepeat}
            aria-label="Cycle repeat"
            title={repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
            type="button"
            style={{ opacity: repeatMode !== 'off' ? 1 : 0.4, color: repeatMode !== 'off' ? 'var(--accent, #ff5029)' : 'inherit', position: 'relative' }}
          >
            <DkRepeat />
            {rLabel && (
              <span style={{ position: 'absolute', top: -4, right: -4, fontSize: '0.55rem', fontWeight: 700, lineHeight: 1 }}>{rLabel}</span>
            )}
          </button>
        </div>
        <div className="site-dock-scrub">
          <span className="site-dock-time">{fmt(currentTime)}</span>
          <div
            className="site-dock-track"
            role="slider"
            aria-label="Playback position"
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
            }}
          >
            <div className="site-dock-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="site-dock-time">{fmt(duration)}</span>
        </div>
      </div>

      {/* Right: speed + queue + playlist */}
      <div className="site-dock-r" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Speed */}
        <button
          className="site-dock-btn"
          onClick={cycleSpeed}
          aria-label="Cycle playback speed"
          title="Playback speed"
          type="button"
          style={{ fontSize: '0.6rem', fontWeight: 700, opacity: playbackRate !== 1 ? 1 : 0.5, minWidth: 28 }}
        >
          {playbackRate}×
        </button>

        {/* Queue */}
        <button
          className="site-dock-btn"
          onClick={() => setShowQueue(v => !v)}
          aria-label="Toggle queue"
          title="Queue"
          type="button"
          style={{ opacity: showQueue ? 1 : 0.5, color: showQueue ? 'var(--accent, #ff5029)' : 'inherit', fontSize: '0.65rem', position: 'relative' }}
        >
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
