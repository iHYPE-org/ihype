/**
 * iHYPE Card component.
 * Surface container with optional title and link row.
 */
export interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Optional section title */
  title?: string;
  /** Optional action link label */
  link?: string;
  /** Style overrides */
  style?: React.CSSProperties;
}
