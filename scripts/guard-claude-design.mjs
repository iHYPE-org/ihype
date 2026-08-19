import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

// /home and /listen are retired as rendered pages and exist only to forward
// legacy links. /home once pointed at /listen's module deck; /listen itself is
// now a forward into the Music · Map · Me shell, which is the only signed-in
// app surface Design System 8 describes.
assertIncludes(
  'src/app/home/page.tsx',
  "redirect('/app/map')",
  '/home is a legacy alias only and must forward onward rather than render.'
);
assertIncludes(
  'src/app/listen/page.tsx',
  "redirect('/app/music/discover')",
  '/listen is a legacy alias only; the module deck it rendered is retired.'
);
assertNotIncludes(
  'src/app/listen/page.tsx',
  'ModuleDeckMockup',
  'The six-module deck is retired — /listen must not render a second app surface.'
);
assertMissing(
  'src/app/ui-preview/page.tsx',
  'The module-deck preview harness went with the deck it previewed.'
);
assertNotIncludes(
  'src/app/layout.tsx',
  "@/components/shell/AppShell",
  'The retired signed-in AppShell must never wrap runtime routes again.'
);
assertIncludes(
  'src/components/mmm/MmmShell.tsx',
  'className="mmm-migrated-surface"',
  'Migrated backend workflows must receive the shared MMM surface vocabulary inside the MMM pane.'
);
assertIncludes(
  'src/app/mmm.css',
  '.mmm-pane > .mmm-migrated-surface',
  'The migrated surface scope must not inherit the retired AppShell layout.'
);
assertIncludes(
  'src/app/layout.tsx',
  '<main id="main-content">{children}</main>',
  'Non-MMM routes keep the public site frame without a second app shell.'
);
// The compatibility aliases moved from pages into `next.config.mjs` on
// 2026-08-19, so the assertion moves with them — the invariant is unchanged
// (these URLs must keep leading into MMM), only the place that guarantees it.
//
// It is a stronger check than the one it replaces. That one asserted a page
// FILE mentioned its destination, which a redirect-only page did while still
// answering 200 with a meta refresh instead of a 307. This asserts the routing
// rule exists, which is the thing that actually redirects.
const nextConfigSource = read('next.config.mjs');
for (const [source, destination] of [
  ['/artists/:slug', '/app/artists/:slug'],
  ['/venues/:slug', '/app/venues/:slug'],
  ['/fans/:slug', '/app/fans/:slug'],
  ['/tracks/:hexId', '/app/tracks/:hexId'],
  ['/playlist/:slug', '/app/playlists/:slug'],
  ['/radio', '/app/music/radio'],
  ['/search', '/app/music/discover?focus=search'],
  ['/tickets', '/app/me?section=tickets'],
  ['/for-you', '/app/music/recommended'],
  ['/this-weekend', '/app/map?layer=events'],
  ['/settings', '/app/me/settings'],
  ['/settings/accessibility', '/app/me/accessibility'],
  ['/pages', '/app/me/profiles'],
  ['/payouts', '/app/me/payouts'],
  ['/me/dashboard', '/app/me'],
  ['/community', '/app/me?section=about'],
]) {
  const rule = `source: '${source}', destination: '${destination}'`;
  if (!nextConfigSource.includes(rule)) {
    throw new Error(
      `next.config.mjs is missing the redirect \`${rule}\`. Overlapping product ` +
      'URLs are compatibility aliases into Music · Map · Me, and they have to be ' +
      'config redirects: a redirect() in a page cannot answer with a 307 under ' +
      'the root loading.tsx boundary — it renders a 200 with a meta refresh.'
    );
  }
}

