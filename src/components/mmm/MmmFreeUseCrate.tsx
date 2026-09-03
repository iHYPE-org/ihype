'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';

/**
 * The free-use crate — tracks their own artists have cleared for other people's
 * playlists.
 *
 * Both ends of this feature were built and neither was reachable. An artist
 * ticks "free use" in the upload form and `TrackUploadPanel` tells them
 * "promoters can add this to playlists"; `GET /api/artist-media/free-use` has
 * always served exactly that list. Nothing called it, so the promise made at
 * upload was to a surface that did not exist. (The toggle was also write-once
 * until the same change — see `PageEditor`'s Media section.)
 *
 * It lives in PLAYLISTS rather than DISCOVER because the permission it reflects
 * is about playlists specifically: this is not "music we recommend", it is
 * "music you are allowed to put in your own list". Discovery is elsewhere and
 * has its own engine.
 *
 * Deliberately quiet when empty. A crate with nothing in it means no artist has
 * opted in yet, which is a true and unremarkable state on a new install — not
 * an error, and not worth a plate.
 */

type CrateTrack = {
  hexId: string;
  title: string;
  streamUrl: string;
  artist: { name: string; slug: string; location: string };
};

type PlaylistTarget = { id: string; name: string };

export function MmmFreeUseCrate({ playlists }: { playlists: readonly PlaylistTarget[] }) {
  const { playTrack } = useMediaPlayer();
  const [tracks, setTracks] = useState<CrateTrack[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/artist-media/free-use?limit=24', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { tracks?: CrateTrack[] } | null) => {
        if (!cancelled) setTracks(payload?.tracks ?? []);
      })
      .catch(() => { if (!cancelled) setTracks([]); });
    return () => { cancelled = true; };
  }, []);

  const add = useCallback(async (track: CrateTrack, playlistId: string) => {
    setBusy(track.hexId);
    setNote(null);
    try {
      const response = await fetch(`/api/fan-playlists/${playlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* `mediaId` is the hexId, which is what every other playlist writer
           uses, so a crate row and a liked row are the same item afterwards. */
        body: JSON.stringify({
          mediaId: track.hexId,
          title: track.title,
          artistName: track.artist.name,
          artistProfileSlug: track.artist.slug,
          url: new URL(track.streamUrl, window.location.origin).toString(),
        }),
      });
      setNote(response.ok
        ? `Added “${track.title}” to your playlist.`
        : 'That could not be added. Try again.');
    } catch {
      setNote('That could not be added. Try again.');
    } finally {
      setBusy(null);
    }
  }, []);

  if (!tracks?.length) return null;

  return (
    <>
      <p className="mmm-eyebrow" style={{ padding: '14px 2px 8px' }}>
        Cleared for your playlists · {tracks.length}
      </p>
      {note ? <p className="mmm-row-sub" style={{ padding: '0 2px 8px' }}>{note}</p> : null}
      {tracks.map((track) => (
        <div className="mmm-row" key={track.hexId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            aria-label={`Play ${track.title}`}
            onClick={() => playTrack({
              id: track.hexId,
              mediaId: track.hexId,
              title: track.title,
              artistName: track.artist.name,
              url: track.streamUrl,
              artistProfileSlug: track.artist.slug,
            })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', width: 22, padding: 0 }}
            type="button"
          >
            <span aria-hidden="true">▶︎</span>
          </button>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="mmm-row-title" style={{ display: 'block' }}>{track.title}</span>
            <span className="mmm-row-sub" style={{ display: 'block' }}>
              {track.artist.name}{track.artist.location ? ` · ${track.artist.location}` : ''}
            </span>
          </span>
          {/* No playlist yet means nothing to add to — the row still plays. */}
          {playlists.length > 0 && (
            <select
              aria-label={`Add ${track.title} to a playlist`}
              disabled={busy === track.hexId}
              onChange={(event) => {
                const playlistId = event.target.value;
                event.target.value = '';
                if (playlistId) void add(track, playlistId);
              }}
              style={{ maxWidth: 150 }}
              value=""
            >
              <option value="">Add to…</option>
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
              ))}
            </select>
          )}
        </div>
      ))}
    </>
  );
}
