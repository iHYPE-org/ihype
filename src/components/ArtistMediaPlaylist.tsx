'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import type { ArtistMediaEntry } from '@/lib/media';

type ArtistMediaPlaylistProps = {
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  entries: ArtistMediaEntry[];
  isOwner?: boolean;
};

export function ArtistMediaPlaylist({
  artistName,
  artistSlug,
  artworkUrl,
  entries,
  isOwner = false
}: ArtistMediaPlaylistProps) {
  const router = useRouter();
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

  async function copyToClipboard(value: string, label: string, options?: { treatAsLink?: boolean }) {
    try {
      const normalizedValue = options?.treatAsLink
        ? value.startsWith('http://') || value.startsWith('https://')
          ? value
          : new URL(value, window.location.origin).toString()
        : value;
      await navigator.clipboard.writeText(normalizedValue);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  async function removeUpload(entry: ArtistMediaEntry) {
    if (!window.confirm(`Remove ${entry.title} from your artist page?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/artist-media/${entry.hexId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? 'Could not remove this upload.');
        return;
      }

      setMessage(`${entry.title} removed.`);
      router.refresh();
    } catch {
      setMessage('Could not remove this upload.');
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
              <button
                className="button small secondary"
                onClick={() => copyToClipboard(entry.shareUrl, 'Share link', { treatAsLink: true })}
                type="button"
              >
                Copy link
              </button>
              <a className="button small secondary" href={track.url} rel="noreferrer" target="_blank">
                Open audio
              </a>
              {isOwner && entry.source === 'UPLOADED' ? (
                <button className="button small secondary" onClick={() => removeUpload(entry)} type="button">
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
