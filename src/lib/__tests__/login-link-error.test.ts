/** The sign-in page says why a magic link failed (row 513). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loginLinkErrorFromCode } from '@/lib/login-link-error';

describe('loginLinkErrorFromCode', () => {
  it('names every code the magic route sends', () => {
    const route = readFileSync('src/app/api/auth/magic/route.ts', 'utf8');
    const codes = [...route.matchAll(/\/login\?error=([a-z_]+)/g)].map((m) => m[1]!);
    expect(codes.length).toBeGreaterThan(3);
    for (const code of codes) expect(loginLinkErrorFromCode(code), code).toBeDefined();
  });

  it('maps expired, invalid and failures apart', () => {
    expect(loginLinkErrorFromCode('expired_magic_link')).toBe('expired');
    expect(loginLinkErrorFromCode('invalid_magic_link')).toBe('invalid');
    expect(loginLinkErrorFromCode('ml_db_error')).toBe('failed');
    expect(loginLinkErrorFromCode(undefined)).toBeUndefined();
    expect(loginLinkErrorFromCode('something_else')).toBeUndefined();
  });

  it('the login page hands it to the screen', () => {
    const page = readFileSync('src/app/login/page.tsx', 'utf8');
    expect(page).toMatch(/linkError=\{loginLinkErrorFromCode\(resolvedSearchParams\.error\)\}/);
  });
});
