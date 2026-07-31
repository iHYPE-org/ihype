const HYPE_LINK_PROMOTER_ROLES = new Set(['FAN', 'DJ']);

/**
 * HYPE Link promotion is intentionally limited to the two audience-building
 * roles. Keep this shared between navigation and server routes so hiding the
 * menu item never becomes the authorization boundary.
 */
export function canPromoteWithHypeLink(role: string | null | undefined) {
  return role ? HYPE_LINK_PROMOTER_ROLES.has(role) : false;
}
