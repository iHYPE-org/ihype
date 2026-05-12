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

// Stable context: functions + queue state. Never changes on timeupdate ticks.
type MediaPlayerStableValue = {
  currentTrack: MediaTrack | null;
  canGoBack: boolean;
  canGoForward: boolean;
  queue: MediaTrack[];
  currentIndex: number;
  playTrack: (track: MediaTrack, queue?: MediaTrack[]) => void;
  addToQueue: (track: MediaTrack) => void;
  removeFromQueue: (id: string) => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
};

// Volatile context: ticks ~4× per second from timeupdate.
type MediaPlayerVolatileValue = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
};

// Legacy merged type — keeps existing useMediaPlayer() call-sites working.
type MediaPlayerContextValue = MediaPlayerStableValue & MediaPlayerVolatileValue;

const MediaPlayerStableCtx = createContext<MediaPlayerStableValue | null>(null);
const MediaPlayerVolatileCtx = createContext<MediaPlayerVolatileValue>({ currentTime: 0, duration: 0, isPlaying: false, volume: 0.85 });

type PersistedPlayerState = {
  queue: MediaTrack[];
  currentIndex: number;
  currentTrack: MediaTrack | null;
  volume: number;
};

const STORAGE_KEY = 'ihype-global-media-player';

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null); // kept for legacy

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const completedMediaIdsRef = useRef<Set<string>>(new Set());
  const [queue, setQueue] = useState<MediaTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTrack, setCurrentTrack] = useState<MediaTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return;
    }

    try {
      const parsed = JSON.parse(storedValue) as PersistedPlayerState;
      setQueue(parsed.queue ?? []);
      setCurrentIndex(parsed.currentIndex ?? -1);
      setCurrentTrack(parsed.currentTrack ?? null);
      setVolumeState(parsed.volume ?? 0.85);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const payload: PersistedPlayerState = {
        // Store minimal fields only — skip artworkUrl, notes, mediaId to save space
        queue: queue.map(({ id, title, artistName, url, artistProfileSlug }) => ({ id, title, artistName, url, artistProfileSlug })) as MediaTrack[],
        currentIndex,
        currentTrack: currentTrack ? { id: currentTrack.id, title: currentTrack.title, artistName: currentTrack.artistName, url: currentTrack.url, artistProfileSlug: currentTrack.artistProfileSlug } as MediaTrack : null,
        volume,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, 500);
  }, [queue, currentIndex, currentTrack, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const syncTime = () => {
      setCurrentTime(audio.currentTime);

      if (
        currentTrack?.mediaId &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0 &&
        audio.currentTime / audio.duration >= 0.9
      ) {
        persistCompletedMediaListen(currentTrack);
      }
    };
    const syncDuration = () => setDuration(audio.duration || 0);
    const syncPlay = () => setIsPlaying(true);
    const syncPause = () => setIsPlaying(false);
    const onEnded = () => {
      persistCompletedMediaListen(currentTrack);
      setCurrentTime(0);
      setIsPlaying(false);
      setCurrentIndex((index) => {
        if (index >= 0 && index < queue.length - 1) {
          const nextIndex = index + 1;
          const nextTrack = queue[nextIndex] ?? null;
          setCurrentTrack(nextTrack);
          setIsPlaying(true);
          return nextIndex;
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
  }, [currentTrack, queue]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
      setCurrentTime(0);
    }

    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  function persistCompletedMediaListen(track: MediaTrack | null) {
    if (!track?.mediaId) {
      return;
    }

    if (completedMediaIdsRef.current.has(track.mediaId)) {
      return;
    }

    completedMediaIdsRef.current.add(track.mediaId);

    void fetch('/api/media-listens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaId: track.mediaId,
        title: track.title,
        mediaUrl: track.url,
        artistName: track.artistName,
        artistProfileSlug: track.artistProfileSlug ?? undefined
      })
    }).catch(() => {
      // Keep playback resilient if activity logging fails.
    });
  }

  const playTrack = useCallback((track: MediaTrack, nextQueue?: MediaTrack[]) => {
    setQueue(prev => {
      const resolved = nextQueue ?? prev;
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
        const prev2 = ci > 0 ? ci - 1 : ci;
        if (prev2 !== ci) { setCurrentTrack(prev[prev2] ?? null); setIsPlaying(true); }
        return prev2;
      });
      return prev;
    });
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(time)) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((v: number) => { setVolumeState(v); }, []);

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

  const stableValue = useMemo<MediaPlayerStableValue>(
    () => ({
      currentTrack,
      canGoBack: currentIndex > 0,
      canGoForward: currentIndex >= 0 && currentIndex < queue.length - 1,
      queue,
      currentIndex,
      playTrack,
      addToQueue,
      removeFromQueue,
      togglePlayback,
      playNext,
      playPrevious,
      seekTo,
      setVolume,
    }),
    [currentIndex, currentTrack, queue]
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
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    canGoBack,
    canGoForward,
    playTrack,
    togglePlayback,
    playNext,
    playPrevious,
    seekTo,
    setVolume
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
          <button className="media-player-button" disabled={!canGoBack} onClick={playPrevious} type="button">
            Prev
          </button>
          <button
            className="media-player-button media-player-button-primary"
            disabled={!currentTrack}
            onClick={togglePlayback}
            type="button"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button className="media-player-button" disabled={!canGoForward} onClick={playNext} type="button">
            Next
          </button>
        </div>
      </div>

      <div className="header-player-rail">
        <div className="header-player-progress">
          <span>{formatTime(currentTime)}</span>
          <input
            aria-label="Playback position"
            className="media-player-range"
            max={duration || 0}
            min={0}
            onChange={(event) => seekTo(Number(event.target.value))}
            step={0.1}
            type="range"
            value={Math.min(currentTime, duration || 0)}
          />
          <span>{formatTime(duration)}</span>
        </div>

        <div className="header-player-utility">
          <label className="header-player-volume">
            <span>Vol</span>
            <input
              aria-label="Playback volume"
              className="media-player-range"
              max={1}
              min={0}
              onChange={(event) => setVolume(Number(event.target.value))}
              step={0.05}
              type="range"
              value={volume}
            />
          </label>

          <FanPlaylistManager currentTrack={currentTrack} playTrack={playTrack} />
        </div>
      </div>
    </div>
  );
}

