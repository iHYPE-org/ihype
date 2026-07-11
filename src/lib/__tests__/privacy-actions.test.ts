import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auto-mocked Prisma: every model resolves to inert defaults so each test
// only has to program the calls it cares about.
vi.mock('@/lib/db', () => {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  function makeModel() {
    return {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      groupBy: vi.fn().mockResolvedValue([]),
    };
  }
  const db = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (prop === '$transaction') {
        return (ops: Array<Promise<unknown>>) => Promise.all(ops);
      }
      if (!models.has(prop)) models.set(prop, makeModel());
      return models.get(prop);
    },
  });
  return { db };
});

vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/object-storage', () => ({ deleteMediaFile: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/stripe', () => ({
  deauthorizeStripeConnectAccount: vi.fn().mockResolvedValue(undefined),
  isStripeConfigured: vi.fn().mockReturnValue(true),
}));

import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { deauthorizeStripeConnectAccount, isStripeConfigured } from '@/lib/stripe';
import {
  executeAccountErasure,
  executeHypeWipe,
  executeIdentityDetach,
  IDENTITY_DETACH_DEFAULT_DAYS,
  scrubAgedAuditLogIps,
} from '@/lib/privacy-actions';

const mockDb = db as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>;

beforeEach(() => {
  // Clears call history on every mock (model methods live behind a Proxy, so
  // per-model iteration can't reach them); implementations are preserved.
  vi.clearAllMocks();
});

describe('scrubAgedAuditLogIps', () => {
  it('nulls IPs only on rows older than the detach window', async () => {
    mockDb.auditLog.updateMany.mockResolvedValueOnce({ count: 42 });
    const before = Date.now();
    const scrubbed = await scrubAgedAuditLogIps();
    expect(scrubbed).toBe(42);

    const arg = mockDb.auditLog.updateMany.mock.calls[0][0];
    expect(arg.data).toEqual({ ipAddress: null });
    expect(arg.where.ipAddress).toEqual({ not: null });
    const cutoff = arg.where.createdAt.lt as Date;
    const expected = before - IDENTITY_DETACH_DEFAULT_DAYS * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(5000);
  });
});

describe('executeIdentityDetach', () => {
  it('scrubs only the requesting user and records an audit event', async () => {
    mockDb.auditLog.updateMany.mockResolvedValueOnce({ count: 7 });
    const summary = await executeIdentityDetach('user-1');

    expect(summary.auditIpsScrubbed).toBe(7);
    expect(mockDb.auditLog.updateMany.mock.calls[0][0].where.actorUserId).toBe('user-1');
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastLoginCountry: null },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'privacy_detach_executed', entityId: 'user-1' }),
    );
  });
});

describe('executeHypeWipe', () => {
  it('decrements each show by exactly the deleted event count', async () => {
    mockDb.hypeEvent.groupBy.mockResolvedValueOnce([
      { showId: 'show-a', _count: { _all: 3 } },
      { showId: 'show-b', _count: { _all: 1 } },
    ]);
    mockDb.hypeEvent.deleteMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 1 });

    const summary = await executeHypeWipe('user-1');

    expect(summary.showHypesDeleted).toBe(4);
    expect(mockDb.show.update).toHaveBeenCalledWith({
      where: { id: 'show-a' },
      data: { hypeCount: { decrement: 3 } },
    });
    expect(mockDb.show.update).toHaveBeenCalledWith({
      where: { id: 'show-b' },
      data: { hypeCount: { decrement: 1 } },
    });
    // Drift clamp runs after decrements
    expect(mockDb.show.updateMany).toHaveBeenCalledWith({
      where: { hypeCount: { lt: 0 } },
      data: { hypeCount: 0 },
    });
  });
});

