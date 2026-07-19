'use client';

import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';

type RelatedTrack = {
  hexId: string;
  title: string;
  durationSecs: number | null;
  artworkUrl: string | null;
  href: string;
};

type TrackPlayerProps = {
  track: MediaTrack;
  related: RelatedTrack[];
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
};

function fmtDuration(secs: number | null) {
  if (!secs || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TrackPlayMainButton({ track }: { track: MediaTrack }) {
  const { currentTrack, isPlaying, playTrack, togglePlayback } = useMediaPlayer();
  const isCurrent = currentTrack?.id === track.id;
  const isCurrentAndPlaying = isCurrent && isPlaying;

  return (
    <button
      className="button"
      onClick={() => { if (isCurrent) { togglePlayback(); return; } playTrack(track, [track]); }}
      type="button"
    >
      {isCurrentAndPlaying ? '❙❙ Pause' : isCurrent ? '▶ Resume' : '▶ Play'}
    </button>
  );
}

export function MoreFromArtistList({ track, related, artistName, artistSlug, artworkUrl }: TrackPlayerProps) {
  const { currentTrack, isPlaying, playTrack, togglePlayback } = useMediaPlayer();

  const queue: MediaTrack[] = [
    track,
    ...related.map((r) => ({
      id: `${artistSlug}-${r.hexId}`,
      title: r.title,
      artistName,
      url: `/api/public-media/${r.hexId}`,
      mediaId: r.hexId,
      artistProfileSlug: artistSlug,
      artworkUrl: r.artworkUrl ?? artworkUrl,
    })),
  ];

  if (related.length === 0) {
    return (
      <div className="track-empty">
        <p>No other tracks yet.</p>
      </div>
    );
  }

  return (
    <div className="track-more-list">
      {related.map((r) => {
        const trackForQueue = queue.find((q) => q.mediaId === r.hexId)!;
        const isCurrent = currentTrack?.id === trackForQueue.id;
        const isCurrentAndPlaying = isCurrent && isPlaying;
        const duration = fmtDuration(r.durationSecs);
        return (
          <div className="track-more-row" key={r.hexId}>
            <button
              className="track-more-art"
              onClick={() => { if (isCurrent) { togglePlayback(); return; } playTrack(trackForQueue, queue); }}
              style={r.artworkUrl ? { backgroundImage: `url(${r.artworkUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              type="button"
              aria-label={isCurrentAndPlaying ? `Pause ${r.title}` : `Play ${r.title}`}
            >
              {!r.artworkUrl ? (isCurrentAndPlaying ? '❙❙' : '▶') : null}
            </button>
            <a className="track-more-info" href={r.href}>
              <div className="track-more-title">{r.title}</div>
              {duration ? <div className="track-more-duration">{duration}</div> : null}
            </a>
          </div>
        );
      })}
    </div>
  );
}
