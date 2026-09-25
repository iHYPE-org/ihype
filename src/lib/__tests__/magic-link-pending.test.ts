import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAGIC_LINK_PENDING_COOKIE, magicLinkPendingCookie } from '@/lib/magic-link-pending';

/**
 * /auth/confirm submitting itself unconditionally was a login-CSRF: a magic
 * link for the SENDER's account, opened by somebody else, signed them in to
 * it without a press. It now submits only in the browser that asked.
 */
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('magic-link pending marker', () => {
  it('carries nothing but the fact of a request', () => {
    const cookie = magicLinkPendingCookie(true);
    expect(cookie).toMatchObject({ name: MAGIC_LINK_PENDING_COOKIE, value: '1', httpOnly: true, sameSite: 'lax', secure: true });
  });

  it('is set by both routes that send a magic link', () => {
    for (const file of ['src/app/api/auth/magic-link/route.ts', 'src/app/api/advertise/register/route.ts']) {
      expect(read(file), file).toContain('magicLinkPendingCookie(');
    }
    // Set on every 200, including the ones that hide whether an account exists.
    expect(read('src/app/api/auth/magic-link/route.ts')).toMatch(/response\.status === 200\) response\.cookies\.set\(magicLinkPendingCookie/);
  });

  it('is cleared when the token is spent', () => {
    expect(read('src/app/api/auth/magic/route.ts')).toMatch(/cookies\.set\(MAGIC_LINK_PENDING_COOKIE, '', \{[^}]*maxAge: 0/);
  });

  it('gates the confirm page auto-submit', () => {
    const page = read('src/app/auth/confirm/page.tsx');
    expect(page).toContain('get(MAGIC_LINK_PENDING_COOKIE)');
    expect(page).toContain('autoSubmit={requestedHere}');
    const component = read('src/components/MagicLinkConfirm.tsx');
    expect(component).toMatch(/if \(!autoSubmit \|\| submitted\.current\) return;/);
  });
});
