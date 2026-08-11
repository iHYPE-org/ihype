/**
 * Who can promote with a HYPE Link — everyone with an account.
 *
 * The 10% promoter slice is MONEY, not an account type. There is no promoter
 * role and no DJ role; every member shares their own link (to social, to a
 * group chat, anywhere outside the app) and earns a proportional share of the
 * pool for the ticket sales it drove. Nothing to sign up for, nothing to
 * switch to. Design System 8 states it directly: "Promoters are Fans, Artists,
 * or Venues who share a referral link."
 *
 * This was `['FAN', 'DJ']` — two hardcoded roles, one of which no longer
 * exists — which silently denied artists and venues a share of a pool the
 * charter says is theirs to earn from.
 *
 * Kept as a function rather than deleted at the call sites: it is shared
 * between navigation and server routes so that hiding a menu item never
 * becomes the authorization boundary, and that split is still worth having if
 * eligibility ever narrows again (a suspended account, say).
 */
export function canPromoteWithHypeLink(role: string | null | undefined) {
  return Boolean(role);
}
