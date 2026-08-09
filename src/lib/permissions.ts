import type { Session } from 'next-auth';
import { isAllowedAdminEmail } from '@/lib/admin-allowlist';

function isAdminRole(role: string | null | undefined) {
  return role === 'ADMIN';
}

/**
 * Admin requires BOTH the role and an allowlisted address.
 *
 * The role is already clamped in the jwt callback (`clampAdminRole` in
 * `src/lib/auth.ts`), so in normal operation the email test here can never be
 * the one that fails. It is a second lock on the same door on purpose: this
 * helper takes a `Session` object, and a `Session` can reach it from somewhere
 * other than that callback — a test fixture, a future provider, a hand-built
 * object in a route. The rule should not depend on which path constructed it.
 *
 * Synchronous, so it stays a drop-in for the ~40 call sites. That means it
 * reads `session.user.email` rather than the database; the authoritative check
 * against the stored address is the token clamp, which does read the row.
 *
 * NOTE: `ADMIN_ALLOWED_EMAILS` is deliberately not consulted here. Reading env
 * would make this async or import the runtime-env helper into a module used by
 * client components. An operator who widens the allowlist widens it at the
 * clamp; this stays pinned to the documented address, so the override cannot
 * be used to slip past both locks at once.
 */
export function isAdminSession(session: Session | null | undefined) {
  if (!isAdminRole(session?.user?.role)) return false;
  return isAllowedAdminEmail(session?.user?.email);
}

export function canManageOwnedResource(
  session: Session | null | undefined,
  ownerId: string | null | undefined
) {
  if (!session?.user?.id || !ownerId) {
    return false;
  }

  return isAdminSession(session) || session.user.id === ownerId;
}
