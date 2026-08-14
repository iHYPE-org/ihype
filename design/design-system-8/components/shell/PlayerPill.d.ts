export interface PlayerTrack {
  title: string;
  artist: string;
  /** Optional; appended to the artist line as "artist · album". *
 * @startingPoint section="App Shell" subtitle="Persistent mini player bar" viewport="700x420"
 */
  album?: string;
  initial: string;
  /** Track length in seconds. Both the bar and the full player read it, so the
   *  two surfaces cannot disagree about it. Defaults to 220. */
  seconds?: number;
}
export interface PlayerPillProps {
  /** null renders nothing — never invent a placeholder track. */
  track: PlayerTrack | null;
  /** Fades and drops the player, and makes it non-interactive.
   *  Named `dimmed` because `hidden` is a reserved HTML attribute. */
  dimmed?: boolean;
  playing?: boolean;
  /** HYPE is a spend against your balance that moves the artist up the local
   *  chart. Distinct from `faved`, which only saves the track. */
  hyped?: boolean;
  /** Saved to your library. A heart, and nothing to do with HYPE. */
  faved?: boolean;
  /** Shown inside the HYPE control. Omit to render the bolt alone. */
  hypeCount?: string | number;
  /** Artwork + play only. For narrow frames; the full bar needs ~460px. */
  compact?: boolean;
  /** Resolved upstream. False hides the heart rather than showing one that fails. */
  canHype?: boolean;
  /** False when the player shows a listen record with no playable URL. */
  canTogglePlay?: boolean;
  /** 0–100. Playback position. */
  progress?: number;
  /** 0–100. */
  volume?: number;
  /** Upcoming tracks, shown under "Up next" in the queue panel. */
  queue?: PlayerTrack[];
  /** Already played, shown greyed below a rule in the queue panel. */
  history?: PlayerTrack[];
  queueOpen?: boolean;
  /** Docking. `left` should be the logo trigger's width plus the gap, so the
   *  player sits immediately right of it and shares its baseline. */
  left?: number;
  bottom?: number;
  /** Any CSS width. Defaults to a fluid min(760px, calc(100vw - 150px)) — a fixed
   *  narrow pill starves the track line and leaves the seek bar unusable. */
  width?: number | string;
  onToggleHype?: () => void;
  onToggleFav?: () => void;
  onTogglePlay?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** Receives 0–100. */
  onSeek?: (value: number) => void;
  /** Receives 0–100. */
  onVolume?: (value: number) => void;
  onToggleQueue?: () => void;
  onPickTrack?: (track: PlayerTrack, list: 'queue' | 'history', index: number) => void;
  /** Phone width: drops prev/next, favourite and the volume track — they do not
   *  fit beside the artwork at 393px and are all reachable elsewhere. */
  narrow?: boolean;
  /** Phone only: the artwork opens the full-screen player. */
  onExpand?: () => void;
  /** Phone only: search rides at the bar's left edge. Omitted, it is not drawn. */
  onSearch?: () => void;
  /** Stops the title marquee. */
  reduceMotion?: boolean;
  /** Hype has landed and the 24-hour window has not reopened. Shows the wait. */
  hypeLocked?: boolean;
  /** What to show while locked, e.g. "17h 40m". */
  hypeLabel?: string;
  /** The artwork is the size toggle: it retires the player to its disc. */
  artistOpen?: boolean;
  albumOpen?: boolean;
  /** The artist name in the meta line. Separate destination from the release. */
  onOpenArtist?: (track: PlayerTrack) => void;
  /** The release name in the meta line. */
  onOpenAlbum?: (track: PlayerTrack) => void;
  /**
   * Bump this to wake the player on a phone: it returns to full size, raised,
   * and restarts its idle countdown. The shell bumps it when the logo nav is
   * tapped. Any number will do — only a change is read.
   */
  wake?: number;
  /** How long the full player stays up before retiring to the disc. */
  idleMs?: number;
  /**
   * Height of the logo trigger the pill docks against. The pill centres on that
   * button's mid-line rather than sharing its baseline, so the two read as one
   * piece of furniture whatever height the pill grows to.
   */
  anchorHeight?: number;
}
export declare function PlayerPill(props: PlayerPillProps): JSX.Element | null;
