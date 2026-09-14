import { describe, expect, it, vi } from 'vitest';

/* The one enforcement table every console surface reaches through
   PATCH /api/admin/moderation/[id] (DESIGN_SYNC row 458). Each arm is asserted
   on WHAT it writes, because the second table this replaced looked the same
   from a status column: a show CANCELED with no refund check, a track "hidden"
   by turning off free-use consent. */
const assetUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const commentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const showUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const adUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const profileUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const paidOrders = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    artistMediaAsset: { updateMany: (...a: unknown[]) => assetUpdateMany(...a) },
    showComment: { updateMany: (...a: unknown[]) => commentUpdateMany(...a) },
    show: { updateMany: (...a: unknown[]) => showUpdateMany(...a) },
    ad: { updateMany: (...a: unknown[]) => adUpdateMany(...a) },
    profile: { updateMany: (...a: unknown[]) => profileUpdateMany(...a) },
    ticketOrder: { count: (...a: unknown[]) => paidOrders(...a) },
  },
}));

import { enforceRemoval } from '../moderation-enforcement';

describe('enforceRemoval', () => {
  it('unpublishes a track under either public id and withdraws it from the crate', async () => {
    for (const type of ['track', 'media']) {
      assetUpdateMany.mockClear();
      await expect(enforceRemoval(type, 'abc123', 'auto_flag_copyright')).resolves.toEqual({ ok: true });
      expect(assetUpdateMany.mock.calls[0][0]).toEqual({
        where: { OR: [{ hexId: 'abc123' }, { id: 'abc123' }] },
        data: { isPublished: false, freeUseEnabled: false },
      });
    }
  });

  it('refuses to cancel a show that has paid orders and points at the refunding flow', async () => {
    paidOrders.mockResolvedValue(3);
    showUpdateMany.mockClear();
    const outcome = await enforceRemoval('show', 'show1', 'spam');
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? '' : outcome.error).toMatch(/3 paid orders/);
    expect(showUpdateMany).not.toHaveBeenCalled();
  });

  it('cancels a show with no paid orders, with a reason and a timestamp', async () => {
    paidOrders.mockResolvedValue(0);
    await expect(enforceRemoval('show', 'show1', 'spam')).resolves.toEqual({ ok: true });
    expect(showUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'show1' },
      data: { status: 'CANCELED', cancellationReason: 'Removed after a content report' },
    });
    expect(showUpdateMany.mock.calls[0][0].data.canceledAt).toBeInstanceOf(Date);
  });

  it('soft-deletes a comment and rejects an ad spot', async () => {
    await enforceRemoval('comment', 'c1', 'abuse');
    expect(commentUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'c1' } });
    expect(commentUpdateMany.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    await enforceRemoval('ad-audio', 'ad1', 'policy');
    expect(adUpdateMany.mock.calls[0][0]).toEqual({ where: { id: 'ad1' }, data: { status: 'REJECTED' } });
  });

  it('clears only a known profile image field, never an arbitrary column', async () => {
    await enforceRemoval('profile-image', 'p1', 'auto_flag_image:heroImage');
    expect(profileUpdateMany.mock.calls[0][0]).toEqual({ where: { id: 'p1' }, data: { heroImage: null } });
    profileUpdateMany.mockClear();
    await enforceRemoval('profile-image', 'p1', 'auto_flag_image:role');
    expect(profileUpdateMany).not.toHaveBeenCalled();
  });

  it('is a no-op that still succeeds for a type with no safe automated action', async () => {
    await expect(enforceRemoval('profile', 'p1', 'bio')).resolves.toEqual({ ok: true });
    await expect(enforceRemoval('ad-creative', 'x', 'retired')).resolves.toEqual({ ok: true });
  });
});
