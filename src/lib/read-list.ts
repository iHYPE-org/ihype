/**
 * A list read that remembers whether it succeeded.
 *
 * `promise.catch(() => [])` is the idiom every server pane used for a list
 * whose failure must not 500 the page — and it throws away the one fact the
 * render needs next: an empty array from a query that found nothing and an
 * empty array from a query that never ran are the same value. Every panel
 * then rendered its EMPTY sentence over both ("{name} has not published any
 * releases yet", "No notifications yet", "You're all caught up"), which is a
 * claim about the member on top of a read that never landed. DESIGN_SYNC row
 * 408 wrote the rule for the MUSIC tabs — an empty state is only ever rendered
 * over reads that actually succeeded — and this is the same rule for the
 * server-rendered surfaces.
 *
 * `null` means the read FAILED, the same convention every counter on the same
 * pages already follows (`null` renders as a dash, never 0). Callers render
 * `rows ?? []` and show their unavailable sentence when `rows === null`.
 * `server-page-empty-claims.test.ts` refuses a bare `.catch(() => [])` in a
 * server page so the fact of failure cannot be discarded before render again.
 */
export async function readList<T>(promise: Promise<T[]>): Promise<T[] | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}
