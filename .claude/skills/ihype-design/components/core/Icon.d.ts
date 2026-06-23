/**
 * iHYPE Icon component — renders any Lucide icon by name.
 * Requires Lucide UMD loaded in page head:
 * `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>`
 */
export interface IconProps {
  /** Lucide icon name (camelCase), e.g. "music", "calendar", "heart" */
  name: string;
  /** Size in px (square). Default: 16 */
  size?: number;
  /** Stroke color. Defaults to --ink-1 */
  color?: string;
  /** SVG stroke-width. Default: 1.6 */
  strokeWidth?: number;
  style?: React.CSSProperties;
}
