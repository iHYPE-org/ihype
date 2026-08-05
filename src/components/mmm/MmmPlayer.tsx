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
 * The hype toggle IS real: it writes through to `/api/hype`, the same endpoint
 * an artist page's HypeButton posts to, so a heart tapped here counts once and
 * spends from the same balance. The heart renders only when the artist is
 * actually hypeable (`canHype`) — the layout resolves "no linked profile",
 * "not discoverable" and "your own profile" server-side, so this is never a
 * control whose every press is refused.
 */
export function MmmPlayer({
  canHype,
  canTogglePlay,
  hidden,
  hyped,
  onToggleHype,
  onTogglePlay,
  playing,
  track,
}: {
  canHype: boolean;
  canTogglePlay: boolean;
  hidden: boolean;
  hyped: boolean;
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
          className="mmm-player-icon"
          onClick={onToggleHype}
          tabIndex={hidden ? -1 : 0}
          type="button"
        >
          <span aria-hidden="true">{hyped ? '\u2665' : '\u2661'}</span>
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
