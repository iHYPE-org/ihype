/**
 * iHYPE Button component.
 * Primary action surface. Three tones: solid, ghost, outline.
 * Role-color aware — pass `roleColor` to override accent.
 */
export interface ButtonProps {
  /** Button label */
  children: React.ReactNode;
  /** Visual style */
  tone?: 'solid' | 'ghost' | 'outline';
  /** Override accent with a role color */
  accent?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Leading icon node */
  leading?: React.ReactNode;
  /** Full-width */
  full?: boolean;
  /** Click handler */
  onClick?: () => void;
}
