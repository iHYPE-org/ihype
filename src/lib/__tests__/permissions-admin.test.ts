import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import { isAdminSession } from '@/lib/permissions';

const session = (role: string, email: string | null): Session =>
  ({ user: { id: 'u1', role, email } } as unknown as Session);

describe('isAdminSession', () => {
  it('admits the allowlisted admin', () => {
    expect(isAdminSession(session('ADMIN', 'admin@ihype.org'))).toBe(true);
    expect(isAdminSession(session('ADMIN', ' ADMIN@iHYPE.org '))).toBe(true);
  });

  it('refuses ADMIN on any other address', () => {
    // The second lock. The jwt clamp should already have downgraded this role,
    // so reaching here means a Session arrived from somewhere else — a test
    // fixture, a future provider, a hand-built object in a route.
    expect(isAdminSession(session('ADMIN', 'someone-else@example.com'))).toBe(false);
    expect(isAdminSession(session('ADMIN', null))).toBe(false);
  });

  it('refuses a non-admin role even on the allowlisted address', () => {
    expect(isAdminSession(session('FAN', 'admin@ihype.org'))).toBe(false);
  });

  it('refuses an absent session', () => {
    expect(isAdminSession(null)).toBe(false);
    expect(isAdminSession(undefined)).toBe(false);
  });
});
