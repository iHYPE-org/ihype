/**
 * iHYPE HypeButton component.
 * The platform's namesake mechanic — a flame toggle with a live count, scale-pop + expanding-ring
 * animation on activation. Used anywhere a fan hypes an artist, track, or show (Discover, Show Detail,
 * Track Detail, Profile Page). Owns only the tap animation; the caller owns count/active state
 * (and any hype-budget limit — pass `disabled` + `disabledReason` when the fan is out of hypes).
 */
export interface HypeButtonProps {
  /** Whether this fan has already hyped this item. */
  active?: boolean;
  /** Current hype count, already formatted (e.g. "4,821"). */
  count?: string | number;
  onToggle?: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md' | 'lg';
  /** True when the fan is out of hypes this week — dims the button and disables the tap. */
  disabled?: boolean;
  /** Tooltip shown when disabled, e.g. "0 hypes left — resets Monday". */
  disabledReason?: string;
  /** Override the flame/active color (defaults to brand accent #ff5029). Use a role color for a role-scoped feed. */
  roleColor?: string;
  /** Optional momentum readout shown after the count, e.g. "▲ 340/hr" — the demand-velocity signal that sets HYPE apart from a plain like count. */
  trend?: string;
}
export declare function HypeButton(props: HypeButtonProps): JSX.Element;
