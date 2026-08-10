import { readFileSync } from 'fs';
import { relative } from 'path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'glob';

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

describe('admin API guard coverage', () => {
  it('keeps every admin API route behind an explicit admin guard', () => {
    const routeFiles = globSync('src/app/api/admin/**/route.{ts,tsx}', { nodir: true }).sort();
    expect(routeFiles.length).toBeGreaterThan(0);

    const unguarded = routeFiles.filter((file) => {
      const normalized = relative(process.cwd(), file).replace(/\\/g, '/');
      if (ADMIN_API_EXCEPTIONS.has(normalized)) return false;

      const source = readFileSync(file, 'utf8');
      return !source.includes('isAdminSession(') && !source.includes('requireAdminApi(');
    });

    expect(unguarded).toEqual([]);
  });
});
