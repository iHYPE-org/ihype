/**
 * Signing in as a member, from the admin console.
 *
 * The most dangerous control the console has: it mints a real session for
 * somebody else's account. Everything here exists to make that both bounded
 * and attributable.
 *
 * ## How the session carries it
 *
 * The impersonated session is an ordinary auth token for the TARGET user, plus
 * one extra claim — `imp`, the real operator's user id. That shape is chosen
 * deliberately over the alternatives:
 *
 *   - Every existing permission check keeps working untouched. The session IS
 *     the member's, so a route that asks "is this your ticket" gets the right
 *     answer without learning about impersonation.
 *   - The claim lives INSIDE the signed JWT, so it cannot be set by a client.
 *     Nothing reads impersonation state from a header, a query string or an
 *     unsigned cookie.
 *   - Exit needs no second sign-in: the operator's id is right there, so the
 *     admin session can be re-minted from it.
 *
 * `auth.ts`'s jwt callback returns the token it was given, so the claim
 * survives the security-version re-read on every `auth()` call.
 *
 * ## What is NOT claimed
 *
 * This does not make impersonation read-only. An impersonated session can do
 * whatever that member can do, because it is that member's session — that is
 * the point, and pretending otherwise would be worse than saying so. The
 * mitigations are that it is refused for other admins, written to the audit log
 * before the session exists, and visible on screen the whole time.
 *
 * Dependency-light on purpose (no `@/lib/db`, no `next/*`): the guards are the
 * part worth testing, and the banner imports the type.
 */

/** The JWT claim holding the real operator's id while impersonating. */
export const IMPERSONATOR_CLAIM = 'imp';

export type ImpersonationTarget = {
  id: string;
  role: string;
};

export type ImpersonationRefusal =
  | 'not-found'
  | 'target-is-admin'
  | 'target-is-self';

/**
 * Whether this account may be impersonated, and why not when it may not.
 *
 * Two refusals, and the first is the one that matters:
 *
 *   - **An ADMIN is never a target.** Otherwise this is a privilege-escalation
 *     path straight around the allowlist: an operator who should not hold ADMIN
 *     could assume the session of one who does. `clampAdminRole` would not help
 *     — the minted token would carry a genuinely admin email.
 *   - **Nor is yourself.** Harmless but incoherent: it would write an audit row
 *     claiming an operator impersonated themselves, and leave a session whose
 *     exit restores the session it replaced.
 *
 * Returns `null` when the target is allowed, so the caller reads as
 * `const refusal = refuseImpersonation(...); if (refusal) return …`.
 */
export function refuseImpersonation(
  target: ImpersonationTarget | null | undefined,
  operatorId: string,
): ImpersonationRefusal | null {
  if (!target) return 'not-found';
  if (target.role === 'ADMIN') return 'target-is-admin';
  if (target.id === operatorId) return 'target-is-self';
  return null;
}

/**
 * What the caller is told. Deliberately uniform across refusals that concern
 * another account: an operator who may not impersonate an admin does not need
 * to learn, from the error text, which accounts are admins.
 */
export function refusalMessage(refusal: ImpersonationRefusal): string {
  switch (refusal) {
    case 'target-is-self':
      return 'You are already signed in as this account.';
    case 'not-found':
    case 'target-is-admin':
    default:
      return 'That account cannot be signed in as.';
  }
}

/** HTTP status for a refusal. Not-found and admin-target deliberately agree. */
export function refusalStatus(refusal: ImpersonationRefusal): number {
  return refusal === 'target-is-self' ? 409 : 404;
}

/**
 * Reads the operator id out of a decoded session/token object.
 *
 * Anything that is not a non-empty string is treated as absent. A token whose
 * claim is a number, an object or an empty string is not impersonating — and
 * must not be allowed to end up as a user id in a lookup.
 */
export function readImpersonatorId(source: Record<string, unknown> | null | undefined): string | null {
  const value = source?.[IMPERSONATOR_CLAIM];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
