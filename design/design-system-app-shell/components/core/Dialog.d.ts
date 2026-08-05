/**
 * iHYPE modal dialog. Renders a backdrop + centered panel with header and body.
 * Animates in with ihype-scale-in; close via backdrop click or ✕ button.
 */
export interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  /** Panel width in px. Default: 480 */
  width?: number;
}
