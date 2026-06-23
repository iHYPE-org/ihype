/**
 * iHYPE progress bar. Animated fill; accent-colored; optional label + percentage.
 */
export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Fill color. Defaults to --accent */
  accent?: string;
  height?: number;
  label?: string;
  showValue?: boolean;
  style?: React.CSSProperties;
}
