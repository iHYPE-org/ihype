'use client';

import {
  createContext,
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

type MediaPlayerContextValue = {
  currentTrack: MediaTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  canGoBack: boolean;
  canGoForward: boolean;
  playTrack: (track: MediaTrack, queue?: MediaTrack[]) => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
};

type PersistedPlayerState = {
  queue: MediaTrack[];
  currentIndex: number;
  currentTrack: MediaTrack | null;
  volume: number;
};

const STORAGE_KEY = 'ihype-global-media-player';

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null);

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: PersistedPlayerState = {
      queue,
      currentIndex,
      currentTrack,
      volume
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

  function playTrack(track: MediaTrack, nextQueue?: MediaTrack[]) {
    const resolvedQueue = nextQueue ?? queue;
    const nextIndex = resolvedQueue.findIndex((item) => item.id === track.id);
    setQueue(resolvedQueue);
    setCurrentIndex(nextIndex);
    setCurrentTrack(track);
    setIsPlaying(true);
  }

  function togglePlayback() {
    if (!currentTrack) {
      return;
    }

    setIsPlaying((value) => !value);
  }

  function playNext() {
    if (!queue.length) {
      return;
    }

    const nextIndex = currentIndex >= 0 && currentIndex < queue.length - 1 ? currentIndex + 1 : currentIndex;
    if (nextIndex === currentIndex) {
      return;
    }

    setCurrentIndex(nextIndex);
    const nextTrack = queue[nextIndex] ?? null;
    setCurrentTrack(nextTrack);
    setIsPlaying(true);
  }

  function playPrevious() {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (!queue.length) {
      return;
    }

    const previousIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    if (previousIndex === currentIndex) {
      return;
    }

    setCurrentIndex(previousIndex);
    const previousTrack = queue[previousIndex] ?? null;
    setCurrentTrack(previousTrack);
    setIsPlaying(true);
  }

  function seekTo(time: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(time)) {
      return;
    }

    audio.currentTime = time;
    setCurrentTime(time);
  }

  function setVolume(volumeValue: number) {
    setVolumeState(volumeValue);
  }

  const contextValue = useMemo<MediaPlayerContextValue>(
    () => ({
      currentTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      canGoBack: currentIndex > 0 || currentTime > 4,
      canGoForward: currentIndex >= 0 && currentIndex < queue.length - 1,
      playTrack,
      togglePlayback,
      playNext,
      playPrevious,
      seekTo,
      setVolume
    }),
    [currentIndex, currentTrack, currentTime, duration, isPlaying, queue, volume]
  );

  return (
    <MediaPlayerContext.Provider value={contextValue}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </MediaPlayerContext.Provider>
  );
}

export function useMediaPlayer() {
  const context = useContext(MediaPlayerContext);

  if (!context) {
    throw new Error('useMediaPlayer must be used within MediaPlayerProvider');
  }

  return context;
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
