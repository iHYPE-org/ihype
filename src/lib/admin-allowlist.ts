/**
 * Who is allowed to hold ADMIN, as one list in one place.
 *
 * The rule: **only `admin@ihype.org` may be an administrator.** An explicit
 * product decision, and it matches how the platform already bootstraps —
 * `POST /api/admin/setup` has always hardcoded that address when it creates the
 * account. What did not exist was anything stopping a *different* row from
 * holding the role: `isAdminSession()` asked only whether `role === 'ADMIN'`,
 * so any user record that acquired that value — by an operator's hand, a bad
 * migration, a restored backup, or a compromised endpoint — was an admin.
 *
 * Dependency-light on purpose (no `@/lib/db`, no `next/*`): this is imported by
 * the auth callbacks, by route handlers and by tests.
 *
 * ## The address is normalised, not compared raw
 *
 * `ADMIN@iHYPE.org ` and `admin@ihype.org` are the same mailbox, and a rule
 * that treats them differently is a rule that fails open the first time someone
 * types their own address with a capital letter. Local-part case is technically
 * significant in SMTP and universally ignored in practice; the domain never is.
 *
 * ## Overriding it
 *
 * `ADMIN_ALLOWED_EMAILS` (comma-separated) replaces the default, for the case
 * where an operator genuinely needs a second administrator. It is read through
 * `readRuntimeEnv` at the call site rather than captured at module load, which
 * is the mistake `ADMIN_EMAIL` made — `process.env` at import time is empty in
 * a Worker, so that const silently resolved to its default forever
 * (see `src/lib/env.ts`). An unparseable or empty value falls back to the
 * default rather than to an empty allowlist, because an empty allowlist locks
 * everybody out of `/admin` including the person trying to fix it.
 */

/** The one address the product is documented around. */
export const DEFAULT_ADMIN_EMAIL = 'admin@ihype.org';

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * The effective allowlist. `raw` is the value of `ADMIN_ALLOWED_EMAILS`; pass
 * undefined for the default. Always contains at least one entry.
 */
export function adminAllowlist(raw?: string | null): string[] {
  const parsed = (raw ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter((entry) => entry.includes('@'));
  return parsed.length ? parsed : [DEFAULT_ADMIN_EMAIL];
}

/**
 * Whether this address may hold ADMIN.
 *
 * A null or empty address is NOT allowed. That case is real rather than
 * theoretical: `User.email` is nullable and the passkey signup path collects no
 * address at all, so "no email" must not be treated as "not disallowed".
 */
export function isAllowedAdminEmail(email: string | null | undefined, raw?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return adminAllowlist(raw).includes(normalized);
}
