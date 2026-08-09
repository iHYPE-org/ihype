export interface NavHintProps {
  /** The current module label. Falsy renders nothing. */
  label?: string | null;
  /** Left offset in px. Aligns with the trigger, which the hint sits above. */
  offset?: number;
  /** Bottom offset in px — must clear the trigger. */
  bottom?: number;
  /** The trigger's width. The label is centred across it, not left-aligned. */
  anchor?: number;
}
export declare function NavHint(props: NavHintProps): JSX.Element | null;
