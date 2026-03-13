'use client';

import { useMemo, useState } from 'react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import type { ArtistMediaEntry } from '@/lib/media';

type ArtistMediaPlaylistProps = {
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  entries: ArtistMediaEntry[];
};

export function ArtistMediaPlaylist({
  artistName,
  artistSlug,
  artworkUrl,
  entries
}: ArtistMediaPlaylistProps) {
  const { currentTrack, isPlaying, playTrack, togglePlayback } = useMediaPlayer();
  const [message, setMessage] = useState<string | null>(null);

  const queue = useMemo<MediaTrack[]>(
    () =>
      entries.map((entry) => ({
        id: `${artistSlug}-${entry.hexId}`,
        title: entry.title,
        artistName,
        url: entry.url,
        mediaId: entry.hexId,
        artistProfileSlug: artistSlug,
        notes: entry.notes,
        artworkUrl
      })),
    [artistName, artistSlug, artworkUrl, entries]
  );

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <div className="artist-media-list">
      {message ? <p className="meta">{message}</p> : null}
      {queue.map((track, index) => {
        const isCurrentTrack = currentTrack?.id === track.id;
        const isCurrentAndPlaying = isCurrentTrack && isPlaying;
        const entry = entries[index];

        return (
          <article className={isCurrentTrack ? 'artist-media-card active' : 'artist-media-card'} key={track.id}>
            <div className="artist-media-card-copy">
              <span className="artist-media-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <div className="composer-media-code">{entry.hexId}</div>
                <strong>{track.title}</strong>
                <p className="meta">
                  {artistName}
                  {track.notes ? ` | ${track.notes}` : ''}
                </p>
              </div>
            </div>

            <div className="artist-media-actions">
              <button
                className="button small"
                onClick={() => {
                  if (isCurrentTrack) {
                    togglePlayback();
                    return;
                  }

                  playTrack(track, queue);
                }}
                type="button"
              >
                {isCurrentAndPlaying ? 'Pause' : isCurrentTrack ? 'Resume' : 'Play in dock'}
              </button>
              <button
                className="button small secondary"
                onClick={() => copyToClipboard(entry.hexId, 'Media ID')}
                type="button"
              >
                Copy ID
              </button>
              <a className="button small secondary" href={track.url} rel="noreferrer" target="_blank">
                Open audio
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
