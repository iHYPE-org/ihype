/**
 * COUNTS OVER A WHOLE SET, BESIDE A LIST THAT IS ONE PAGE OF IT
 * (DESIGN_SYNC row 459).
 *
 * Every capped list in this product renders the newest N rows. A figure
 * derived from those rows — a sum, a count, an unread badge — is a claim
 * about the whole set, and it is wrong for exactly the members who have the
 * most of whatever it counts: the venue past 100 payouts read a lifetime
 * total that omitted the older ones, the member past 50 notifications read
 * fifty unread however many they had.
 *
 * So the caller counts with the database and the surface renders THAT, and
 * these two helpers hold the only two judgements that follow.
 */

/**
 * The unread figure to show, given the server's count over every row, this
 * page's own count, and how many the member has marked read since the page
 * was rendered.
 *
 * `null` from the server means the count FAILED or was never taken — the
 * page's own figure is then all this surface can honestly claim, which is
 * what it claimed before the count existed. It is never treated as zero.
 *
 * The page's figure is a FLOOR: rows on screen that are visibly unread must
 * keep counting even if a stale server figure has fallen below them.
 */
export function visibleUnreadCount(
  serverUnread: number | null,
  pageUnread: number,
  resolvedHere: number,
): number {
  if (serverUnread === null) return pageUnread;
  return Math.max(pageUnread, serverUnread - resolvedHere);
}

/**
 * Whether a list is showing a page of something larger, and therefore owes
 * the reader a sentence saying so. `null` is an absent or failed count: say
 * nothing rather than guess, because "showing all of them" is also a claim.
 */
export function isTruncatedList(shown: number, total: number | null): boolean {
  if (total === null) return false;
  return total > shown;
}
