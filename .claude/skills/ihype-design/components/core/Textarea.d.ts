/**
 * iHYPE Textarea component.
 * Multiline field for support tickets, cancellation reasons, longer-form inputs.
 */
export interface TextareaProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  hint?: string;
  error?: string;
  rows?: number;
  disabled?: boolean;
}