// And the pages they replaced must stay gone. A page reinstated at one of these
// paths would shadow its own redirect, silently restoring the meta-refresh
// behaviour the move exists to end.
for (const alias of [
  'src/app/artists/[slug]/page.tsx',
  'src/app/venues/[slug]/page.tsx',
  'src/app/fans/[slug]/page.tsx',
  'src/app/tracks/[hexId]/page.tsx',
  'src/app/radio/page.tsx',
  'src/app/search/page.tsx',
  'src/app/tickets/page.tsx',
  'src/app/settings/page.tsx',
  'src/app/pages/page.tsx',
  'src/app/payouts/page.tsx',
]) {
  assertMissing(alias, 'It is a redirect in next.config.mjs now; a page here would shadow it.');
}
assertMissing(
  'src/components/MobileAppShell.tsx',
  'The phone swipe shell is retired: DS8 has no separate mobile build.'
);
assertMissing(
  'src/app/workbench/page.tsx',
  '/workbench is a legacy alias only; do not recreate it as a second authenticated app.'
);
// The canonical post-auth surface is now the Music · Map · Me shell rather
// than /listen's module deck — the cutover recorded in DESIGN_SYNC row 268,
// made as the operator decision that row said it needed. The guard is kept
// (not dropped) because its purpose is unchanged: there must be exactly one
// landing surface, and it must not drift silently.
assertIncludes(
  'src/lib/auth-redirects.ts',
  "WORKBENCH_PATH = '/app/map'",
  'All successful auth paths should resolve to the canonical app surface.'
);
for (const retiredShellFile of [
  'src/app/shell.css',
  'src/app/shell-surfaces.css',
  'src/components/shell/AppShell.tsx',
  'src/components/shell/AppShellDrawer.tsx',
  'src/components/shell/AppShellHeader.tsx',
  'src/components/shell/AppShellContextStrip.tsx',
  'src/lib/app-nav.ts',
  'src/lib/shell-account.ts',
  'src/lib/shell-chrome.ts',
]) {
  assertMissing(
    retiredShellFile,
    'The retired authenticated shell implementation must not remain available for reuse.'
  );
}
assertIncludes(
  'src/app/layout.tsx',
  "import './mmm-workflows.css'",
  'Authenticated workflow controls must load from the MMM stylesheet.'
);
assertIncludes(
  'src/app/layout.tsx',
  "import './mmm-primitives.css'",
  'Migrated workflow primitives must load from the MMM stylesheet.'
);

// A route can survive as an old bookmark without surviving as an old page.
// This ratchet counts only legacy URLs that still render JSX; redirect-only
// aliases are reported separately and do not paint the retired design.
execFileSync(process.execPath, ['scripts/audit-routes.mjs', '--max-legacy=0'], {
  cwd: root,
  stdio: 'pipe',
});
execFileSync(process.execPath, ['scripts/audit-css.mjs', '--max=0'], {
  cwd: root,
  stdio: 'pipe',
});
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
  if (!nextConfig.includes(legacySource) || !nextConfig.includes("destination: '/app/map'")) {
    throw new Error(`next.config.mjs must keep ${legacySource} redirecting directly to /app/map.`);
  }
}
assertNotIncludes(
  'next.config.mjs',
  "destination: '/home'",
  'Compatibility redirects must not bounce through the retired /home alias.'
);
assertIncludes(
  'src/components/HeaderLogo.tsx',
  "session?.user ? '/app/map' : '/'",
  'The signed-in logo must return directly to the canonical MMM map.'
);

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

// '/shows' and '/discover' were compatibility aliases into MMM and are now
// deleted outright: both were redirect-only pages, and a redirect under the
// root loading.tsx boundary cannot answer with a 307 — it renders a 200 with a
// one-second <meta refresh>, so they were slower than a link and invisible to
// anything that does not run the refresh. Their callers point at the MMM
// destinations directly. Assert they stay gone; a page re-added here reopens a
// second route to a surface that already has one.
assertMissing(
  'src/app/shows/page.tsx',
  'Events live at /app/map?layer=events; nav links there directly.'
);
assertMissing(
  'src/app/discover/page.tsx',
  'Discovery lives at /app/music/discover; nav links there directly.'
);

/* The section switcher is the tuner dial, and there is one of it.
 *
 * Three separate horizontal tab strips used to sit at the top of a page —
 * `SiteNavTabs` in the site header, and `.section-tabstrip` on Events and
 * Pages. Each divided one row by the number of tabs, so every tab added made
 * every label smaller: they had all settled at 10-13px, two of the artist
 * profile's six started off-screen at 393px, and the Pages set wrapped to
 * three rows before any content appeared.
 *
 * They are gone, and the reason to assert it is that re-adding one is the
 * obvious thing to do when a page grows a section — it is what every other
 * codebase does. The dial costs the same row and names ONE destination at
 * 26px, which is the whole reason the type could get bigger.
 */
assertMissing(
  'src/components/SiteNavTabs.tsx',
  'The header no longer carries a section selector; the site tab bar and the tuner dial do.'
);
assertNotIncludes(
  'src/app/globals.css',
  '.section-tabstrip',
  'The wrapping pill strip is retired — use TunerDial for a section switcher.'
);

console.log('Design guard passed: one signed-in app surface, one section switcher, no retired shells resurrected.');
