/**
 * A read that remembers whether it succeeded.
 *
 * `promise.catch(() => [])` and `promise.catch(() => 0)` were the idioms on
 * every server page for a read whose failure must not 500 the page — and each
 * throws away the one fact the render needs next: an empty array from a query
 * that found nothing and an empty array from a query that never ran are the
 * same value, and so are a count of zero and a count that could not be taken.
 * Every panel then rendered its EMPTY sentence or a confident 0 over both
 * ("{name} has not published any releases yet", "You're all caught up", "No
 * reports yet", Users: 0), which is a claim about the member or the platform
 * made on top of a read that never landed. DESIGN_SYNC row 408 wrote the rule
 * for the MUSIC tabs — an empty state is only ever rendered over reads that
 * actually succeeded — and rows 448 and 449 apply it to the server-rendered
 * member panes and to the operator console.
 *
 * `null` means the read FAILED, the same convention `analytics-engine.ts`,
 * `admin-workbench.ts` and every counter on the profile panes already follow
 * (`null` renders as a dash, never 0). Callers render `rows ?? []` and show
 * their unavailable sentence when the value is `null`.
 * `server-page-empty-claims.test.ts` refuses a bare `.catch(() => [])` or
 * `.catch(() => 0)` in a server page so the fact of failure cannot be
 * discarded before render again.
 */
export async function readValue<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/** `readValue` for a list read; kept as its own name so a call site reads as one. */
export async function readList<T>(promise: Promise<T[]>): Promise<T[] | null> {
  return readValue(promise);
}
