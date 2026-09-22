'use client';

import { useCallback, useRef } from 'react';
import { usePlayIntent } from '@/components/mmm/MmmPlayIntent';
import { useI18n } from '@/components/I18nProvider';

/**
 * The now-playing pill — the only chrome the shell draws, and only while a
 * track is loaded.
 *
 * (2026-09-22, owner: "The chrome button bottom nav is no longer the direction
 * we're going for the design of this app. You can remove those components to
 * save space", then, asked where the transport should live once the dock was
 * gone: "Floating pill while playing — a compact pill at the bottom that
 * appears only when a track is loaded and disappears when nothing is. No chrome
 * the rest of the time".)
 *
 * ## What this replaced
 *
 * The walnut dock (`MmmDock.tsx`, deleted): four labelled tabs and, above them
 * while a track played, this same mini player. The tabs are text links in the
 * site header now (`AdaptiveSiteHeader.tsx`), so the bottom of every screen is
 * the surface's own — the map gets its full height, every list its last row —
 * and the one thing that still needs to float is the player, because "what is
 * playing, and stop it" has to be reachable from any surface without opening
 * anything.
 *
 * ## What is wired, and every one of these is pre-existing behaviour
 *
 *  - **The universal transport, unchanged.** A tap resolves three things in
 *    order: pause what is playing, else start what the surface registered
 *    (`MmmPlayIntent.tsx`), else turn the radio on (`onPlayFallback`). The pill
 *    only exists with a track loaded, so in practice the first branch is the
 *    one a member reaches — the chain is kept whole because the test that pins
 *    it (`mmm-transport-chain.test.ts`) pins the ORDER, and a control that
 *    could resolve to nothing is the bug it exists to refuse.
 *  - `onExpand` opens the full player from the title and artwork.
 *  - `onNext` / `onPrev` are the skips; `playing` lights the key.
 *  - `wakeAudio` survives verbatim: browsers only start audio inside a user
 *    gesture, so the context is resumed on the press. Deleting it makes the
 *    first play of a session fail silently on iOS.
 *  - One short `vibrate` on the transport, because a play/pause is a real
 *    state change and a phone confirming it is useful.
 *
 * ## Geometry
 *
 * The pill is absolutely positioned inside `.mmm-frame`, rides
 * `--mmm-dock-lift` (the cookie banner's measured height) like the dock did,
 * and its presence is what moves `--mmm-chrome-size` off zero — through the
 * one `:has(.mmm-mini)` rule in `mmm.css`, so a pane clears it only while it
 * is there. The class names are the dock's mini player's (`.mmm-mini*`,
 * `.mmm-key`) on purpose: the e2e suite, `measure:chrome` and the seed deck's
 * bottom reservation all read them.
 *
 * It shows `currentTrack` and never `nowPlaying` — the latter is a
 * server-resolved last listen with NO url, so a play key under it would start
 * a different song than the one named beside it. That rule is the shell's.
 */

function PlayGlyph({ playing }: { playing: boolean }) {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 20 20" width="19">
      {playing ? (
        <path d="M7 4.2v11.6M13 4.2v11.6" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
      ) : (
        <path d="M6.4 3.9 16 10l-9.6 6.1V3.9Z" fill="currentColor" />
      )}
    </svg>
  );
}

function SkipGlyph({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 20 20" width="17">
      <g transform={dir === 'prev' ? 'translate(20,0) scale(-1,1)' : undefined}>
        <path d="M4.6 4.4 13 10l-8.4 5.6V4.4Z" fill="currentColor" />
        <path d="M15.4 4.6v10.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      </g>
    </svg>
  );
}

export type MmmNowPlayingTrack = {
  title: string;
  artist: string;
  initial: string;
  artworkUrl: string | null;
};

export function MmmNowPlaying({
  canTogglePlay,
  onExpand,
  onNext,
  onPlayFallback,
  onPrev,
  onTogglePlay,
  playing,
  track,
}: {
  canTogglePlay: boolean;
  onExpand: () => void;
  onNext: () => void;
  /** Turn the radio on: the last resort when the surface offers nothing. */
  onPlayFallback: () => void;
  onPrev: () => void;
  onTogglePlay: () => void;
  playing: boolean;
  /** What the pill shows. Null means nothing is loaded, and nothing renders. */
  track: MmmNowPlayingTrack | null;
}) {
  const { t } = useI18n();

  /* Pause the current track, start what this surface offers, or turn the radio
     on — in that order. See MmmPlayIntent.tsx for why the registration is a
     FUNCTION rather than a track. */
  const playIntent = usePlayIntent();
  const togglePlay = canTogglePlay ? onTogglePlay : (playIntent ?? onPlayFallback);

  const audio = useRef<AudioContext | null>(null);
  const wakeAudio = useCallback(() => {
    try {
      if (!audio.current && typeof AudioContext !== 'undefined') audio.current = new AudioContext();
      if (audio.current?.state === 'suspended') void audio.current.resume();
    } catch { /* no audio */ }
  }, []);

  const press = useCallback(() => {
    wakeAudio();
    try { if (navigator.vibrate) navigator.vibrate(6); } catch { /* no haptics */ }
  }, [wakeAudio]);

  if (!track) return null;

  return (
    <div className="mmm-mini" role="region" aria-label={t('mmmNowPlaying.region', 'Now playing')}>
      <button
        aria-label={`Now playing: ${track.title} by ${track.artist}. Open the player.`}
        className="mmm-mini-open"
        onClick={onExpand}
        type="button"
      >
        <span className="mmm-mini-art">
          {track.artworkUrl
            ? <img alt="" src={track.artworkUrl} />
            : <span aria-hidden="true">{track.initial}</span>}
        </span>
        <span className="mmm-mini-meta">
          <span className="mmm-mini-title">{track.title}</span>
          <span className="mmm-mini-artist">{track.artist}</span>
        </span>
      </button>
      <div className="mmm-mini-transport">
        <button
          aria-label={t('mmmNowPlaying.previous', 'Previous')}
          className="mmm-key"
          onClick={() => { press(); onPrev(); }}
          type="button"
        >
          <SkipGlyph dir="prev" />
        </button>
        <button
          aria-label={playing ? 'Pause' : 'Play'}
          aria-pressed={playing}
          className="mmm-key"
          data-lit={playing}
          onClick={() => { press(); togglePlay(); }}
          type="button"
        >
          <PlayGlyph playing={playing} />
        </button>
        <button
          aria-label={t('mmmNowPlaying.next', 'Next')}
          className="mmm-key"
          onClick={() => { press(); onNext(); }}
          type="button"
        >
          <SkipGlyph dir="next" />
        </button>
      </div>
    </div>
  );
}
