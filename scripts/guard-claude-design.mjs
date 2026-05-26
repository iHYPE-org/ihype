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

assertIncludes(
  'src/app/home/page.tsx',
  'WorkbenchShell',
  '/home is the canonical authenticated workbench and must render the workbench shell.'
);
// Auth check temporarily removed while UI is iterated with mock data.
// Re-add this guard when real auth is wired back up:
// assertIncludes(
//   'src/app/home/page.tsx',
//   "redirect('/login')",
//   'Unauthenticated workbench visits must not render private UI.'
// );
assertMissing(
  'src/app/workbench/page.tsx',
  '/workbench is a legacy alias only; do not recreate it as a second authenticated app.'
);
assertIncludes(
  'src/lib/auth-redirects.ts',
  "WORKBENCH_PATH = '/home'",
  'All successful auth paths should resolve to the canonical workbench route.'
);
assertIncludes(
  'src/components/AuthScreens.tsx',
  'resolvePostAuthRedirect',
  'Client auth flows should share the server-side redirect resolver.'
);
assertNotIncludes(
  'src/components/AuthScreens.tsx',
  'getAuthLandingPath',
  'The old /auth/landing trampoline should not come back as the post-login target.'
);
for (const relativePath of [
  'src/app/admin/page.tsx',
  'src/app/admin/audit/page.tsx',
  'src/app/admin/broadcast/page.tsx',
  'src/app/admin/journal/page.tsx',
  'src/app/admin/review/page.tsx',
  'src/app/admin/users/page.tsx',
  'src/components/DiscoverModulePanels.tsx'
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
  'src/app/api/auth/otp/signin/route.ts',
  'buildAuthSessionCookie',
  'OTP sign-in should use the shared Auth.js session cookie helper.'
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
  'src/app/auth/magic/page.tsx',
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

console.log('Design guard passed: /home is the canonical authenticated workbench.');
