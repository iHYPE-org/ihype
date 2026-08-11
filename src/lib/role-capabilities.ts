const HYPE_LINK_PROMOTER_ROLES = new Set(['FAN']);

/**
 * Keep this shared between navigation and server routes so hiding the menu
 * item never becomes the authorization boundary.
 *
 * The set was `['FAN', 'DJ']`; DJ is gone because the role is (deleted
 * 2026-08-06, out of both enums in schema.prisma), which leaves FAN alone.
 *
 * **That is narrower than the charter and is a known open item.** Design
 * System 8: "Promoters are Fans, Artists, or Venues who share a referral
 * link", and the 10% pool is money rather than an account type — every account
 * is meant to promote through its HYPE Link with nothing to sign up for. So
 * this should almost certainly be every role. It is not widened here because
 * that is a permissions change affecting server routes, and it has no business
 * riding along inside a dead-code sweep.
 */
export function canPromoteWithHypeLink(role: string | null | undefined) {
  return role ? HYPE_LINK_PROMOTER_ROLES.has(role) : false;
}
