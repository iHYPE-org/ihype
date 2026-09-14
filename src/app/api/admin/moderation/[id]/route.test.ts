import { describe, expect, it, vi } from 'vitest';

/* The one route every console surface decides a content report through
   (DESIGN_SYNC row 458): `approve` removes the content and marks ACTIONED,
   `dismiss` marks DISMISSED, a refused removal leaves the report OPEN. */
const enforceRemoval = vi.fn();
const update = vi.fn().mockResolvedValue({});
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }) }));
vi.mock('@/lib/permissions', () => ({ isAdminSession: () => true }));
vi.mock('@/lib/admin-confirmation', () => ({ requireRecentAdminReauth: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/moderation-enforcement', () => ({ enforceRemoval: (...a: unknown[]) => enforceRemoval(...a) }));
vi.mock('@/lib/db', () => ({
  db: {
    contentReport: {
      findUnique: vi.fn().mockResolvedValue({ targetType: 'show', targetId: 'show1', reason: 'spam' }),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

import { NextRequest } from 'next/server';
import { PATCH } from './route';

const patch = (body: unknown) =>
  PATCH(new NextRequest('http://ihype.test/api/admin/moderation/r1', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'r1' }),
  });

describe('PATCH /api/admin/moderation/[id]', () => {
  it('approve enforces the removal and marks the report ACTIONED', async () => {
    enforceRemoval.mockResolvedValue({ ok: true });
    const res = await patch({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(enforceRemoval).toHaveBeenCalledWith('show', 'show1', 'spam');
    expect(update.mock.calls.at(-1)?.[0]).toMatchObject({ where: { id: 'r1' }, data: { status: 'ACTIONED' } });
  });

  it('a refused removal answers 409 and leaves the report OPEN', async () => {
    enforceRemoval.mockResolvedValue({ ok: false, error: 'This show has 2 paid orders.' });
    update.mockClear();
    const res = await patch({ action: 'approve' });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: /paid orders/ });
    expect(update).not.toHaveBeenCalled();
  });

  it('dismiss touches no content and marks the report DISMISSED', async () => {
    enforceRemoval.mockClear();
    const res = await patch({ action: 'dismiss' });
    expect(res.status).toBe(200);
    expect(enforceRemoval).not.toHaveBeenCalled();
    expect(update.mock.calls.at(-1)?.[0]).toMatchObject({ data: { status: 'DISMISSED' } });
  });

  it('refuses any other vocabulary — a report is never closed by a word nobody decided on', async () => {
    update.mockClear();
    for (const action of ['RESOLVED', 'HIDDEN', 'REVIEWED', undefined]) {
      const res = await patch({ action });
      expect(res.status).toBe(400);
    }
    expect(update).not.toHaveBeenCalled();
  });
});
