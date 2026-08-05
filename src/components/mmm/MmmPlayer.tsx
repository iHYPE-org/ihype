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
 * of its own. The hype toggle writes through to the real profile-hype endpoint
 * the rest of the app uses, so a heart tapped here counts the same as one
 * tapped on an artist page.
 */
export function MmmPlayer({
  hidden,
  hyped,
  onToggleHype,
  onTogglePlay,
  playing,
  track,
}: {
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
      <button
        aria-label={playing ? 'Pause' : 'Play'}
        className="mmm-player-play"
        onClick={onTogglePlay}
        tabIndex={hidden ? -1 : 0}
        type="button"
      >
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>
    </div>
  );
}
