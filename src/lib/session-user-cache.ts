/**
 * The per-isolate memo in front of `auth()`'s security-version read.
 *
 * Every `auth()` call re-reads the user's `userSecurityVersion` and `email`
 * from the database so a suspension, an erasure or an address leaving the
 * admin allowlist ends a live session without waiting twelve hours for the
 * token to expire. That rule is right and it stays. What it cost is that a
 * single shell screen — the layout's `auth()`, the page's `auth()`, then two
 * to six API calls the tabs fire after mount — paid the same read five or six
 * times over, one cross-region round-trip each, and the member felt every one
 * as lag between tapping a destination and seeing it (2026-09-23, DESIGN_SYNC
 * row 509).
 *
 * So the read is memoised HERE, per Worker isolate, for `SESSION_USER_TTL_MS`.
 * The trade, stated: a bump to `userSecurityVersion` can take up to that long
 * to end a session on an isolate that read the row just before the bump. That
 * is the suspend-or-erase path (`suspendUserAction`, `executeAccountErasure`),
 * both of which call `forgetSessionUser()` so the isolate that performed the
 * bump forgets at once; other isolates learn on expiry. Signing out a single
 * device is NOT this path — it is the KV tombstone in `session-revocation.ts`,
 * read on every call, and stays exact.
 *
 * Direction of failure is unchanged: the loader's own throw still propagates
 * (the caller fails CLOSED, as `auth.ts` explains), and a `null` row — the
 * user is gone — is memoised too, because asking again every request for a
 * user who does not exist is the same waste.
 */

export type SessionUserRow = { userSecurityVersion: number; email: string | null };

export const SESSION_USER_TTL_MS = 30_000;

type Entry = { row: SessionUserRow | null; expiresAt: number };

const cache = new Map<string, Entry>();

/** Bounded so a long-lived isolate serving many members cannot grow without limit. */
const MAX_ENTRIES = 5_000;

export async function readSessionUser(
  userId: string,
  load: (userId: string) => Promise<SessionUserRow | null>,
  now: () => number = Date.now,
): Promise<SessionUserRow | null> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now()) return hit.row;
  const row = await load(userId);
  if (cache.size >= MAX_ENTRIES) {
    // Drop the oldest insertion; Map iterates in insertion order.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(userId, { row, expiresAt: now() + SESSION_USER_TTL_MS });
  return row;
}

/** Called by every writer that bumps `userSecurityVersion`, so this isolate forgets at once. */
export function forgetSessionUser(userId: string) {
  cache.delete(userId);
}

/** Test seam. */
export function resetSessionUserCache() {
  cache.clear();
}
