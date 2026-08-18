/**
 * Where a signed-in member lands.
 *
 * This is the Music · Map · Me shell (DESIGN_SYNC row 268). It was built and
 * mounted at `/app` but deliberately left un-cut-over, because choosing between
 * it and `/listen`'s six-module deck was an operator decision rather than a
 * code one. That call has now been made: `/app` is the product.
 *
 * `/listen` and `/home` survive only as protected compatibility aliases. They
 * cannot render either retired surface and both lead back into MMM.
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
/**
 * NO LONGER THE GATE. `isProtectedPath` is default-deny as of 2026-08-18 and
 * does not read this list; see PUBLIC_EXACT / PUBLIC_PREFIXES below.
 *
 * It is kept because it still says something true and worth asserting: these
 * five must NEVER become public, whatever else changes. The test suite loops
 * over it for exactly that. Do not add a prefix here expecting it to protect
 * anything — a route is protected by not appearing in the public lists.
 */
export const PROTECTED_PREFIXES = ['/app', '/home', '/listen', '/dashboard', '/admin'] as const;

/**
 * The admin device-binding cookie, named here rather than in `admin-device.ts`.
 *
 * Middleware needs the NAME to gate `/admin` before the console renders (see
 * the block in `src/middleware.ts`, and note the paragraph above — the admin
 * device gate had exactly the streamed-200 bug that paragraph describes for
 * `/app`, and it leaked the whole console body). It must not import
 * `admin-device.ts` to learn it: that module reaches for `node:crypto` and
 * `ADMIN_DEVICE_SECRET` at call time, neither of which belongs in the Edge
 * middleware bundle.
 *
 * The alternative was a second copy of the string with a comment asking the
 * next person to keep them aligned by hand. This file already has that problem
 * with `public/sw.js`'s NETWORK_ONLY_PATHS and says so; one hand-aligned list
 * is enough. `admin-device.ts` imports this instead, so there is one definition
 * and a rename cannot half-apply.
 */
export const ADMIN_DEVICE_COOKIE = 'admin_device_token';

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

/**
 * The routes that must serve a signed-out stranger. Everything else needs a
 * session.
 *
 * This list is the whole security posture, so it is worth saying why it is
 * shaped as an allowlist of PUBLIC paths rather than the list of protected
 * ones it replaced.
 *
 * `PROTECTED_PREFIXES` named five prefixes and gated those. Every route outside
 * them was public — not by decision, but by default. Adding a page exposed it,
 * and nothing failed, warned, or asked; the only way to notice was to think of
 * it. A posture where the unsafe outcome is what you get for forgetting is not
 * a posture. Inverted, forgetting produces a login redirect: visible, annoying,
 * and harmless.
 *
 * What earns a place here is one question — must this serve someone who has no
 * account? Three kinds of route can answer yes:
 *
 *   1. The funnel. `/` and the kit pages are how strangers arrive; `/h` and
 *      `/invite` are the referral and invite entry points, and gating those is
 *      a deadlock — the charter's 10% promoter share is attributed by a link a
 *      stranger clicks. `/shows` is where a shared ticket link lands, and it
 *      is already proven safe anonymous: the Workerd smoke asserts on every
 *      deploy that an anonymous ticketed show response carries no protected
 *      media plan.
 *   2. Auth itself. Requiring a session to reach the pages that establish one
 *      is circular.
 *   3. Obligations. The privacy policy and terms have to be reachable without
 *      an account — Apple and Google both require a public policy URL for a
 *      store listing, and a consent link nobody can open is not consent.
 *
 * Deliberately NOT here: profiles (`/artists`, `/venues`, `/fans`), tracks and
 * playlists. They were public before this change. They are a product decision
 * rather than a security one, and the decision was to close them — the cost is
 * that sharing an artist link now asks for a sign-in, and that they no longer
 * unfurl or index.
 */
const PUBLIC_EXACT: readonly string[] = [
  '/',
  // Marketing and the founding-cohort funnel.
  '/join', '/beta', '/launch', '/walkthrough',
  '/for-artists', '/for-venues', '/for-fans', '/for-djs',
  // Advertiser front door and signup. The advertiser's own dashboard is not
  // here on purpose — it shows their campaigns and spend.
  '/advertise', '/advertise/register',
  // The public support form. `/support/tickets` is a member's own queue.
  '/support',
  '/status', '/offline',
  // Auth, and the pages that complete it.
  '/welcome', '/verify', '/verify-email',
  // Legal and policy, plus the legacy URLs that still appear in sent email,
  // consent copy and app-store listings.
  '/community-rules', '/copyright', '/ticket-policy',
  '/about', '/audit', '/charter', '/dmca', '/legal', '/privacy', '/terms', '/transparency',
];

const PUBLIC_PREFIXES: readonly string[] = [
  '/login', '/register', '/auth',
  '/info', '/journal',
];

/**
 * Prefixes whose PUBLIC part is exactly one segment deep.
 *
 * `/shows/<slug>` has to serve a stranger. `/shows/<slug>/scan`, `/checkin`,
 * `/qr` and `/poster` are door-staff and organiser tooling and must not — so a
 * plain prefix rule here would be too generous by four routes. They each run
 * their own authorization (checkin returns 401 without a session), but a gate
 * that relies on every descendant defending itself is the posture this change
 * exists to replace.
 *
 * `/h/<code>` and `/invite/<code>` are single-segment by construction, and
 * `/embed/<hexId>` is iframed onto other people's sites. Depth-limiting them
 * costs nothing and means a future `/embed/<id>/admin` is protected the day it
 * is created rather than the day someone remembers.
 */
const PUBLIC_SINGLE_SEGMENT: readonly string[] = ['/shows', '/h', '/invite', '/embed'];

/**
 * Exceptions one level deeper: metadata routes Next generates for a public
 * page. An unfurled ticket link needs its card image, and the image is derived
 * from the same show the page already shows a stranger.
 */
const PUBLIC_DEEP_EXACT_SUFFIXES: readonly string[] = ['/opengraph-image', '/twitter-image'];

/**
 * Static files under `public/` come through the same middleware matcher as
 * pages — icons, `manifest.json`, `sw.js`, `robots.txt`, `.well-known/*` — so
 * a default-deny gate would redirect the service worker and the app icons to a
 * login page. Every one of them has a file extension and no page route does,
 * which is the cheapest reliable way to tell them apart at the edge.
 */
function isStaticAsset(pathname: string): boolean {
  return (pathname.split('/').pop() ?? '').includes('.');
}

export function isPublicPath(pathname: string): boolean {
  if ((SESSION_EXEMPT_PATHS as readonly string[]).includes(pathname)) return true;
  if (isStaticAsset(pathname)) return true;
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  return PUBLIC_SINGLE_SEGMENT.some((prefix) => {
    if (!pathname.startsWith(`${prefix}/`)) return false;
    const rest = pathname.slice(prefix.length + 1);
    if (rest === '' || rest.includes('/')) {
      // Deeper than one segment: only a metadata route for that same page.
      return PUBLIC_DEEP_EXACT_SUFFIXES.some(
        (suffix) => rest.endsWith(suffix) && rest.slice(0, -suffix.length).length > 0
          && !rest.slice(0, -suffix.length).replace(/\/$/, '').includes('/'),
      );
    }
    return true;
  });
}

export function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname);
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