// ── SVG icons for the dock ──────────────────────────────────────
const DkPlay = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>;
const DkPause = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
const DkSkipP = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="19 4 9 12 19 20"/><rect x="5" y="4" width="2" height="16"/></svg>;
const DkSkipN = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20"/><rect x="17" y="4" width="2" height="16"/></svg>;

export function SitePlayerDock() {
  const { currentTrack, isPlaying, currentTime, duration, togglePlayback, playNext, playPrevious, seekTo, playTrack } = useMediaPlayer();

  const progress = duration > 0 ? currentTime / duration : 0;
  const fmt = (s: number) => {
    const sec = Math.floor(s);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  return (
    <div className="site-dock" role="region" aria-label="Media player">
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
          <button className="site-dock-btn" onClick={playPrevious} aria-label="Previous" type="button"><DkSkipP /></button>
          <button className="site-dock-play" onClick={togglePlayback} aria-label={isPlaying ? 'Pause' : 'Play'} type="button">
            {isPlaying ? <DkPause /> : <DkPlay />}
          </button>
          <button className="site-dock-btn" onClick={playNext} aria-label="Next" type="button"><DkSkipN /></button>
        </div>
        <div className="site-dock-scrub">
          <span className="site-dock-time">{fmt(currentTime)}</span>
          <div
            className="site-dock-track"
            role="slider"
            aria-label="Playback position"
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
            }}
          >
            <div className="site-dock-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="site-dock-time">{fmt(duration)}</span>
        </div>
      </div>

      {/* Right: playlist */}
      <div className="site-dock-r">
        <FanPlaylistManager currentTrack={currentTrack} playTrack={playTrack} />
      </div>
    </div>
  );
}
