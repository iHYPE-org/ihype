/**
 * iHYPE Avatar component.
 * Circular user avatar with initials fallback and role-color ring.
 */
export interface AvatarProps {
  /** Display name (used for initials) */
  name: string;
  /** Role color for ring */
  roleColor?: string;
  /** Size in px (default 32) */
  size?: number;
}
