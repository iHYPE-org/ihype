'use client';

import type { ShowMediaItem } from '@/lib/show-composer';
import type { DraggedMediaPayload } from './PromoterShowCreationUtils';

type PromoterShowCreationDeckCardProps = {
  deck: 'A' | 'B';
  track: ShowMediaItem | null;
  level: number;
  draggedMediaSource: DraggedMediaPayload['source'] | null;
  isCurrentTrackPlaying: boolean;
  workstationHeaderClassName: string;
  sectionBadgeClassName: string;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>, deck: 'A' | 'B') => void;
  onPlay: (deck: 'A' | 'B', track: ShowMediaItem | null) => void;
  onCue: (deck: 'A' | 'B', track: ShowMediaItem | null) => void;
};

export function PromoterShowCreationDeckCard({
  deck,
  track,
  level,
  draggedMediaSource,
  isCurrentTrackPlaying,
  workstationHeaderClassName,
  sectionBadgeClassName,
  onDragOver,
  onDrop,
  onPlay,
  onCue
}: PromoterShowCreationDeckCardProps) {
  return (
    <div
      className={
        draggedMediaSource === 'playlist'
          ? 'composer-card composer-deck-card composer-player-card is-dragging'
          : 'composer-card composer-deck-card composer-player-card'
      }
      onDragOver={onDragOver}
      onDrop={(event) => onDrop(event, deck)}
    >
      <div className={workstationHeaderClassName}>
        <div className={sectionBadgeClassName}>Deck {deck}</div>
        <div className="composer-deck-screen">
          <strong>{track?.title ?? `Deck ${deck}`}</strong>
          <span>{track ? track.artistName : 'Drop from playlist'}</span>
        </div>
      </div>
      <div className="composer-player-stage composer-player-stage-compact">
        <div className="composer-song-screen">
          <span className="composer-song-screen-label">Track</span>
          <strong>{track?.title ?? 'Standby'}</strong>
          <span>
            {track
              ? `${track.artistName} | song`
              : 'Playlist drop zone'}
          </span>
          {track ? <div className="composer-media-code">{track.mediaId}</div> : null}
        </div>
        <div className="composer-jog-wheel">
          <span>{level}%</span>
        </div>
        <div className="composer-transport">
          <button className="button small secondary" onClick={() => onPlay(deck, track)} type="button">
            {track && isCurrentTrackPlaying ? 'Pause' : 'Play'}
          </button>
          <button className="button small secondary" onClick={() => onCue(deck, track)} type="button">
            Cue
          </button>
        </div>
      </div>
    </div>
  );
}
