import type { PlayerTrack } from './PlayerPill';

export interface FullPlayerProps {
  /** Phone only. Opened by the bar's artwork, closed by the corner square. */
  open?: boolean;
  track?: PlayerTrack;
  playing?: boolean;
  /** 0–100. */
  progress?: number;
  /** 0–100. */
  volume?: number;
  hyped?: boolean;
  /** Hype spent; the 24-hour window has not reopened. */
  hypeLocked?: boolean;
  /** Wait remaining, e.g. "17h 40m". */
  hypeLabel?: string;
  faved?: boolean;
  queue?: PlayerTrack[];
  history?: PlayerTrack[];
  /** Device insets. The overlay is fixed, so it owns its own safe area. */
  safeTop?: number;
  safeBottom?: number;
  onClose?: () => void;
  onTogglePlay?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeek?: (pct: number) => void;
  onVolume?: (pct: number) => void;
  onToggleHype?: () => void;
  onToggleFav?: () => void;
  onPickTrack?: (track: PlayerTrack, list: 'queue' | 'history', index: number) => void;
  onOpenArtist?: (track: PlayerTrack) => void;
  onOpenAlbum?: (track: PlayerTrack) => void;
}

export declare function FullPlayer(props: FullPlayerProps): JSX.Element | null;
