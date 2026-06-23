/**
 * iHYPE radio group. Controlled — pass value + onChange.
 * Options can be strings or {value, label} objects.
 */
export interface RadioOption { value: string | number; label: string; }
export interface RadioProps {
  options: Array<RadioOption | string>;
  value?: string | number;
  onChange?: (value: string | number) => void;
  accent?: string;
}
