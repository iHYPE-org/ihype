'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MmmPlayerTrack } from '@/components/mmm/MmmShell';

/** Everything the playlist-items endpoint needs to store a playable row. */
export type PlaylistAddTarget = {
  mediaId: string;
  title: string;
  artistName: string;
  url: string;
  artistProfileSlug: string | null;
  artworkUrl: string | null;
};

/**
 * "+ Playlist" — the loop-closer between the player and the Playlists tab.
 *
 * Playlists existed and played, but nothing could ADD to one from where music
 * is actually heard: building a playlist meant leaving the player entirely
 * (owner-approved batch, 2026-08-24). Self-contained on purpose — it fetches
 * `/api/fan-playlists` only when opened, posts to the items endpoint the
 * playlist page already uses, and reports the endpoint's own verdicts: a 409
 * is "already in", not an error.
 */
function AddToPlaylist({ target }: { target: PlaylistAddTarget }) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<Array<{ id: string; name: string }> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setOpen((value) => !value);
    setNote(null);
    if (lists) return;
    try {
      const response = await fetch('/api/fan-playlists', { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { playlists?: Array<{ id: string; name: string }> };
      setLists((payload.playlists ?? []).map((list) => ({ id: list.id, name: list.name })));
    } catch {
      setLists([]);
      setNote('Playlists could not be loaded right now.');
    }
  }, [lists]);

  const add = useCallback(async (playlistId: string, name: string) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch(`/api/fan-playlists/${encodeURIComponent(playlistId)}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(target),
      });
      if (response.status === 409) setNote(`Already in ${name}.`);
      else if (!response.ok) setNote('Could not add the track. Try again.');
      else setNote(`Added to ${name}.`);
    } catch {
      setNote('Could not add the track. Try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, target]);

  const create = useCallback(async (name: string) => {
    if (busy || !name) return;
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch('/api/fan-playlists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const playlist = (await response.json()) as { id: string; name: string };
      setLists((value) => [...(value ?? []), { id: playlist.id, name: playlist.name }]);
      setBusy(false);
      await add(playlist.id, playlist.name);
      return;
    } catch {
      setNote('Could not create the playlist.');
    }
    setBusy(false);
  }, [add, busy]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={`Add ${target.title} to a playlist`}
        className="mmm-full-fav"
        data-active={open || undefined}
        onClick={() => void load()}
        type="button"
      >
        <span aria-hidden="true">+</span>
      </button>
      {open && (
        <div className="mmm-full-list" data-add-panel="" style={{ width: '100%' }}>
          <p className="mmm-queue-eyebrow">Add to playlist</p>
          {note && <p className="mmm-queue-eyebrow" role="status" style={{ color: 'var(--accent-text)' }}>{note}</p>}
          {lists === null && <p className="mmm-queue-eyebrow" role="status">Loading…</p>}
          {(lists ?? []).map((list) => (
            <button className="mmm-queue-row" disabled={busy} key={list.id} onClick={() => void add(list.id, list.name)} type="button">
              <span aria-hidden="true" className="mmm-queue-index">≡</span>
              <span className="mmm-queue-title">{list.name}</span>
            </button>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const value = new FormData(form).get('name');
              const name = typeof value === 'string' ? value.trim() : '';
              if (name) { void create(name); form.reset(); }
            }}
            style={{ display: 'flex', gap: 8, padding: '8px 0 0' }}
          >
            <input
              aria-label="New playlist name"
              maxLength={60}
              name="name"
              placeholder="New playlist"
              style={{
                flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 'var(--radius-card)',
                border: '1.5px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)',
                // max(16px, …): Safari zooms the page on a sub-16px focused
                // input and never zooms back — mobile-fit.css's own rule.
                fontSize: 'max(16px, 1rem)', fontFamily: 'var(--font-body)',
              }}
              type="text"
            />
            <button className="mmm-queue-row" disabled={busy} style={{ flex: '0 0 auto', width: 'auto' }} type="submit">
              <span className="mmm-queue-title">Create</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/**
 * The full-screen player. Phone only.
 *
 * Built to `design/design-system-8/components/shell/FullPlayer.d.ts` and the
 * geometry in `SHELL_LOCK_2026-08-08.md`.
 *
 * ## Why it exists
 *
 * The phone form of the pill carries three things — artwork, the two names,
 * play — because at 393px nothing else fits beside a 40px square. Every other
 * control the wide pill has (seek, volume, HYPE, the heart, prev/next, the
 * queue) is dropped there on the understanding that it lives HERE instead.
 * Until this file existed that was only half true: the drops had shipped and
 * the destination had not, so a phone had no route to any of them.
 *
 * ## Three things that are the design's and are easy to undo
 *
 * 1. **The way out is the same square in the same corner as the shell's nav
 *    trigger.** On this screen it means "back", which is why it carries its own
 *    label rather than reusing the trigger's. Moving it makes the way out
 *    somewhere new to look.
 * 2. **Nothing appears by transition or keyframe.** Every element is authored at
 *    its final value and appearance is a state change — `SHELL_LOCK` is explicit
 *    that a both-filled animation holds its from-state forever in contexts where
 *    the document timeline does not advance, which would leave this screen
 *    permanently invisible while its props read "open".
 * 3. **It owns no audio element.** Every value is passed in and every control is
 *    a callback, exactly as the pill is, so both render the same playback state
 *    rather than each keeping their own.
 *
 * One deliberate departure: seek and volume are `<input type="range">`, as they
 * are in the pill, rather than the design's pointer-maths div with
 * `role="slider"`. The range input is keyboard-operable and screen-reader
 * labelled for free, and this product ships an accessibility settings page.
 */

/** Elapsed and total clock. `seconds` is the real track length when known. */
function clock(pct: number, seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const at = Math.round((Math.max(0, Math.min(100, pct)) / 100) * seconds);
  return `${Math.floor(at / 60)}:${String(at % 60).padStart(2, '0')}`;
}

export function MmmFullPlayer({
  addTarget,
  canGoBack,
  canGoForward,
  canFavourite,
  canHype,
  canTogglePlay,
  durationSeconds,
  faved,
  history = [],
  hypeLabel,
  hypeLocked,
  hyped,
  onClose,
  onSearch,
  onNext,
  onOpenAlbum,
  onOpenArtist,
  onPickTrack,
  onPrev,
  onSeek,
  onToggleFav,
  onToggleHype,
  onTogglePlay,
  onVolume,
  open,
  playing,
  progress,
  queue = [],
  track,
  volume,
}: {
  /** The playing track in the playlist-items endpoint's own shape. Null hides the control. */
  addTarget?: PlaylistAddTarget | null;
  canGoBack: boolean;
  canGoForward: boolean;
  canFavourite: boolean;
  canHype: boolean;
  canTogglePlay: boolean;
  /** Real track length, for the clock. 0 when unknown — the clock says so. */
  durationSeconds: number;
  faved: boolean;
  /** Already played, most recent first. Same list as `queue`, cut at the index. */
  history?: MmmPlayerTrack[];
  hypeLabel?: string;
  hypeLocked?: boolean;
  hyped: boolean;
  onClose: () => void;
  /** Submitting the search field leaves for discovery with the query. */
  onSearch?: (query: string) => void;
  onNext: () => void;
  onOpenAlbum?: () => void;
  onOpenArtist?: () => void;
  onPickTrack?: (track: MmmPlayerTrack, list: 'queue' | 'history', index: number) => void;
  onPrev: () => void;
  onSeek: (value: number) => void;
  onToggleFav: () => void;
  onToggleHype: () => void;
  onTogglePlay: () => void;
  onVolume: (value: number) => void;
  open: boolean;
  playing: boolean;
  /** 0–100. */
  progress: number;
  queue?: MmmPlayerTrack[];
  track: MmmPlayerTrack | null;
  /** 0–100. */
  volume: number;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes, the way it closes every other overlay in the app. The
  // listener is only bound while open, so it cannot swallow Escape elsewhere.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  // Focus lands on the way out, so a keyboard or switch user is never dropped
  // into a full-screen dialog with no announced exit.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const pick = useCallback(
    (item: MmmPlayerTrack, list: 'queue' | 'history', index: number) => {
      onPickTrack?.(item, list, index);
    },
    [onPickTrack],
  );

  // Never a placeholder track: with nothing playing there is nothing to expand.
  if (!open || !track) return null;

  return (
    <div aria-label="Now playing" aria-modal="true" className="mmm-full" role="dialog">
      <div className="mmm-full-scroll">
        <p className="mmm-full-state">{playing ? 'Now playing' : 'Paused'}</p>

        <div className="mmm-full-art">
          {track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- an R2/remote
            // URL already sized by the uploader; next/image would add a loader
            // round trip for one image that is the whole point of this screen.
            <img alt="" src={track.artworkUrl} />
          ) : (
            /* THE PLACEHOLDER THIS BOX WAS ALREADY DESIGNED FOR. `.mmm-full-art`
               sets the display face at 6rem, centres its content and colours it
               --ink-on-walnut — its own comment says the rule "carries the
               placeholder glyph" — and nothing ever put a glyph in it. So the
               largest artwork on the app, 300px in a machined brass bezel, has
               been an empty walnut hole for every track without a cover, which
               at alpha is nearly all of them.

               Not a new idea: `.mmm-recents-art` and `.mmm-profile-art` both
               already fall back to an initial exactly like this. The full
               player is the one surface that missed the pattern.

               `initial` is a field ON `MmmPlayerTrack` — the type has carried
               it all along for exactly this, and the full player never read it.
               So all three parts of the design were present (the field, the
               glyph styling, the centring) and only the line joining them was
               missing. Do not recompute it from the title here: MmmShell
               derives it once, at the two places it builds a track (search for
               `initial:` there), so a second rule would be free to disagree.

               aria-hidden because it is decoration: the title and artist are
               announced by the heading directly below, and a lone letter read
               out between them is noise. */
            <span aria-hidden="true">{track.initial}</span>
          )}
        </div>

        <div className="mmm-full-titles">
          <h2 className="mmm-full-title">{track.title}</h2>
          <p className="mmm-full-meta">
            {onOpenArtist ? (
              <button className="mmm-full-name" onClick={onOpenArtist} type="button">{track.artist}</button>
            ) : (
              <span className="mmm-full-name" data-plain="">{track.artist}</span>
            )}
            {track.album ? <span aria-hidden="true"> · </span> : null}
            {track.album
              ? onOpenAlbum
                ? <button className="mmm-full-name" onClick={onOpenAlbum} type="button">{track.album}</button>
                : <span className="mmm-full-name" data-plain="">{track.album}</span>
              : null}
          </p>
        </div>

        <div className="mmm-full-seek">
          <span className="mmm-full-clock">{clock(progress, durationSeconds)}</span>
          <input
            aria-label="Seek"
            className="mmm-player-range"
            data-accent=""
            max={100}
            min={0}
            onChange={(event) => onSeek(Number(event.target.value))}
            step={1}
            style={{ ['--fill' as string]: `${Math.max(0, Math.min(100, progress))}%` }}
            type="range"
            value={Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0}
          />
          <span className="mmm-full-clock" data-right="">{clock(100, durationSeconds)}</span>
        </div>

        <div className="mmm-full-transport">
          <button
            aria-label="Previous track"
            className="mmm-full-step"
            disabled={!canGoBack}
            onClick={onPrev}
            type="button"
          >
            <span aria-hidden="true">‹</span>
          </button>

          {canTogglePlay && (
            <button
              aria-label={playing ? 'Pause' : 'Play'}
              className="mmm-full-play"
              data-paused={!playing || undefined}
              onClick={onTogglePlay}
              type="button"
            >
              {/* `pathLength` normalises the circle to 100 so progress maps
                  straight onto it — the same trick the retired disc uses. */}
              {/* `currentColor` with an opacity attribute, rather than an
                  rgba() of a triplet: --ink-on-accent has no triplet, and
                  inventing one would mean a token name that resolves to
                  nothing — CSS then drops the declaration silently. */}
              <svg aria-hidden="true" height="78" viewBox="0 0 78 78" width="78">
                <circle cx="39" cy="39" fill="none" r="37.5" stroke="currentColor" strokeOpacity={0.24} strokeWidth="3" />
                <circle
                  cx="39"
                  cy="39"
                  fill="none"
                  pathLength={100}
                  r="37.5"
                  stroke="currentColor"
                  strokeDasharray={100}
                  strokeDashoffset={100 - Math.max(0, Math.min(100, progress))}
                  strokeLinecap="round"
                  strokeOpacity={0.9}
                  strokeWidth="3"
                  transform="rotate(-90 39 39)"
                />
              </svg>
              <span aria-hidden="true">{playing ? '❚❚' : '▶︎'}</span>
            </button>
          )}

          <button
            aria-label="Next track"
            className="mmm-full-step"
            disabled={!canGoForward}
            onClick={onNext}
            type="button"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        {/* Two acts, two controls — never one heart standing for both. The
            third square is filing, not an act: it puts the track somewhere. */}
        {(canHype || canFavourite || addTarget) && (
          <div className="mmm-full-acts" style={{ flexWrap: 'wrap' }}>
            {canHype && (
              <button
                aria-label={
                  hypeLocked
                    ? `Already hyped ${track.artist}${hypeLabel ? `. Available again in ${hypeLabel}` : ''}`
                    : `HYPE ${track.artist}`
                }
                aria-pressed={hyped}
                className="mmm-full-hype"
                data-hyped={hyped || undefined}
                data-locked={hypeLocked || undefined}
                disabled={hypeLocked}
                onClick={onToggleHype}
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 12 16" width="13">
                  <path d="M7 0 0 9h4l-1 7 8-9.5H6.5L7 0Z" fill="currentColor" />
                </svg>
                <span>HYPE</span>
                {hypeLocked && hypeLabel ? <span className="mmm-full-hype-wait">{hypeLabel}</span> : null}
              </button>
            )}
            {canFavourite && (
              <button
                aria-label={faved ? `Remove ${track.title} from your library` : `Save ${track.title} to your library`}
                aria-pressed={faved}
                className="mmm-full-fav"
                data-active={faved || undefined}
                onClick={onToggleFav}
                type="button"
              >
                <span aria-hidden="true">{faved ? '♥' : '♡'}</span>
              </button>
            )}
            {addTarget && <AddToPlaylist key={addTarget.mediaId} target={addTarget} />}
          </div>
        )}

        <div className="mmm-full-volume">
          <span aria-hidden="true" className="mmm-full-clock">♫</span>
          <input
            aria-label="Volume"
            className="mmm-player-range"
            max={100}
            min={0}
            onChange={(event) => onVolume(Number(event.target.value))}
            step={1}
            style={{ ['--fill' as string]: `${Math.max(0, Math.min(100, volume))}%` }}
            type="range"
            value={Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) : 0}
          />
          <span className="mmm-full-clock" data-right="">{Math.round(volume)}%</span>
        </div>

        {onSearch ? (
          /* Search leaves for discovery rather than filtering in place: this
             sheet is what is playing, and a result list inside it would be a
             second, smaller music module competing with the real one. */
          <form
            className="mmm-full-search"
            onSubmit={(event) => {
              event.preventDefault();
              const query = new FormData(event.currentTarget).get('q');
              const text = typeof query === 'string' ? query.trim() : '';
              if (text) onSearch(text);
            }}
            role="search"
          >
            <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              aria-label="Search tracks and artists"
              enterKeyHint="search"
              name="q"
              placeholder="Search tracks and artists"
              type="search"
            />
          </form>
        ) : null}

        {queue.length > 0 && (
          <div className="mmm-full-list">
            <p className="mmm-queue-eyebrow">Up next</p>
            {queue.map((item, index) => (
              <button
                className="mmm-queue-row"
                key={`q${index}-${item.title}`}
                onClick={() => pick(item, 'queue', index)}
                type="button"
              >
                <span className="mmm-queue-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="mmm-queue-title">{item.title}</span>
                <span className="mmm-queue-artist">{item.artist}</span>
              </button>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <div className="mmm-full-list" data-played="">
            <p className="mmm-queue-eyebrow">Played</p>
            {history.map((item, index) => (
              <button
                className="mmm-queue-row"
                key={`h${index}-${item.title}`}
                onClick={() => pick(item, 'history', index)}
                type="button"
              >
                <span aria-hidden="true" className="mmm-queue-index">·</span>
                <span className="mmm-queue-title">{item.title}</span>
                <span className="mmm-queue-artist">{item.artist}</span>
              </button>
            ))}
          </div>
        )}

        {/* Clears the fixed way-out square below. */}
        <div aria-hidden="true" className="mmm-full-tail" />
      </div>

      {/* The way out, in the corner the way out always lives in — the same
          square, in the same place, as the shell's nav trigger. Here it means
          back, so it carries its own label. */}
      <div className="mmm-full-exit">
        {/* A down arrow, not the mark. This sheet is pulled UP from the mini
            player and shrinks back down to it, so the control that closes it
            should be the inverse of the gesture that opened it. The mark read
            as "go to iHYPE" — a destination — which is not what this does. */}
        <button aria-label="Shrink back to the mini player" className="mmm-full-back" onClick={onClose} ref={closeRef} type="button">
          <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="22">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <span className="mmm-full-exit-label">Close</span>
      </div>
    </div>
  );
}
