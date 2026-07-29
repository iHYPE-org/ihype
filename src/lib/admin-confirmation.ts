import { kvGet, kvPut } from '@/lib/kv';
import { log } from '@/lib/logger';

// Tracks recent admin re-authentication (via passkey or other strong
// challenge) in KV so we can require fresh credentials before destructive
// actions like suspend, promote, or broadcast.
//
// Flow:
//   1. Admin triggers destructive action.
//   2. Server calls `requireRecentAdminReauth(userId)`. If it returns false,
//      the route responds with `{ requiresReauth: true }` and a 401 status.
//   3. Client prompts the admin to re-authenticate via `<AdminConfirmButton>`.
//      That component POSTs to `/api/admin/reauth` with the passkey
//      assertion, which calls `markAdminReauth(userId)` on success.
//   4. Client retries the original destructive action.

const REAUTH_TTL_SECONDS = 15 * 60;

function key(userId: string) {
  return `admin_reauth:${userId}`;
}

export async function markAdminReauth(userId: string): Promise<void> {
  try {
    await kvPut(key(userId), Date.now(), { ex: REAUTH_TTL_SECONDS });
  } catch (err) {
    log.error('[admin-confirmation]', err instanceof Error ? err : { error: String(err) }, 'markAdminReauth failed');
  }
}

export async function hasRecentAdminReauth(userId: string): Promise<boolean> {
  try {
    const value = await kvGet<number>(key(userId));
    return Boolean(value);
  } catch (err) {
    log.error('[admin-confirmation]', err instanceof Error ? err : { error: String(err) }, 'hasRecentAdminReauth failed');
    return false;
  }
}

export async function requireRecentAdminReauth(userId: string): Promise<boolean> {
  return hasRecentAdminReauth(userId);
}
