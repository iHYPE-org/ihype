import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAGIC_LINK_PENDING_COOKIE,
  MAX_PENDING,
  appendPending,
  decoyDigest,
  magicLinkPendingCookie,
  pendingDigest,
  removePending,
  wasRequestedHere,
} from '@/lib/magic-link-pending';
import { hashMagicLinkToken } from '@/lib/magic-link-token';

/**
 * /auth/confirm submitting itself was a login-CSRF: a magic link for the
 * SENDER's account, opened by somebody else, signed them in to it without a
 * press. It now submits only a link THIS browser asked for (rows 516, 519).
 */
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const token = (n: number) => `${'ab'.repeat(31)}${String(n).padStart(2, '0')}`;

describe('the pending marker names the exact link', () => {
  it('auto-submits the link this browser asked for', () => {
    const cookie = appendPending(null, pendingDigest(token(1)));
    expect(wasRequestedHere(cookie, token(1))).toBe(true);
  });

  it('does NOT auto-submit someone else\'s link, even while this browser has one pending', () => {
    // The row-516 marker was a bare "1" and let this through.
    const cookie = appendPending(null, pendingDigest(token(1)));
    expect(wasRequestedHere(cookie, token(2))).toBe(false);
    expect(wasRequestedHere(null, token(2))).toBe(false);
    expect(wasRequestedHere('1', token(2))).toBe(false);
  });

  it('holds several outstanding links, newest first, capped', () => {
    let cookie = '';
    for (let n = 1; n <= MAX_PENDING + 1; n += 1) cookie = appendPending(cookie, pendingDigest(token(n)));
    expect(wasRequestedHere(cookie, token(MAX_PENDING + 1))).toBe(true);
    expect(wasRequestedHere(cookie, token(2))).toBe(true);
    expect(wasRequestedHere(cookie, token(1))).toBe(false);
  });

  it('spending a link removes only that link', () => {
    const cookie = appendPending(appendPending(null, pendingDigest(token(1))), pendingDigest(token(2)));
    const after = removePending(cookie, token(1));
    expect(wasRequestedHere(after, token(1))).toBe(false);
    expect(wasRequestedHere(after, token(2))).toBe(true);
  });

  it('holds nothing a lookup or a replay can use', () => {
    const digest = pendingDigest(token(1));
    expect(digest).not.toContain(token(1));
    expect(hashMagicLinkToken(token(1))).not.toContain(digest);
    expect(decoyDigest()).toMatch(/^[0-9a-f]{32}$/);
    expect(magicLinkPendingCookie('x', true)).toMatchObject({ name: MAGIC_LINK_PENDING_COOKIE, httpOnly: true, sameSite: 'lax' });
    expect(magicLinkPendingCookie('', true).maxAge).toBe(0);
  });
});

describe('the wiring', () => {
  it('both sending routes store the SENT token\'s digest, and a decoy when nothing was sent', () => {
    const request = read('src/app/api/auth/magic-link/route.ts');
    expect(request).toContain('onSent(await sendMagicLinkEmail(user.id, email))');
    expect(request).toContain('sentDigest ?? decoyDigest()');
    expect(read('src/app/api/advertise/register/route.ts')).toContain('const sentDigest = await sendMagicLinkEmail(');
    expect(read('src/lib/magic-link.ts')).toContain('return pendingDigest(token);');
  });

  it('spending a token removes its digest', () => {
    expect(read('src/app/api/auth/magic/route.ts')).toContain('removePending(request.cookies.get(MAGIC_LINK_PENDING_COOKIE)?.value, token)');
  });

  it('the confirm page auto-submits only a link requested here', () => {
    expect(read('src/app/auth/confirm/page.tsx')).toContain('wasRequestedHere((await cookies()).get(MAGIC_LINK_PENDING_COOKIE)?.value, token)');
    expect(read('src/components/MagicLinkConfirm.tsx')).toMatch(/if \(!autoSubmit \|\| submitted\.current\) return;/);
  });
});
