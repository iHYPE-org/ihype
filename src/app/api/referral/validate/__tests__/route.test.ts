import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auto-mocked Prisma, mirroring the pattern in show-payouts.test.ts — every
// model resolves to inert defaults; each test programs only what it needs.
vi.mock('@/lib/db', () => {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  function makeModel() {
    return { findUnique: vi.fn().mockResolvedValue(null) };
  }
  const db = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (!models.has(prop)) models.set(prop, makeModel());
      return models.get(prop);
    },
  });
  return { db };
});

vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
}));
vi.mock('@/lib/request-meta', () => ({ readClientAddress: vi.fn().mockReturnValue('1.2.3.4') }));
vi.mock('@/lib/runtime-flags', () => ({
  isInviteCodeRequiredRuntime: vi.fn().mockResolvedValue(true),
  isInviteCodeSharingEnabledRuntime: vi.fn().mockResolvedValue(true),
  isValidInviteCode: vi.fn().mockReturnValue(false),
}));
vi.mock('@/lib/registration-post-processing', () => ({ resolveReferrer: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { isInviteCodeRequiredRuntime, isInviteCodeSharingEnabledRuntime, isValidInviteCode } from '@/lib/runtime-flags';
import { resolveReferrer } from '@/lib/registration-post-processing';
import { POST } from '@/app/api/referral/validate/route';

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const mockConsumeRateLimit = consumeRateLimit as unknown as ReturnType<typeof vi.fn>;
const mockInviteRequired = isInviteCodeRequiredRuntime as unknown as ReturnType<typeof vi.fn>;
const mockSharingAllowed = isInviteCodeSharingEnabledRuntime as unknown as ReturnType<typeof vi.fn>;
const mockIsValidInviteCode = isValidInviteCode as unknown as ReturnType<typeof vi.fn>;
const mockResolveReferrer = resolveReferrer as unknown as ReturnType<typeof vi.fn>;

function post(body: unknown) {
  return POST(new Request('https://ihype.org/api/referral/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConsumeRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mockInviteRequired.mockResolvedValue(true);
  // The existing cases below describe the door with sharing OPEN. The suite
  // that follows covers it shut, which is the shipped default.
  mockSharingAllowed.mockResolvedValue(true);
  mockIsValidInviteCode.mockReturnValue(false);
  mockResolveReferrer.mockResolvedValue(null);
  mockDb.inviteCode.findUnique.mockResolvedValue(null);
});

describe('POST /api/referral/validate', () => {
  it('accepts any code when invite-only signup is off', async () => {
    mockInviteRequired.mockResolvedValue(false);
    const res = await post({ code: 'anything' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true });
    // Short-circuits before touching the code channels.
    expect(mockIsValidInviteCode).not.toHaveBeenCalled();
    expect(mockResolveReferrer).not.toHaveBeenCalled();
  });

  it('accepts a shared BETA_INVITE_CODES code', async () => {
    mockIsValidInviteCode.mockReturnValue(true);
    const res = await post({ code: 'launch-2026' });
    expect(await res.json()).toEqual({ valid: true });
  });

  it('accepts an unclaimed, unexpired admin invite code', async () => {
    mockDb.inviteCode.findUnique.mockResolvedValue({ usedByUserId: null, expiresAt: null });
    const res = await post({ code: 'abc123' });
    expect(await res.json()).toEqual({ valid: true });
    expect(mockDb.inviteCode.findUnique).toHaveBeenCalledWith({
      where: { code: 'ABC123' },
      select: { usedByUserId: true, expiresAt: true },
    });
  });

  it('rejects an already-claimed admin invite code', async () => {
    mockDb.inviteCode.findUnique.mockResolvedValue({ usedByUserId: 'u_1', expiresAt: null });
    const res = await post({ code: 'abc123' });
    const json = await res.json();
    expect(json.valid).toBe(false);
  });

  it('rejects an expired admin invite code', async () => {
    mockDb.inviteCode.findUnique.mockResolvedValue({ usedByUserId: null, expiresAt: new Date(Date.now() - 1000) });
    const res = await post({ code: 'abc123' });
    expect((await res.json()).valid).toBe(false);
  });

  it("accepts an existing member's HYPE code / @username", async () => {
    mockResolveReferrer.mockResolvedValue({ referrerId: 'u_42' });
    const res = await post({ code: 'colin' });
    expect(await res.json()).toEqual({ valid: true });
  });

  it('rejects a code that matches nothing (never consumes anything)', async () => {
    const res = await post({ code: 'nope' });
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.error).toMatch(/isn’t recognized|not recognized/i);
  });

  /**
   * The shipped default: invites are ISSUED, not passed around. Only the
   * admin-minted single-use code opens the door, so the landing page's
   * request form is the one way in.
   */
  describe('with invite code sharing off', () => {
    beforeEach(() => {
      mockSharingAllowed.mockResolvedValue(false);
    });

    it('still accepts an admin-minted single-use code', async () => {
      mockDb.inviteCode.findUnique.mockResolvedValue({ usedByUserId: null, expiresAt: null });
      expect(await (await post({ code: 'abc123' })).json()).toEqual({ valid: true });
    });

    it('refuses a shared BETA_INVITE_CODES code, and does not even consult it', async () => {
      mockIsValidInviteCode.mockReturnValue(true);
      expect((await (await post({ code: 'launch-2026' })).json()).valid).toBe(false);
      expect(mockIsValidInviteCode).not.toHaveBeenCalled();
    });

    it("refuses a member's HYPE code, and does not resolve the referrer", async () => {
      mockResolveReferrer.mockResolvedValue({ referrerId: 'u_42' });
      expect((await (await post({ code: 'colin' })).json()).valid).toBe(false);
      expect(mockResolveReferrer).not.toHaveBeenCalled();
    });

    it('points a rejected applicant at the request form rather than at a member', async () => {
      const json = await (await post({ code: 'nope' })).json();
      expect(json.error).toMatch(/request access/i);
      expect(json.error).not.toMatch(/ask an existing member/i);
    });
  });

  it('returns 429 when rate limited', async () => {
    mockConsumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const res = await post({ code: 'x' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
  });

  it('rejects an empty payload with 400', async () => {
    const res = await post({ code: '' });
    expect(res.status).toBe(400);
    expect((await res.json()).valid).toBe(false);
  });
});
