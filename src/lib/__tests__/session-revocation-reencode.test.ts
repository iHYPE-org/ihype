import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '@auth/core';
import { decode, encode } from '@auth/core/jwt';

/**
 * THE PATH THE MIDDLEWARE RUNS, NOT A MODEL OF IT (2026-09-25, DESIGN_SYNC row 518).
 *
 * `middleware.ts` wraps requests in `NextAuth(authConfig)`, which runs Auth.js's
 * session action and copies the re-issued cookie onto the response
 * (next-auth/lib/index.js), and that action re-encodes the token
 * (@auth/core/lib/actions/session.js) through an `encode()` that calls
 * `.setJti(crypto.randomUUID())`. This drives `Auth()` itself with the edge
 * config the middleware uses — no callbacks, so the default jwt callback — and
 * reads the cookie it hands back.
 */

const kv = new Map<string, string>();
vi.mock('@/lib/kv', () => ({
  kvGet: vi.fn(async (key: string) => kv.get(key) ?? null),
  kvPut: vi.fn(async (key: string, value: string | number) => {
    kv.set(key, String(value));
  }),
}));
vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: vi.fn(async () => ({ userSecurityVersion: 0, email: 'fan@example.com' })) } },
}));
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));
// next-auth's wrapper imports `next/server`, which does not resolve outside Next.
// Only the exported callbacks are under test here; the session action above is
// driven through @auth/core's own `Auth()`, which is what the wrapper calls.
vi.mock('next-auth', () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}));

const SECRET = 'test-secret-for-the-session-action-reencode-0123456789';

async function cookieConfig() {
  const { authConfig } = await import('@/lib/auth.config');
  const name = authConfig.cookies!.sessionToken!.name!;
  return { authConfig, name };
}

/** One pass through Auth.js's session action, as a navigation under the middleware makes. */
async function sessionAction(cookie: string) {
  const { authConfig, name } = await cookieConfig();
  const response = await Auth(
    new Request('http://localhost/api/auth/session', { headers: { cookie: `${name}=${cookie}` } }),
    { ...authConfig, secret: [SECRET], trustHost: true, basePath: '/api/auth' },
  );
  const issued = response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .find((pair) => pair.startsWith(`${name}=`));
  expect(issued, 'the session action re-issued the cookie').toBeTruthy();
  const value = issued!.slice(name.length + 1);
  return { value, claims: await decode({ token: value, secret: SECRET, salt: name }) };
}

async function mint(claims: Record<string, unknown>) {
  const { name } = await cookieConfig();
  return encode({ token: { sub: 'user-1', securityVersion: 0, ...claims }, secret: SECRET, salt: name });
}

beforeEach(() => kv.clear());

describe('sign-out revocation survives the session action the middleware runs', () => {
  it('the jti a browser holds changes on a navigation; the sid does not', async () => {
    const first = await mint({ sid: 'stable-sid' });
    const copied = await decode({ token: first, secret: SECRET, salt: (await cookieConfig()).name });
    const once = await sessionAction(first);
    const twice = await sessionAction(once.value);

    // The defect, reproduced on the real path: tombstoning jti names only the newest cookie.
    expect(typeof copied!.jti).toBe('string');
    expect(once.claims!.jti).not.toBe(copied!.jti);
    expect(twice.claims!.jti).not.toBe(once.claims!.jti);

    // The fix: the revocation key survives every re-encode.
    const { sessionRevocationId } = await import('@/lib/session-revocation');
    expect(sessionRevocationId(once.claims)).toBe('stable-sid');
    expect(sessionRevocationId(twice.claims)).toBe('stable-sid');
    expect(sessionRevocationId(copied)).toBe('stable-sid');
  });

  it('signing out from the refreshed cookie revokes a copy taken before the refresh', async () => {
    const { authCallbacks } = await import('@/lib/auth');
    const { revokeSessionJti, sessionRevocationId } = await import('@/lib/session-revocation');
    const first = await mint({ sid: 'sid-to-revoke' });
    const copied = await decode({ token: first, secret: SECRET, salt: (await cookieConfig()).name });
    const refreshed = await sessionAction(first);

    // The sign-out route decodes the cookie it is shown (the refreshed one) and revokes its id.
    await revokeSessionJti(sessionRevocationId(refreshed.claims), Math.floor(Date.now() / 1000) + 3600);

    const jwt = authCallbacks.jwt!;
    expect(await jwt({ token: copied!, trigger: 'update' } as never)).toBeNull();
    expect(await jwt({ token: refreshed.claims!, trigger: 'update' } as never)).toBeNull();
  });

  it('a session that was not signed out is let through', async () => {
    const { authCallbacks } = await import('@/lib/auth');
    const token = { sub: 'user-1', securityVersion: 0, jti: 'j', sid: 'live-sid' };
    expect(await authCallbacks.jwt!({ token, trigger: 'update' } as never)).toMatchObject({ sid: 'live-sid' });
  });

  it('a token from before sid falls back to its jti, then pins it as its sid', async () => {
    const { authCallbacks } = await import('@/lib/auth');
    const { revokeSessionJti } = await import('@/lib/session-revocation');
    const legacy = { sub: 'user-1', securityVersion: 0, jti: 'legacy-jti' };
    const pinned = await authCallbacks.jwt!({ token: { ...legacy }, trigger: 'update' } as never);
    expect(pinned).toMatchObject({ sid: 'legacy-jti' });

    await revokeSessionJti('legacy-jti', Math.floor(Date.now() / 1000) + 3600);
    expect(await authCallbacks.jwt!({ token: { ...legacy }, trigger: 'update' } as never)).toBeNull();
  });

  it('an unreadable KV counts as not revoked, so sign-in fails towards letting the member in', async () => {
    const kvModule = await import('@/lib/kv');
    vi.mocked(kvModule.kvGet).mockRejectedValueOnce(new Error('KV down'));
    const { authCallbacks } = await import('@/lib/auth');
    const token = { sub: 'user-1', securityVersion: 0, jti: 'j', sid: 'any-sid' };
    expect(await authCallbacks.jwt!({ token, trigger: 'update' } as never)).not.toBeNull();
  });
});
