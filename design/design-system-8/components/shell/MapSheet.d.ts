export interface MapSheetRow { label: string; value: string; accent?: boolean }
export interface MapSheetLine {
  /** "9:00 PM", "Doors 8" — mono, fixed column. */
  time: string;
  title: string;
  meta?: string;
  /** Price, capacity, whatever the row is worth. */
  value?: string;
}
export interface MapSheetAction {
  label: string;
  href: string;
}
export interface MapSheetTarget {
  /** Eyebrow — "Venue", "Artist", "Show". */
  kind?: string;
  title: string;
  meta?: string;
  body?: string;
  /** A day's lineup, in playing order. Rendered above the stat rows. */
  lines?: MapSheetLine[];
  /** Primary link out — the venue's or artist's own page. */
  action?: MapSheetAction;
  rows?: MapSheetRow[];
}
export interface MapSheetProps {
  /** null renders nothing. Leaving the map must clear this. */
  target: MapSheetTarget | null;
  onClose?: () => void;
}
export declare function MapSheet(props: MapSheetProps): JSX.Element | null;
