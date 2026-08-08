/**
 * iHYPE transient notification message. Four variants map to semantic color tokens.
 * Render in a fixed overlay container; manage visibility with React state.
 */
export interface ToastProps {
  /** Primary message (short) */
  message: string;
  /** Optional secondary line */
  detail?: string;
  /** success | warn | error | info */
  variant?: 'success' | 'warn' | 'error' | 'info';
  /** Close handler — omit to hide the × button */
  onClose?: () => void;
}
