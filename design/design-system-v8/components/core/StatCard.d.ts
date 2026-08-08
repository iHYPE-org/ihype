/**
 * iHYPE StatCard component.
 * A single metric tile — value + label, optional trend delta. Used across dashboards, audit, and transparency pages.
 */
export interface StatCardProps {
  /** Big metric value, e.g. "1,247" or "$389,412" */
  value: React.ReactNode;
  /** Small uppercase caption below the value */
  label: string;
  /** Value + caption color */
  accent?: string;
  /** Optional small trend line under the label, e.g. "+12% this week" */
  delta?: React.ReactNode;
  style?: React.CSSProperties;
}
