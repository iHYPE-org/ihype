export interface SeedItem {
  /** Artist name, shown largest and tappable through to the artist page. */
  artist: string;
  /** Track title for the clip that is playing. */
  song: string;
  /** Release the clip is from. */
  album: string;
  /** Single letter used as the fallback graphic until an artist uploads one. */
  initial: string;
  /** Two colours of the artist's card gradient, used until artwork exists. */
  c1: string;
  c2: string;
  /** Why this card is in the deck — proximity, or a hype in your history. */
  why: string;
}

export interface SeedDeckProps {
  /** The deck, in order. Cards behind the top one are drawn from index + 1, + 2. */
  items: SeedItem[];
  /** Index of the top card. The parent owns it so skip and save can differ. */
  index?: number;
  /** Whether the top card's artist is already hyped by this member. */
  hyped?: boolean;
  /** Number of cards saved so far, shown under the controls. */
  savedCount?: number;
  /** Room the deck has to fill, in px. The card sizes down to fit rather than
   *  running under the player; omitted, the card sits at its natural 436. */
  maxHeight?: number;
  /** Hype has landed; the 24-hour window has not reopened. */
  hypeLocked?: boolean;
  /** What to show while locked, e.g. "17h 40m". */
  hypeLabel?: string;
  /** Length of the clip in seconds, 15–30. Drives the progress ring only. */
  clipSeconds?: number;
  /** Clip is running. Pauses the ring when false. */
  playing?: boolean;
  onSkip?: (item: SeedItem) => void;
  onSave?: (item: SeedItem) => void;
  onHype?: (item: SeedItem) => void;
  onOpenArtist?: (item: SeedItem) => void;
  /** Pause or resume the clip from the card itself. */
  onTogglePlay?: () => void;
}

export declare function SeedDeck(props: SeedDeckProps): JSX.Element;
