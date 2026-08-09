export interface IconActionProps {
  /** The glyph, when you are not passing children. */
  glyph?: string;
  /** What the button does. Used as the accessible name AND the tooltip text. */
  label: string;
  onClick?: (e: MouseEvent) => void;
  /** Edge length in px. Default 40 — at or above the 44px target once the
   *  surrounding gap is counted. */
  size?: number;
  /** Destructive actions take the red hover treatment. Default false. */
  danger?: boolean;
  /** Milliseconds of hover or press before the tooltip shows. Default 380. */
  delay?: number;
  /** Custom glyph content, e.g. an inline SVG. Overrides `glyph`. */
  children?: React.ReactNode;
}

export declare function IconAction(props: IconActionProps): JSX.Element;
