import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_EMAIL,
  adminAllowlist,
  isAllowedAdminEmail,
  normalizeEmail,
} from '@/lib/admin-allowlist';

describe('adminAllowlist', () => {
  it('is admin@ihype.org by default', () => {
    expect(adminAllowlist()).toEqual(['admin@ihype.org']);
    expect(DEFAULT_ADMIN_EMAIL).toBe('admin@ihype.org');
  });

  it('falls back to the default rather than to an empty list', () => {
    // An empty allowlist locks everybody out of /admin, including the person
    // trying to fix it. Every one of these is a plausible bad env value.
    for (const raw of ['', '   ', ',,,', 'not-an-address', undefined, null]) {
      expect(adminAllowlist(raw)).toEqual([DEFAULT_ADMIN_EMAIL]);
    }
  });

  it('accepts a comma-separated override and normalises each entry', () => {
    expect(adminAllowlist('  Ops@iHYPE.org , admin@ihype.org ')).toEqual([
      'ops@ihype.org',
      'admin@ihype.org',
    ]);
  });
});

describe('isAllowedAdminEmail', () => {
  it('allows the documented address in any casing or padding', () => {
    for (const value of ['admin@ihype.org', 'ADMIN@IHYPE.ORG', ' Admin@iHype.Org ']) {
      expect(isAllowedAdminEmail(value)).toBe(true);
    }
  });

  it('refuses every other address', () => {
    // Including a personal address that previously held ADMIN: the whole
    // point of the rule is that being the incumbent is not a qualification.
    // Deliberately a reserved example.com address rather than the real one —
    // a test fixture is not a place to keep somebody's mailbox.
    expect(isAllowedAdminEmail('someone-else@example.com')).toBe(false);
    expect(isAllowedAdminEmail('admin@ihype.org.attacker.com')).toBe(false);
    expect(isAllowedAdminEmail('notadmin@ihype.org')).toBe(false);
  });

  it('refuses a missing address instead of treating it as unrestricted', () => {
    // Real case, not theoretical: User.email is nullable and the passkey signup
    // path collects no address at all. "No email" must not read as "not denied".
    expect(isAllowedAdminEmail(null)).toBe(false);
    expect(isAllowedAdminEmail(undefined)).toBe(false);
    expect(isAllowedAdminEmail('')).toBe(false);
    expect(isAllowedAdminEmail('   ')).toBe(false);
  });

  it('honours an override without dropping the ability to deny', () => {
    expect(isAllowedAdminEmail('ops@ihype.org', 'ops@ihype.org')).toBe(true);
    expect(isAllowedAdminEmail('admin@ihype.org', 'ops@ihype.org')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims, and maps absent values to the empty string', () => {
    expect(normalizeEmail('  A@B.com ')).toBe('a@b.com');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});
