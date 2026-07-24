import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auto-mocked Prisma (Proxy pattern from show-payouts.test.ts): every model
// resolves to inert defaults; each test programs only what it needs.
vi.mock('@/lib/db', () => {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  function makeModel() {
    return {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
  }
  const db = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (!models.has(prop)) models.set(prop, makeModel());
      return models.get(prop);
    },
  });
  return { db };
});

vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
}));
vi.mock('@/lib/request-meta', () => ({ readClientAddress: vi.fn().mockReturnValue('9.9.9.9') }));

import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { POST } from '@/app/api/ads/impression/route';

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const mockRate = consumeRateLimit as unknown as ReturnType<typeof vi.fn>;

const HOUR = 60 * 60 * 1000;
function ad(overrides: Record<string, unknown> = {}) {
  return { status: 'APPROVED', startsAt: null, endsAt: null, budgetCents: 10000, spentCents: 0, ...overrides };
}
function post(body: unknown) {
  return POST(new Request('https://ihype.org/api/ads/impression', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRate.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mockDb.ad.findUnique.mockResolvedValue(null);
});

describe('POST /api/ads/impression — only servable ads spend budget', () => {
  it('charges an APPROVED, in-window ad with budget remaining', async () => {
    mockDb.ad.findUnique.mockResolvedValue(ad());
    const res = await post({ adId: 'a1' });
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDb.ad.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' }, data: expect.objectContaining({ spentCents: { increment: 9 } }) }),
    );
    expect(mockDb.adImpression.create).toHaveBeenCalledTimes(1);
  });

  it('skips an unknown adId without spending or throwing (no P2025 500)', async () => {
    mockDb.ad.findUnique.mockResolvedValue(null);
    const res = await post({ adId: 'ghost' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: true, reason: 'unknown_ad' });
    expect(mockDb.ad.update).not.toHaveBeenCalled();
    expect(mockDb.adImpression.create).not.toHaveBeenCalled();
  });

  it('does not charge a non-APPROVED (e.g. PAUSED) campaign', async () => {
    mockDb.ad.findUnique.mockResolvedValue(ad({ status: 'PAUSED' }));
    const res = await post({ adId: 'a1' });
    expect((await res.json()).reason).toBe('not_active');
    expect(mockDb.ad.update).not.toHaveBeenCalled();
  });

  it('does not charge before the run window starts', async () => {
    mockDb.ad.findUnique.mockResolvedValue(ad({ startsAt: new Date(Date.now() + HOUR) }));
    const res = await post({ adId: 'a1' });
    expect((await res.json()).reason).toBe('not_active');
    expect(mockDb.ad.update).not.toHaveBeenCalled();
  });

  it('does not charge after the run window ends', async () => {
    mockDb.ad.findUnique.mockResolvedValue(ad({ endsAt: new Date(Date.now() - HOUR) }));
    const res = await post({ adId: 'a1' });
    expect((await res.json()).reason).toBe('not_active');
    expect(mockDb.ad.update).not.toHaveBeenCalled();
  });

  it('does not charge once the budget is exhausted', async () => {
    mockDb.ad.findUnique.mockResolvedValue(ad({ budgetCents: 100, spentCents: 100 }));
    const res = await post({ adId: 'a1' });
    expect((await res.json()).reason).toBe('budget_exhausted');
    expect(mockDb.ad.update).not.toHaveBeenCalled();
  });

  it('treats budgetCents 0 as unlimited and still charges', async () => {
    mockDb.ad.findUnique.mockResolvedValue(ad({ budgetCents: 0, spentCents: 999999 }));
    const res = await post({ adId: 'a1' });
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDb.ad.update).toHaveBeenCalled();
  });

  it('rejects with 429 when rate limited (before any DB work)', async () => {
    mockRate.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const res = await post({ adId: 'a1' });
    expect(res.status).toBe(429);
    expect(mockDb.ad.findUnique).not.toHaveBeenCalled();
  });

  it('requires an adId', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });
});
