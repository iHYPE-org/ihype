/**
 * iHYPE StatusPill component.
 * Rounded status indicator for connection/verification/moderation states (e.g. Stripe Connect status, ticket status).
 */
export interface StatusPillProps {
  children: React.ReactNode;
  /** Semantic tone */
  tone?: 'ok' | 'pending' | 'warn' | 'neutral';
  /** Show a small dot before the label */
  dot?: boolean;
}
