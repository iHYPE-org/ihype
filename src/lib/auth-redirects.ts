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

/**
 * The two pages under a protected prefix that must work WITHOUT a session.
 *
 * Both are account-recovery paths, and gating them is a deadlock: each exists
 * precisely for the moment you cannot sign in, so requiring a sign-in to reach
 * one means it can never be used for the thing it is for.
 *
 * - `/admin/setup` bootstraps the administrator account. On a deployment with
 *   no admin — which is every deployment, once — the gate redirected it to
 *   `/login`, and the only account that could get past `/login` was the one the
 *   page existed to create. Signing up instead is not a way round it:
 *   `isReservedPlatformEmail()` refuses `@ihype.org` at `/api/register`, by
 *   design. So the platform had no reachable path to its own admin account.
 * - `/admin/device-register` completes an emailed one-time-token link during
 *   device re-registration. It authenticates on the token in the URL, and the
 *   session it would establish is the thing being recovered.
 *
 * Neither is unprotected by this exemption; both were always protected by
 * something other than the session cookie. `/admin/setup` needs the
 * `ADMIN_SETUP_SECRET` bearer token, is rate-limited, and returns 410 unless
 * `ALLOW_ADMIN_SETUP` is `true` — so on a normal deployment the page renders a
 * form that cannot do anything. `/admin/device-register` needs a valid,
 * unexpired, single-use token. The middleware gate was redundant with those and
 * fatal to both.
 *
 * Exact matches only. A prefix test would exempt `/admin/setup-users` and any
 * other real admin page that happened to start with these strings.
 */
export const SESSION_EXEMPT_PATHS = ['/admin/setup', '/admin/device-register'] as const;

export function isProtectedPath(pathname: string): boolean {
  if ((SESSION_EXEMPT_PATHS as readonly string[]).includes(pathname)) return false;
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
/**
 * Signing IN lands on the map — the same first screen for everybody.
 *
 * This used to send every generic sign-in to `/welcome`, which then forwarded
 * to `WORKBENCH_PATH`, so the first thing a returning member saw was an
 * interstitial on the way to the place they were going. Combined with the
 * ADMIN branch that used to live in the magic-link handler, the platform owner
 * never landed in the product at all.
 *
 * `/welcome` is still the right screen for a NEW account — it is first-run
 * onboarding, not a redirect step — so `AuthRegister` asks for it explicitly.
 * The distinction is signing UP versus signing IN, which is why it now lives at
 * the two call sites that know which one happened rather than in a shared
 * default that cannot tell them apart.
 *
 * A real deep-link callbackUrl (a show or ticket the member was trying to
 * reach) is preserved as-is, exactly as before.
 */
export const WELCOME_PATH = '/welcome';

export function isSafeLocalRedirect(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  if (path.includes('\n') || path.includes('\r')) return false;
  return true;
}

export function resolvePostAuthRedirect(path: string | null | undefined): string {
  if (!isSafeLocalRedirect(path)) return WORKBENCH_PATH;
  if (path === '/login' || path.startsWith('/login?')) return WORKBENCH_PATH;
  if (path.startsWith('/auth/')) return WORKBENCH_PATH;
  // `/workbench` and `/dashboard` are retired routes with no page.tsx. They
  // resolve forward rather than 404 because they still appear in old bookmarks
  // and in links already sent by email.
  if (path === '/workbench' || path.startsWith('/workbench?')) return WORKBENCH_PATH;
  if (path === '/dashboard' || path.startsWith('/dashboard?')) return WORKBENCH_PATH;
  return path;
}
