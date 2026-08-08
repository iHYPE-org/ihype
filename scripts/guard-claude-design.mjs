import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(relativePath, requiredText, reason) {
  const file = read(relativePath);

  if (!file.includes(requiredText)) {
    throw new Error(`${relativePath} is missing "${requiredText}". ${reason}`);
  }
}

function assertNotIncludes(relativePath, removedText, reason) {
  const file = read(relativePath);

  if (file.includes(removedText)) {
    throw new Error(`${relativePath} still includes "${removedText}". ${reason}`);
  }
}

function assertMissing(relativePath, reason) {
  if (existsSync(path.join(root, relativePath))) {
    throw new Error(`${relativePath} should not exist. ${reason}`);
  }
}

// ── One app shell ────────────────────────────────────────────────────────
//
// This guard used to assert the opposite of what it asserts now: that /listen
// was "the canonical authenticated module deck" and had to render a live,
// backend-wired ModuleDeckMockup. Design system v8 retired that surface — it is
// the pre-shell three-tab app, `templates/fan-app/` in the bundle's own Removed
// list — and the Music · Map · Me shell at /app is the only app shell.
//
// The guard's PURPOSE is unchanged and is the reason it was rewritten rather
// than deleted: there must be exactly one signed-in surface, and it must not
// drift back to two silently. That is not hypothetical. While /listen and /app
// both existed, a member who left the shell for a ticket or a page landed in
// the other one with no route back for the rest of the session, and reported it
// as "I still see older versions" — the shell was live, was the landing
// surface, and still nobody saw it.
assertIncludes(
  'src/lib/auth-redirects.ts',
  "WORKBENCH_PATH = '/app/map'",
  'All successful auth paths should resolve to the canonical app surface.'
);
assertIncludes(
  'src/app/app/layout.tsx',
  'MmmShell',
  'The shell must stay mounted in the /app LAYOUT: the map is the base layer and a '
  + 'layout is the only place the App Router preserves a subtree across navigation.'
);
// The surfaces v8 retired. Each is a REDIRECT into the shell, not a 404 and not
// a rendered page: their URLs are already in sent emails, push payloads, the
// sitemap and the Stripe Connect return flow, so a 404 would strand a member
// holding a real link — while rendering the old surface is the regression above.
for (const [relativePath, destination] of [
  ['src/app/listen/page.tsx', "redirect('/app/music/discover')"],
  ['src/app/discover/page.tsx', "redirect('/app/music/discover')"],
  ['src/app/search/page.tsx', "redirect('/app/music/discover')"],
  ['src/app/radio/page.tsx', "redirect('/app/music/radio')"],
  ['src/app/shows/map/page.tsx', "redirect('/app/map')"],
  ['src/app/home/page.tsx', "redirect('/app/map')"],
  ['src/app/studio/page.tsx', "redirect('/app/map')"],
]) {
  assertIncludes(
    relativePath, destination,
    'A surface design system v8 retired must forward into the shell, not render.'
  );
}
// The components those surfaces were built from. Listed by name because a
// redirect page is easy to keep and a 1,000-line deck is easy to reintroduce
// beside it — which is exactly how there came to be two.
for (const relativePath of [
  'src/components/ListenHome.tsx',
  'src/components/MobileAppShell.tsx',
  'src/components/RouteShellSlot.tsx',
  'src/lib/MobileShellContext.tsx',
  'src/app/ui-preview/page.tsx',
  'src/app/ui-preview/ModuleDeckMockup.tsx',
  'src/app/workbench/page.tsx',
]) {
  assertMissing(
    relativePath,
    'Retired with the pre-shell three-tab app. Do not recreate it as a second '
    + 'authenticated app — see ROUTE_TEMPLATE_MAP.md, Removed.'
  );
}
// The map's CSP allowance has to name the route the map is actually on.
// maplibre-gl builds its tile worker from a blob: URL, so without this the map
// silently fails to initialise — and this allowance was left keyed on /listen
// and /ui-preview when the map moved to /app, on the one route whose whole
// point is the map.
assertIncludes(
  'src/middleware.ts',
  "pathname === '/app' || pathname.startsWith('/app/')",
  "The scene-map CSP allowance (worker-src blob:, geolocation) must cover the shell."
);
assertIncludes(
  'src/components/AuthLogin.tsx',
  'resolvePostAuthRedirect',
  'Client auth flows should share the server-side redirect resolver.'
);
assertIncludes(
  'src/components/AuthRegister.tsx',
  'resolvePostAuthRedirect',
  'Client auth flows should share the server-side redirect resolver.'
);
assertNotIncludes(
  'src/components/AuthLogin.tsx',
  'getAuthLandingPath',
  'The old /auth/landing trampoline should not come back as the post-login target.'
);
for (const relativePath of [
  'src/app/admin/page.tsx',
  'src/app/admin/audit/page.tsx',
  'src/app/admin/broadcast/page.tsx',
  'src/app/admin/journal/page.tsx',
  'src/app/admin/review/page.tsx',
  'src/app/admin/users/page.tsx'
]) {
  assertNotIncludes(
    relativePath,
    '/auth/landing',
    'App navigation should send signed-in users directly to /home instead of the legacy auth landing trampoline.'
  );
}
assertIncludes(
  'src/lib/auth-session.ts',
  'buildAuthSessionCookie',
  'Manual OTP/passkey/magic-link session issuance should stay centralized.'
);
assertIncludes(
  'src/app/api/auth/passkey/auth/route.ts',
  'buildAuthSessionCookie',
  'Passkey sign-in should use the shared Auth.js session cookie helper.'
);
assertIncludes(
  'src/app/api/auth/passkey/register-first/route.ts',
  'buildAuthSessionCookie',
  'First-passkey signup should use the shared Auth.js session cookie helper.'
);
assertIncludes(
  'src/app/api/auth/magic/route.ts',
  'buildAuthSessionCookie',
  'Magic-link sign-in should use the shared Auth.js session cookie helper.'
);

const nextConfig = read('next.config.mjs');
if (!nextConfig.includes("source: '/home'") || !nextConfig.includes("value: 'no-store'")) {
  throw new Error('next.config.mjs must keep /home on Cache-Control: no-store.');
}
for (const legacySource of ["source: '/workbench'", "source: '/workbench/:path*'", "source: '/dashboard'"]) {
  if (!nextConfig.includes(legacySource) || !nextConfig.includes("destination: '/home'")) {
    throw new Error(`next.config.mjs must keep ${legacySource} redirecting to /home.`);
  }
}

assertIncludes(
  'public/sw.js',
  "'/home'",
  'The service worker should treat /home as a known route.'
);
assertIncludes(
  'public/sw.js',
  'NETWORK_ONLY_PATHS',
  'Authenticated workbench routes must remain network-only.'
);
assertNotIncludes(
  'public/sw.js',
  "  '/home',\n  '/shows'",
  '/home must not be listed in CORE_PAGES for stale-while-revalidate caching.'
);
assertIncludes(
  'src/app/robots.ts',
  "'/home'",
  'The authenticated workbench should remain noindex via robots.'
);

console.log('Design guard passed: /app is the only app shell, and the retired surfaces stay retired.');
