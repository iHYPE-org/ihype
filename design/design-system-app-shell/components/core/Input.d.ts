/**
 * iHYPE text input field with optional label, hint, leading/trailing icons, and error state.
 * Use for search, forms, and data entry on both mobile and workbench surfaces.
 */
export interface InputProps {
  /** Visible label above the field (mono caps) */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Controlled value */
  value?: string;
  /** Change handler — receives the new string value */
  onChange?: (value: string) => void;
  /** Helper text below the field */
  hint?: string;
  /** Error message — overrides hint, turns border accent-red */
  error?: string;
  /** Leading icon node */
  leading?: React.ReactNode;
  /** Trailing icon or button node */
  trailing?: React.ReactNode;
  /** Disables the field at 45% opacity */
  disabled?: boolean;
  /** HTML input type */
  type?: 'text' | 'email' | 'password' | 'search' | 'number';
}
