/**
 * iHYPE Toggle / Switch component.
 * Privacy-first settings rows use this for on/off controls.
 */
export interface ToggleProps {
  /** Controlled on state */
  on?: boolean;
  /** Toggle label */
  label: string;
  /** Supporting detail */
  detail?: string;
  /** Change handler */
  onChange?: (v: boolean) => void;
}
