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

/* A load IN FLIGHT is shared too, but only within ONE REQUEST (2026-09-24,
   DESIGN_SYNC row 513). The memo above held only resolved rows, so on a cold
   or expired entry a Listen tab's bootstrap, which runs four route handlers
   side by side and each calls `auth()`, issued four identical reads at once.
   The pending promise is keyed by the request's own scope object (the
   Cloudflare context `db.ts` already keys its per-request client on), never
   shared across requests: in a Worker, a promise created by one request and
   awaited by another hangs the second if the first is cancelled. No scope,
   no sharing, exactly as before. */
const inflight = new WeakMap<object, Map<string, Promise<SessionUserRow | null>>>();

/* Bumped by `forgetSessionUser`, so a load that began before a version bump
   is never written into the memo after it. */
const generation = new Map<string, number>();

export async function readSessionUser(
  userId: string,
  load: (userId: string) => Promise<SessionUserRow | null>,
  now: () => number = Date.now,
  scope: object | null = null,
): Promise<SessionUserRow | null> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now()) return hit.row;

  const pending = scope ? inflight.get(scope)?.get(userId) : undefined;
  if (pending) return pending;

  const startedAt = generation.get(userId) ?? 0;
  const promise = load(userId).then((row) => {
    if ((generation.get(userId) ?? 0) === startedAt) {
      if (cache.size >= MAX_ENTRIES) {
        // Drop the oldest insertion; Map iterates in insertion order.
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(userId, { row, expiresAt: now() + SESSION_USER_TTL_MS });
    }
    return row;
  });
  if (scope) {
    let perScope = inflight.get(scope);
    if (!perScope) {
      perScope = new Map();
      inflight.set(scope, perScope);
    }
    perScope.set(userId, promise);
    // A failed load is not memoised: the next call asks again (fail closed).
    const release = () => { if (perScope!.get(userId) === promise) perScope!.delete(userId); };
    promise.then(release, release);
  }
  return promise;
}

/** Called by every writer that bumps `userSecurityVersion`, so this isolate forgets at once. */
export function forgetSessionUser(userId: string) {
  cache.delete(userId);
  generation.set(userId, (generation.get(userId) ?? 0) + 1);
}

/** Test seam. */
export function resetSessionUserCache() {
  cache.clear();
  generation.clear();
}
