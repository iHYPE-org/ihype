import { readFileSync } from 'fs';
import { relative } from 'path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'glob';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

const ADMIN_API_EXCEPTIONS = new Set([
  'src/app/api/admin/setup/route.ts',
  // device-setup is protected by ADMIN_SETUP_SECRET bearer token — no admin session exists yet during bootstrap
  'src/app/api/admin/device-setup/route.ts',
  // impersonate/stop is the one admin route whose caller is deliberately NOT
  // an admin: while impersonating, the session belongs to the member (role
  // FAN, no admin device cookie), so an admin check here would refuse the one
  // request an impersonating operator most needs to make and strand them in
  // somebody else's account. It authorises on the `imp` claim instead, which
  // lives inside the signed token and cannot be forged, and re-checks the
  // operator against the admin allowlist before re-minting their session.
  'src/app/api/admin/impersonate/stop/route.ts',
]);

/**
 * Routes that must work BEFORE a registered device exists, or that are the
 * step-up ceremony itself. Each still requires an admin session.
 */
const DEVICE_BOOTSTRAP = new Set([
  'src/app/api/admin/device-passkey/route.ts',   // /admin/device-register calls it to register the first device
  'src/app/api/admin/device-register/route.ts',
  'src/app/api/admin/device-reissue/route.ts',   // lockout recovery: requiring a device here is a closed loop
  'src/app/api/admin/device-change/route.ts',
  'src/app/api/admin/device-change/verify/route.ts',
  'src/app/api/admin/reauth/route.ts',           // a fresh passkey assertion, which is itself the stronger factor
]);

function normalise(file: string): string {
  return relative(process.cwd(), file).replace(/\\/g, '/');
}

describe('admin API guard coverage', () => {
  const routeFiles = globSync('src/app/api/admin/**/route.{ts,tsx}', { nodir: true }).sort();

  it('keeps every admin API route behind an explicit admin guard', () => {
    expect(routeFiles.length).toBeGreaterThan(0);

    const unguarded = routeFiles.filter((file) => {
      if (ADMIN_API_EXCEPTIONS.has(normalise(file))) return false;
      const source = readFileSync(file, 'utf8');
      return !source.includes('isAdminSession(') && !source.includes('requireAdminApi(');
    });

    expect(unguarded).toEqual([]);
  });

  /*
   * THE DEVICE BINDING IS A SECOND FACTOR, SO THE TEST HAS TO SEE IT (row
   * 513). The check above passed any route calling `isAdminSession(` — the
   * weaker lock — so 13 routes (applicant identity documents, CSV exports,
   * the payments kill switch, minting a store-review sign-in link) accepted
   * a 12-hour admin token from a machine that could not open /admin. Every
   * admin route now either passes its request to `requireAdminApi`, which
   * checks the registered device, or demands a fresh passkey step-up
   * (`requireRecentAdminReauth`), or is named above as device bootstrap.
   */
  it('checks the registered admin device, or a fresh step-up, on every other route', () => {
    const weak = routeFiles.filter((file) => {
      const path = normalise(file);
      if (ADMIN_API_EXCEPTIONS.has(path) || DEVICE_BOOTSTRAP.has(path)) return false;
      const source = maskComments(readFileSync(file, 'utf8'));
      if (/requireAdminApi\(\s*request\b/.test(source)) return false;
      return !source.includes('requireRecentAdminReauth(');
    });
    expect(weak).toEqual([]);
  });

  it('never calls requireAdminApi without the request, which silently skips the device check', () => {
    const bare = globSync('src/**/*.{ts,tsx}', { nodir: true })
      .filter((file) => !file.includes('__tests__'))
      .filter((file) => /requireAdminApi\(\s*\)/.test(maskComments(readFileSync(file, 'utf8'))));
    expect(bare).toEqual([]);
  });
});
