/**
 * iHYPE checkbox with optional label and detail line. Controlled — pass checked + onChange.
 */
export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  detail?: string;
  disabled?: boolean;
  /** Check fill color. Defaults to --accent */
  accent?: string;
}
