'use client';

/**
 * The persistent mini player, pinned bottom-right of the logo trigger.
 *
 * Opening the nav dims *everything*, player included — the handoff's explicit
 * requirement. It fades and drops (`data-hidden`) rather than unmounting, so the
 * transition can play out both ways, and is made non-interactive while hidden so
 * it cannot be reached by pointer or keyboard behind the scrim.
 *
 * This is presentation over the shared playback state; it owns no audio element
 * of its own. Play/pause now drives the real `MediaPlayerProvider` the rest of
 * the site uses — it used to be local state that toggled an icon and nothing
 * else, which was open item (d) on DESIGN_SYNC row 268.
 *
 * `canTogglePlay` is false when the pill is showing the server-resolved "your
 * most recent listen" rather than a track the audio element actually holds.
 * That record carries no URL, so there is nothing to start; the control is
 * omitted instead of rendered as a button that cannot work.
 *
 * ## HYPE and the heart are two controls, not one
 *
 * ADHERENCE rule 22, and this player used to break it: a single heart wrote
 * through to `/api/hype`, so the mechanic the product is named after was drawn
 * as, and read as, a bookmark. They are different acts and they now have
 * different buttons and different gates:
 *
 *  - **HYPE** spends from your balance and moves the artist up the local chart.
 *    It carries the **bolt from the mark, drawn as SVG** — the obvious glyph for
 *    it is an emoji and the system does not use emoji. Gated on `canHype`: the
 *    layout resolves "no linked profile", "not discoverable" and "your own
 *    profile" server-side, so it is never a control whose every press is refused.
 *  - **The heart** only saves the track to your library, through
 *    `/api/fan-favorites`. Gated on `canFavourite`, which is the opposite
 *    condition — saving needs the actual track, because that endpoint takes a
 *    media id and a URL, and it is FAN/ADMIN only.
 *
 * So on a server-resolved recent listen you get HYPE and no heart; on a real
 * playing track you get both. That asymmetry is the point, not an oversight.
 */
export function MmmPlayer({
  canFavourite,
  canHype,
  canTogglePlay,
  favourited,
  hidden,
  hyped,
  onToggleFavourite,
  onToggleHype,
  onTogglePlay,
  playing,
  track,
}: {
  canFavourite: boolean;
  canHype: boolean;
  canTogglePlay: boolean;
  favourited: boolean;
  hidden: boolean;
  hyped: boolean;
  onToggleFavourite: () => void;
  onToggleHype: () => void;
  onTogglePlay: () => void;
  playing: boolean;
  track: { title: string; artist: string; initial: string } | null;
}) {
  if (!track) return null;
  return (
    <div aria-hidden={hidden} className="mmm-player" data-hidden={hidden}>
      <div aria-hidden="true" className="mmm-player-art">{track.initial}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mmm-player-track">{track.title}</div>
        <div className="mmm-player-artist">{track.artist}</div>
      </div>
      {canHype && (
        <button
          aria-label={hyped ? `Remove hype from ${track.artist}` : `Hype ${track.artist}`}
          aria-pressed={hyped}
          className="mmm-player-hype"
          data-on={hyped}
          onClick={onToggleHype}
          tabIndex={hidden ? -1 : 0}
          type="button"
        >
          {/* The bolt from the iHYPE mark. Drawn inline rather than loaded so it
              inherits currentColor and does not depend on an asset path \u2014 and it
              is the reason HYPE does not need an emoji. */}
          <svg aria-hidden="true" focusable="false" height="15" viewBox="0 0 24 24" width="15">
            <path d="M13.2 2 4 13.6h5.4L8.6 22 19 9.9h-5.6z" fill="currentColor" />
          </svg>
          {/* The word, always. State is the fill and the border, never a rename:
              SHELL_LOCK \u2014 "HYPE always reads HYPE." */}
          <span className="mmm-player-hype-label">HYPE</span>
        </button>
      )}
      {canFavourite && (
        <button
          aria-label={favourited ? `Remove ${track.title} from your library` : `Save ${track.title} to your library`}
          aria-pressed={favourited}
          className="mmm-player-icon"
          onClick={onToggleFavourite}
          tabIndex={hidden ? -1 : 0}
          type="button"
        >
          <span aria-hidden="true">{favourited ? '\u2665' : '\u2661'}</span>
        </button>
      )}
      {canTogglePlay && (
        <button
          aria-label={playing ? 'Pause' : 'Play'}
          className="mmm-player-play"
          onClick={onTogglePlay}
          tabIndex={hidden ? -1 : 0}
          type="button"
        >
          <span aria-hidden="true">{playing ? '\u275a\u275a' : '\u25b6'}</span>
        </button>
      )}
    </div>
  );
}
