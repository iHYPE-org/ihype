/**
 * iHYPE loading skeleton placeholder. Animates with a shimmer sweep.
 * Requires ihype-shimmer @keyframes (add to motion.css or inline).
 */
export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}
export interface SkeletonTextProps {
  /** Number of lines */
  lines?: number;
  /** Width of the last (stub) line */
  lastWidth?: string;
  style?: React.CSSProperties;
}
