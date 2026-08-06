/**
 * Where a signed-in member lands.
 *
 * This is the Music · Map · Me shell (DESIGN_SYNC row 268). It was built and
 * mounted at `/app` but deliberately left un-cut-over, because choosing between
 * it and `/listen`'s six-module deck was an operator decision rather than a
 * code one. That call has now been made: `/app` is the product.
 *
 * `/listen` still exists and still works — nothing was deleted here, so the
 * deck remains reachable and this is a one-line reversal if the call changes.
 * It is deliberately still gated below, for that reason.
 */
export const WORKBENCH_PATH = '/app/map';

/**
 * Every prefix middleware gates behind a session.
 *
 * Split out from `WORKBENCH_PATH` because the two things had been the same
 * string and are not the same idea: one is where you land, the other is what
 * requires a session. Tying the gate to the landing path meant that moving the
 * landing surface would silently stop protecting the old one.
 *
 * `/app` matters most here. Its layout does gate — but the layout is async
 * (auth plus a DB read), so by the time it calls `redirect()` the response has
 * already flushed and Next streams the redirect as a **200** with a marker in
 * the body. Browsers follow that; crawlers and monitors do not. Checking it in
 * middleware, before render, is what makes it a real 307 (row 268, item g).
 */
export const PROTECTED_PREFIXES = ['/app', '/listen', '/dashboard', '/admin'] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
// Generic (no-specific-destination) sign-ins land on Welcome first, which then
// routes on to WORKBENCH_PATH — matches the Auth → Welcome → Listen flow used
// for sign-up. A real deep-link callbackUrl (e.g. a show or ticket page the
// user was trying to reach) is preserved as-is and skips Welcome.
export const WELCOME_PATH = '/welcome';

export function isSafeLocalRedirect(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  if (path.includes('\n') || path.includes('\r')) return false;
  return true;
}

export function resolvePostAuthRedirect(path: string | null | undefined): string {
  if (!isSafeLocalRedirect(path)) return WELCOME_PATH;
  if (path === '/login' || path.startsWith('/login?')) return WELCOME_PATH;
  if (path.startsWith('/auth/')) return WELCOME_PATH;
  if (path === '/workbench' || path.startsWith('/workbench?')) return WELCOME_PATH;
  if (path === '/dashboard' || path.startsWith('/dashboard?')) return WELCOME_PATH;
  return path;
}
