/**
 * iHYPE Badge component.
 * Small label chip for role identity, status, counts.
 */
export interface BadgeProps {
  /** Badge text */
  children: React.ReactNode;
  /** Color override (defaults to accent) */
  color?: string;
  /** Filled vs outline */
  variant?: 'filled' | 'outline';
}
