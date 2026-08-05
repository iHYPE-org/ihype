/**
 * iHYPE Eyebrow component.
 * Small all-caps JetBrains Mono label used above sections and as metadata tags.
 * Usage: <Eyebrow color={T.venue}>TONIGHT · 9:00 PM</Eyebrow>
 */
export interface EyebrowProps {
  children: React.ReactNode;
  /** Text color (defaults to --ink-3) */
  color?: string;
}
