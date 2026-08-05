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

// The canonical authenticated experience is the Music · Map · Me shell at
// /app (operator decision, 2026-08-05). Everything this guard used to protect
// about /listen's six-module deck now applies to /app instead — the deck, the
// legacy app shell and the phone swipe shell are all retired, and the point of
// these assertions is that none of them creeps back as a second signed-in app.
// That is the "ghost popping through" the operator reported.
for (const [legacy, destination] of [
  ['src/app/home/page.tsx', "redirect('/listen')"],
  ['src/app/listen/page.tsx', "redirect('/app/music/discover')"],
  ['src/app/shows/page.tsx', "redirect('/app/map')"],
  ['src/app/pages/page.tsx', "redirect('/app/me')"],
]) {
  assertIncludes(
    legacy,
    destination,
    `${legacy} must be a redirect only — it must not render a second authenticated app.`
  );
}
// The shell must stay in the /app LAYOUT. In a page it re-mounts on every module
// change, which loses the map's pan and zoom — the map is the base layer.
assertIncludes(
  'src/app/app/layout.tsx',
  '<MmmShell',
  'The Music/Map/Me shell must be mounted by the /app layout so the map survives navigation.'
);
// No header, anywhere: the lower-left logo trigger is the only navigation.
for (const [component, reason] of [
  ['AdaptiveSiteHeader', 'There is no header on any page — the logo trigger is the only nav.'],
  ['MobileBottomNav', 'The bottom tab bar is retired; the logo fan replaced it.'],
  ['AppShell', 'The 82px-header app shell is retired. Two shells cannot both own the scroll container.'],
  ['MobileAppShellLoader', 'The phone swipe shell is retired.'],
  ['CookieConsent', 'Consent is asked during onboarding, not globally — and the banner sat where the logo fan opens.'],
]) {
  assertNotIncludes('src/app/layout.tsx', `<${component}`, reason);
}
assertIncludes(
  'src/app/ui-preview/page.tsx',
  "process.env.NODE_ENV !== 'development'",
  'The editable sample-data preview must remain unavailable in production.'
);
assertMissing(
  'src/app/workbench/page.tsx',
  '/workbench is a legacy alias only; do not recreate it as a second authenticated app.'
);
assertIncludes(
  'src/lib/auth-redirects.ts',
  "WORKBENCH_PATH = '/app/music/discover'",
  'All successful auth paths should resolve into the canonical /app shell.'
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

console.log('Design guard passed: /app is the canonical shell, with no header and no second signed-in app.');
