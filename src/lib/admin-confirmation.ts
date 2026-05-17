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

const REAUTH_TTL_SECONDS = 5 * 60;

function key(userId: string) {
  return `admin_reauth:${userId}`;
}

export async function markAdminReauth(userId: string): Promise<void> {
  if (!process.env.KV_REST_API_URL) return;
  try {
    const { kv } = await import('@vercel/kv');
    await kv.set(key(userId), Date.now(), { ex: REAUTH_TTL_SECONDS });
  } catch (err) {
    console.error('[admin-confirmation] markAdminReauth failed', err);
  }
}

export async function hasRecentAdminReauth(userId: string): Promise<boolean> {
  if (!process.env.KV_REST_API_URL) {
    // In local dev without KV, do not enforce.
    return true;
  }
  try {
    const { kv } = await import('@vercel/kv');
    const value = await kv.get<number>(key(userId));
    return Boolean(value);
  } catch (err) {
    console.error('[admin-confirmation] hasRecentAdminReauth failed', err);
    return false;
  }
}

export async function requireRecentAdminReauth(userId: string): Promise<boolean> {
  return hasRecentAdminReauth(userId);
}
