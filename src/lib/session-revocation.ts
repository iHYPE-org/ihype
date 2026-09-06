import { kvGet, kvPut } from '@/lib/kv';
import { log } from '@/lib/logger';

/**
 * Signing out ends the session on the server, not just in the browser.
 *
 * ## What this closes
 *
 * The session is a self-contained signed JWT with a twelve-hour life, and
 * signing out only expired the COOKIE. Anyone who had already copied the token
 * — a shared or borrowed computer, a proxy log, a synced clipboard — could go
 * on using it for the rest of those twelve hours, and the member who signed
 * out had no way to stop them. "Sign out" is the control people reach for
 * precisely when they think someone else may have had their session, so it
 * failing quietly is worse than most gaps of this size. Recorded as a
 * follow-up by the 2026-09-02 sweep.
 *
 * ## Why per-device rather than bumping `userSecurityVersion`
 *
 * `userSecurityVersion` already exists and is compared on every `auth()` call,
 * so incrementing it on sign-out would be a one-line fix. It would also sign
 * the member out of every device they own — closing a laptop's session on a
 * library computer would end the one on their phone. That is the correct
 * behaviour for "sign out everywhere" and the wrong behaviour for "sign out",
 * and the two should not be the same button.
 *
 * Every token already carries a `jti` (`buildAuthSessionCookie` mints one), so
 * a tombstone under that id revokes exactly one device. The record expires
 * when the token it revokes would have expired anyway: nothing accumulates.
 *
 * ## Direction of failure
 *
 * A KV read that throws counts as NOT revoked. Failing the other way would
 * turn any KV incident into a forced global sign-out of every member at once —
 * a far larger event than the one this defends against, and this is a
 * supplementary control: the token still expires on its own in twelve hours.
 * Note the deliberate contrast with the security-version check in `auth.ts`,
 * which fails CLOSED, because there a database outage means the primary
 * control cannot be evaluated at all.
 */

const TOMBSTONE_PREFIX = 'revoked_session:';

/** Guard against a caller handing us something that is not a jti. */
function tombstoneKey(jti: string) {
  return `${TOMBSTONE_PREFIX}${jti}`;
}

/**
 * Mark one session token dead.
 *
 * `expiresAtSeconds` is the token's own `exp` claim: the tombstone only has to
 * outlive the token, so it is kept for exactly as long as the token could
 * still be presented and not a moment longer.
 */
export async function revokeSessionJti(jti: string | undefined | null, expiresAtSeconds?: number | null) {
  if (!jti || typeof jti !== 'string') return;

  const now = Math.floor(Date.now() / 1000);
  const remaining = typeof expiresAtSeconds === 'number' ? expiresAtSeconds - now : null;
  // An already-expired token needs no tombstone; an unknown expiry gets the
  // full session length, which is the longest one could possibly be valid.
  if (remaining !== null && remaining <= 0) return;
  const ttl = Math.min(remaining ?? 12 * 60 * 60, 12 * 60 * 60);

  try {
    await kvPut(tombstoneKey(jti), '1', { ex: Math.max(60, ttl) });
  } catch (error) {
    log.error(
      '[session-revocation]',
      error instanceof Error ? error : { error: String(error) },
      'could not revoke a session on sign-out',
    );
  }
}

/** Whether this token has been signed out. Unreadable KV answers "no" — see the header. */
export async function isSessionRevoked(jti: unknown): Promise<boolean> {
  if (!jti || typeof jti !== 'string') return false;

  try {
    return (await kvGet<string>(tombstoneKey(jti))) != null;
  } catch (error) {
    log.error(
      '[session-revocation]',
      error instanceof Error ? error : { error: String(error) },
      'could not check the sign-out list',
    );
    return false;
  }
}
