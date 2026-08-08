export interface LogoTriggerProps {
  /** Whether the arc nav is open — drives aria-expanded and the label.
   *  Named `expanded` because `open` is a reserved HTML attribute. */
  expanded?: boolean;
  /** True only while audio is actually playing; shows the eq bars. */
  playing?: boolean;
  onClick?: () => void;
  /** Tile size in px. 76 is the shell default; the corner radius follows it. */
  size?: number;
}
export declare function LogoTrigger(props: LogoTriggerProps): JSX.Element;
