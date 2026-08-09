/**
 * iHYPE dropdown selector. Controlled; pass value + onChange.
 * Animates open with ihype-scale-in; closes on outside click.
 */
export interface SelectOption { value: string | number; label: string; }
export interface SelectProps {
  label?: string;
  options: Array<SelectOption | string>;
  value?: string | number;
  onChange?: (value: string | number) => void;
  error?: string;
  hint?: string;
  style?: React.CSSProperties;
}
