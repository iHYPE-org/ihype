/**
 * iHYPE ListRow component.
 * Shared row shape for payout history, support tickets, booking inbox — leading icon/avatar, title + meta, trailing value/action.
 */
export interface ListRowProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Trailing value, badge, or action button */
  trailing?: React.ReactNode;
  onClick?: () => void;
}
