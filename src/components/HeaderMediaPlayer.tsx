'use client';

import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { FanPlaylistManager } from '@/components/FanPlaylistManager';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function HeaderMediaPlayer() {
  const {
    currentTrack, isPlaying, currentTime, duration, volume, isMuted,
    canGoBack, canGoForward, playTrack, togglePlayback, playNext, playPrevious, seekTo, setVolume, toggleMute,
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
          <input
            aria-label="Playback position"
            className="media-player-range"
            max={duration || 0}
            min={0}
            onChange={e => seekTo(Number(e.target.value))}
            step={0.1}
            type="range"
            value={Math.min(currentTime, duration || 0)}
          />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="header-player-utility">
          <label className="header-player-volume">
            <button
              onClick={toggleMute}
              style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: isMuted ? 0.4 : 0.7, color: 'inherit', padding: 0, fontSize: '0.75rem' }}
              type="button"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              aria-label="Playback volume"
              className="media-player-range"
              max={1}
              min={0}
              onChange={e => setVolume(Number(e.target.value))}
              step={0.05}
              type="range"
              value={isMuted ? 0 : volume}
            />
          </label>
          <FanPlaylistManager currentTrack={currentTrack} playTrack={playTrack} />
        </div>
      </div>
    </div>
  );
}
