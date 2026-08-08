/**
 * iHYPE EmptyState component.
 * "Nothing here yet" pattern for inboxes, tickets, history lists.
 */
export interface EmptyStateProps {
  /** Optional leading glyph/emoji */
  icon?: React.ReactNode;
  title: string;
  detail?: React.ReactNode;
  /** Optional action, e.g. a Button */
  action?: React.ReactNode;
}