describe('executeAccountErasure', () => {
  it('refuses to erase an ADMIN account', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'a1', email: 'x@y.z', role: 'ADMIN' });
    await expect(executeAccountErasure('a1', 'admin-2')).rejects.toThrow(/ADMIN/);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it('scrubs the user shell, embedded ticket PII, and kills sessions', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u9', email: 'fan@example.com', role: 'FAN' });
    mockDb.ticketOrder.updateMany.mockResolvedValueOnce({ count: 2 });
    mockDb.ticket.updateMany.mockResolvedValueOnce({ count: 3 });

    const summary = await executeAccountErasure('u9', 'admin-1');

    expect(summary.ticketOrdersScrubbed).toBe(2);
    expect(summary.ticketsScrubbed).toBe(3);

    const orderScrub = mockDb.ticketOrder.updateMany.mock.calls[0][0];
    expect(orderScrub.where).toEqual({ buyerUserId: 'u9' });
    expect(orderScrub.data.buyerEmail).toBe('deleted@ihype.invalid');
    expect(orderScrub.data.buyerUserId).toBeNull();

    const userScrub = mockDb.user.update.mock.calls.find(
      (call) => call[0].data.userSecurityVersion,
    )?.[0];
    expect(userScrub).toBeDefined();
    expect(userScrub.data.email).toBeNull();
    expect(userScrub.data.username).toBe('deleted-u9');
    expect(userScrub.data.userSecurityVersion).toEqual({ increment: 1 });
    expect(userScrub.data.emailBounced).toBe(true);

    expect(mockDb.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u9' } });
    expect(mockDb.passkey.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u9' } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'privacy_deletion_executed', actorUserId: 'admin-1' }),
    );
  });

  it('anonymizes owned profiles in place instead of deleting them', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u9', email: null, role: 'ARTIST' });
    mockDb.profile.findMany.mockResolvedValueOnce([{ id: 'p1', hexId: 'ABC123' }]);

    const summary = await executeAccountErasure('u9', 'admin-1');

    expect(summary.profilesAnonymized).toBe(1);
    const profileUpdate = mockDb.profile.update.mock.calls.find(
      (call) => call[0].where.id === 'p1',
    )?.[0];
    expect(profileUpdate.data.name).toBe('Deleted account');
    expect(profileUpdate.data.slug).toBe('deleted-abc123');
    expect(profileUpdate.data.pressKitContent).toBeNull();
    // Never a profile.delete — shows and payout records must survive.
    expect(mockDb.profile).not.toHaveProperty('delete');
  });

  it('deauthorizes a Stripe Connect account and clears it from the profile on success', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u9', email: null, role: 'ARTIST' });
    mockDb.profile.findMany.mockResolvedValueOnce([
      { id: 'p1', hexId: 'ABC123', stripeConnectAccountId: 'acct_123' },
    ]);

    const summary = await executeAccountErasure('u9', 'admin-1');

    expect(deauthorizeStripeConnectAccount).toHaveBeenCalledWith('acct_123');
    expect(summary.stripeConnectDeauthorized).toBe(1);
    expect(summary.stripeConnectNeedsManualReview).toEqual([]);

    const profileUpdate = mockDb.profile.update.mock.calls.find(
      (call) => call[0].where.id === 'p1',
    )?.[0];
    expect(profileUpdate.data.stripeConnectAccountId).toBeNull();
    expect(profileUpdate.data.stripeConnectOnboarded).toBe(false);
  });

  it('flags for manual review and leaves the account untouched when Stripe refuses deletion', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u9', email: null, role: 'ARTIST' });
    mockDb.profile.findMany.mockResolvedValueOnce([
      { id: 'p1', hexId: 'ABC123', stripeConnectAccountId: 'acct_123' },
    ]);
    vi.mocked(deauthorizeStripeConnectAccount).mockRejectedValueOnce(new Error('balance_insufficient'));

    const summary = await executeAccountErasure('u9', 'admin-1');

    expect(summary.stripeConnectDeauthorized).toBe(0);
    expect(summary.stripeConnectNeedsManualReview).toEqual(['ABC123']);

    const profileUpdate = mockDb.profile.update.mock.calls.find(
      (call) => call[0].where.id === 'p1',
    )?.[0];
    // Deletion failed, so the Connect fields must not be cleared — the
    // profile still points at the (still-live) account for manual follow-up.
    expect(profileUpdate.data).not.toHaveProperty('stripeConnectAccountId');
    expect(profileUpdate.data).not.toHaveProperty('stripeConnectOnboarded');
    // The rest of the erasure still proceeds despite the Stripe failure.
    expect(profileUpdate.data.name).toBe('Deleted account');
  });

  it('skips Stripe entirely when the profile has no Connect account', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u9', email: null, role: 'ARTIST' });
    mockDb.profile.findMany.mockResolvedValueOnce([
      { id: 'p1', hexId: 'ABC123', stripeConnectAccountId: null },
    ]);

    const summary = await executeAccountErasure('u9', 'admin-1');

    expect(deauthorizeStripeConnectAccount).not.toHaveBeenCalled();
    expect(summary.stripeConnectDeauthorized).toBe(0);
    expect(summary.stripeConnectNeedsManualReview).toEqual([]);
  });

  it('skips Stripe entirely when Stripe is not configured', async () => {
    vi.mocked(isStripeConfigured).mockReturnValueOnce(false);
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u9', email: null, role: 'ARTIST' });
    mockDb.profile.findMany.mockResolvedValueOnce([
      { id: 'p1', hexId: 'ABC123', stripeConnectAccountId: 'acct_123' },
    ]);

    await executeAccountErasure('u9', 'admin-1');

    expect(deauthorizeStripeConnectAccount).not.toHaveBeenCalled();
  });
});
