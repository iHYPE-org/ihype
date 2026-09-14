import { describe, expect, it, vi } from 'vitest';

/* The decision and its cascade are one write (DESIGN_SYNC row 456). The
   transaction is driven with a fake `tx`, so the assertion is on what the
   route does when the CASCADE fails after the row itself would have flipped:
   the request fails, rather than answering 200 over a radar that still lists
   the other fans' asks as pending. */
const update = vi.fn();
const updateMany = vi.fn();
const findMany = vi.fn();
const notifyUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'venue-owner' } }) }));
vi.mock('@/lib/permissions', () => ({ canManageOwnedResource: () => true }));
vi.mock('@/lib/notify', () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));
vi.mock('@/lib/db', () => {
  const tx = {
    venueConnectionRequest: {
      update: (...a: unknown[]) => update(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  };
  return {
    db: {
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      venueConnectionRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'req1',
          artistProfileId: 'artist1',
          artistName: 'The Act',
          venueProfileId: 'venue1',
          venueProfile: { ownerId: 'venue-owner', name: 'The Room', slug: 'the-room' },
        }),
        findMany: (...a: unknown[]) => findMany(...a),
      },
    },
  };
});

import { PATCH } from './route';

const patch = (status: string) =>
  PATCH(new Request('http://ihype.test/api/venue-requests/req1', { method: 'PATCH', body: JSON.stringify({ status }) }), {
    params: Promise.resolve({ id: 'req1' }),
  });

describe('PATCH /api/venue-requests/[id]', () => {
  it('books the act for every pending ask in one write and tells the fans who asked', async () => {
    update.mockImplementation(() => Promise.resolve({ id: 'req1', status: 'BOOKED' }));
    updateMany.mockImplementation(() => Promise.resolve({ count: 2 }));
    findMany.mockImplementation(() => Promise.resolve([{ requesterId: 'fan1' }, { requesterId: 'fan2' }]));
    const res = await patch('BOOKED');
    expect(res.status).toBe(200);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: { venueProfileId: 'venue1', status: 'PENDING', id: { not: 'req1' }, artistProfileId: 'artist1' },
      data: { status: 'BOOKED' },
    });
    expect(notifyUser).toHaveBeenCalledTimes(2);
  });

  it('fails the request when the cascade fails — never 200 over asks left pending', async () => {
    update.mockImplementation(() => Promise.resolve({ id: 'req1', status: 'BOOKED' }));
    updateMany.mockImplementation(() => Promise.reject(new Error('db down')));
    notifyUser.mockClear();
    const res = await patch('BOOKED');
    expect(res.status).toBe(500);
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it('a DISMISSED decision touches no other ask', async () => {
    update.mockImplementation(() => Promise.resolve({ id: 'req1', status: 'DISMISSED' }));
    updateMany.mockClear();
    const res = await patch('DISMISSED');
    expect(res.status).toBe(200);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
