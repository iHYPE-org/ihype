import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitHeaders: vi.fn().mockReturnValue({}),
  rateLimitKey: vi.fn().mockReturnValue('k'),
}));
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/badges', () => ({ checkAndAwardBadges: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/notify', () => ({
  notifyUser: vi.fn().mockResolvedValue(undefined),
  sendPushToAllDevices: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/mailer', () => ({ sendGenericEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/hype-ledger', () => ({
  applyHypeEntry: vi.fn().mockResolvedValue({ entry: { balanceAfter: 4 } }),
  InsufficientHypeError: class InsufficientHypeError extends Error {},
}));

const profileFindFirst = vi.fn();
const profileFindUnique = vi.fn();
const profileUpdate = vi.fn();
const hypeFindUnique = vi.fn();
const hypeCreate = vi.fn();
const hypeDelete = vi.fn();
const hypeCount = vi.fn();
const auditFindFirst = vi.fn();
const tx = {
  profileHypeEvent: {
    create: (...a: unknown[]) => hypeCreate(...a),
    delete: (...a: unknown[]) => hypeDelete(...a),
  },
  profile: { update: (...a: unknown[]) => profileUpdate(...a) },
};
vi.mock('@/lib/db', () => ({
  db: {
    profile: {
      findFirst: (...a: unknown[]) => profileFindFirst(...a),
      findUnique: (...a: unknown[]) => profileFindUnique(...a),
      update: (...a: unknown[]) => profileUpdate(...a),
    },
    profileHypeEvent: {
      findUnique: (...a: unknown[]) => hypeFindUnique(...a),
      count: (...a: unknown[]) => hypeCount(...a),
    },
    hypeEvent: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { findFirst: (...a: unknown[]) => auditFindFirst(...a) },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  },
  withDbRetry: (fn: () => Promise<unknown>) => fn(),
}));

import { auth } from '@/lib/auth';
import { GET, POST } from './route';

const PROFILE_ID = 'ckprofile00000000000000001';
const VIEWER = 'viewer-1';

function get(query: string) {
  return GET(new NextRequest(`https://ihype.org/api/hype?${query}`));
}
function post(body: Record<string, unknown>) {
  return POST(new NextRequest('https://ihype.org/api/hype', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: VIEWER, email: 'v@example.com', role: 'LISTENER' }, expires: '' } as never);
  profileFindFirst.mockResolvedValue({ id: PROFILE_ID, ownerId: 'artist-owner' });
  profileFindUnique.mockResolvedValue(null);
  profileUpdate.mockResolvedValue({ id: PROFILE_ID, hypeCount: 3 });
  hypeFindUnique.mockResolvedValue(null);
  hypeCreate.mockResolvedValue({ id: 'hype-row-1' });
  hypeDelete.mockResolvedValue({});
  hypeCount.mockResolvedValue(30);
  auditFindFirst.mockResolvedValue(null);
});

/* The full player's HYPE is keyed on the track that is PLAYING, whose queue row
   carries the artist's SLUG and nothing else. Until 2026-09-22 the shell knew
   the hype state of one artist — the viewer's last listen, resolved by the
   /app layout — and gated the player's control on NO track being loaded,
   while the player opens only from the pill, which exists only WITH one. So
   the control never rendered (DESIGN_SYNC row 503). The GET below is what the
   player now asks, and the slug arm on POST is what it presses. */
describe('GET /api/hype — the state a HYPE control is drawn from', () => {
  it('requires a session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await get('targetType=profile&slug=the-band')).status).toBe(401);
  });

  it('answers a fresh window by slug, private to the viewer', async () => {
    const res = await get('targetType=profile&slug=the-band');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ hypeable: true, profileId: PROFILE_ID, hyped: false, nextHypeAt: null });
    expect(profileFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'the-band', discoverable: true } }));
  });

  it('reports an open window as hyped, with the moment it reopens', async () => {
    const hypedAt = new Date(Date.now() - 60 * 60 * 1000);
    hypeFindUnique.mockResolvedValue({ createdAt: hypedAt });
    const body = await (await get(`targetType=profile&targetId=${PROFILE_ID}`)).json();
    expect(body.hyped).toBe(true);
    expect(new Date(body.nextHypeAt).getTime()).toBe(hypedAt.getTime() + 24 * 60 * 60 * 1000);
  });

  it('refuses to offer a control on the viewer\'s own profile', async () => {
    profileFindFirst.mockResolvedValue({ id: PROFILE_ID, ownerId: VIEWER });
    expect(await (await get('targetType=profile&slug=mine')).json()).toEqual({
      hypeable: false, profileId: PROFILE_ID, reason: 'own', hyped: false, nextHypeAt: null,
    });
  });

  it('names a profile that is absent or not discoverable as not found', async () => {
    profileFindFirst.mockResolvedValue(null);
    expect(await (await get('targetType=profile&slug=nobody')).json()).toMatchObject({ hypeable: false, reason: 'not_found' });
  });

  it('wants exactly one of targetId and slug, and only the profile type', async () => {
    expect((await get('targetType=profile')).status).toBe(400);
    expect((await get(`targetType=profile&slug=a&targetId=${PROFILE_ID}`)).status).toBe(400);
    expect((await get('targetType=show&targetId=x')).status).toBe(400);
    expect((await get('targetType=profile&targetId=not-a-cuid')).status).toBe(400);
  });

  it('answers 503 rather than an empty state when the read fails', async () => {
    profileFindFirst.mockRejectedValue(new Error('db down'));
    const res = await get('targetType=profile&slug=the-band');
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('10');
  });
});

describe('POST /api/hype by slug', () => {
  it('resolves the slug to the profile and reports which one it hyped', async () => {
    const res = await post({ targetType: 'profile', slug: 'the-band' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ action: 'hyped', profileId: PROFILE_ID, hypeCount: 3 });
    expect(hypeCreate).toHaveBeenCalledWith({ data: { userId: VIEWER, profileId: PROFILE_ID } });
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: PROFILE_ID } }));
  });

  it('still takes the id the artist page has always sent', async () => {
    const res = await post({ targetType: 'profile', targetId: PROFILE_ID });
    expect(res.status).toBe(200);
    expect(profileFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: PROFILE_ID, discoverable: true } }));
  });

  it('refuses neither and both', async () => {
    expect((await post({ targetType: 'profile' })).status).toBe(400);
    expect((await post({ targetType: 'profile', slug: 'a', targetId: PROFILE_ID })).status).toBe(400);
    expect(hypeCreate).not.toHaveBeenCalled();
  });

  it('answers the reopening moment, not a no, inside the window', async () => {
    hypeFindUnique.mockResolvedValue({ createdAt: new Date(Date.now() - 1000) });
    const res = await post({ targetType: 'profile', slug: 'the-band' });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'HYPE_WINDOW_OPEN' });
    expect(hypeCreate).not.toHaveBeenCalled();
  });
});
