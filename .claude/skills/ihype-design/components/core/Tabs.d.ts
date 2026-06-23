/**
 * iHYPE horizontal tab bar. Used in panels and screens with multiple views.
 * Active tab gets an accent-colored bottom border; inactive tabs are muted.
 */
export interface TabsProps {
  /** Tab definitions */
  tabs: Array<{ id: string; label: string; count?: number }>;
  /** Active tab id */
  active?: string;
  /** Change handler — receives new tab id */
  onChange?: (id: string) => void;
  /** Active indicator color */
  accent?: string;
}
