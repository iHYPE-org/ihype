/**
 * iHYPE selectable filter chip. Used for genre tags, role filters, and status labels.
 * Toggles between active (accent-tinted) and inactive (muted) states.
 */
export interface ChipProps {
  /** Chip label */
  children: React.ReactNode;
  /** Accent color when active */
  accent?: string;
  /** Controlled active state */
  active?: boolean;
  /** Optional leading node (dot, icon) */
  leading?: React.ReactNode;
  /** Click handler — parent manages active state */
  onClick?: () => void;
}
