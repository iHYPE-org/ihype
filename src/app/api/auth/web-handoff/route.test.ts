import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { hashMagicLinkToken } from '@/lib/magic-link-token';

/* The one route that hands an app member's existing session to a browser tab
   (DESIGN_SYNC row 514). Every guard in its header is driven here. */

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const consumeRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: (...a: unknown[]) => consumeRateLimit(...a),
  rateLimitKey: vi.fn().mockReturnValue('k'),
}));
const recordAuditEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit', () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
const userFindUnique = vi.fn();
const tokenCreate = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    magicLinkToken: { create: (...a: unknown[]) => tokenCreate(...a) },
  },
}));

const { auth } = await import('@/lib/auth');
const { POST } = await import('./route');

const APP_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 iHYPEApp/1';
const SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://ihype.org/api/auth/web-handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': APP_UA, 'sec-fetch-site': 'same-origin', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'member-1' } } as never);
  consumeRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  userFindUnique.mockResolvedValue({ emailVerified: new Date('2026-09-01T00:00:00Z') });
  tokenCreate.mockResolvedValue({});
});

describe('POST /api/auth/web-handoff', () => {
  it('mints a single-use sign-in link to the builder for a verified member in the app', async () => {
    const before = Date.now();
    const res = await POST(request({ next: '/app/me/advertising/new' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.signedIn).toBe(true);

    const url = new URL(body.url, 'https://ihype.org');
    expect(url.pathname).toBe('/auth/confirm');
    expect(url.searchParams.get('callbackUrl')).toBe('/app/me/advertising/new');
    const token = url.searchParams.get('token') ?? '';
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // The database holds the HASH, never the token, and the row dies in five minutes.
    const { data } = tokenCreate.mock.calls[0][0] as { data: { token: string; userId: string; expiresAt: Date } };
    expect(data.token).toBe(hashMagicLinkToken(token));
    expect(data.token).not.toBe(token);
    expect(data.userId).toBe('member-1');
    const ttl = data.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(4 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);

    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.web_handoff', actorUserId: 'member-1' }));
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain(token);
  });

  it('refuses a signed-out caller', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await POST(request({ next: '/app/me/advertising' }))).status).toBe(401);
    expect(tokenCreate).not.toHaveBeenCalled();
  });

  it('refuses a cross-site request', async () => {
    const res = await POST(request({ next: '/app/me/advertising' }, { 'sec-fetch-site': 'cross-site' }));
    expect(res.status).toBe(403);
    expect(tokenCreate).not.toHaveBeenCalled();
  });

  it('answers only the app — a browser has no tab to sign in', async () => {
    const res = await POST(request({ next: '/app/me/advertising' }, { 'user-agent': SAFARI_UA }));
    expect(res.status).toBe(403);
    expect(tokenCreate).not.toHaveBeenCalled();
  });

  it('never signs a tab into a destination the caller chose', async () => {
    for (const next of ['/app/me/settings', '/admin', 'https://evil.example/app/me/advertising', '//evil.example', 42]) {
      const res = await POST(request({ next }));
      expect(res.status, String(next)).toBe(400);
    }
    expect(tokenCreate).not.toHaveBeenCalled();
  });

  it('hands back the plain page, and mints nothing, for a member whose email is not verified', async () => {
    userFindUnique.mockResolvedValue({ emailVerified: null });
    const res = await POST(request({ next: '/app/me/advertising' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: '/app/me/advertising', signedIn: false });
    expect(tokenCreate).not.toHaveBeenCalled();
  });

  it('is rate limited', async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await POST(request({ next: '/app/me/advertising' }));
    expect(res.status).toBe(429);
    expect(tokenCreate).not.toHaveBeenCalled();
  });

  it('falls back to the plain page when the token cannot be written', async () => {
    tokenCreate.mockRejectedValue(new Error('db down'));
    const res = await POST(request({ next: '/app/me/advertising/new' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: '/app/me/advertising/new', signedIn: false });
  });
});
