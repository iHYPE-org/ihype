import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/runtime-flags', () => ({ getDemoCreatorExclusion: () => ({}) }));
vi.mock('@/lib/ad-clip-selection', () => ({ resolveAdBreakClips: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/auto-mod', () => ({ checkContent: () => ({ flagged: false }) }));

const notifyUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notify', () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));

const showFindFirst = vi.fn();
const showUpdate = vi.fn();
const orderFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    show: {
      findFirst: (...a: unknown[]) => showFindFirst(...a),
      update: (...a: unknown[]) => showUpdate(...a),
    },
    ticketOrder: { findMany: (...a: unknown[]) => orderFindMany(...a) },
  },
}));

import { auth } from '@/lib/auth';
import { PATCH } from './route';

const START = new Date('2026-10-02T20:00:00.000Z');
const SHOW = {
  id: 'show_1', slug: 'the-night', title: 'The Night', status: 'SCHEDULED', startsAt: START, isTicketed: true,
  creatorId: 'creator', venueProfile: { ownerId: 'venue-owner' }, headlinerProfile: { ownerId: 'act-owner' },
  ticketingOpensAt: new Date('2026-09-01T00:00:00.000Z'),
};
const params = { params: Promise.resolve({ showId: 'show_1' }) };

function patch(body: Record<string, unknown>) {
  return new Request('https://ihype.org/api/shows/show_1', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}
function signIn(id: string) {
  vi.mocked(auth).mockResolvedValue({ user: { id, email: `${id}@example.com`, role: 'LISTENER' }, expires: '' } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  showFindFirst.mockResolvedValue(SHOW);
  showUpdate.mockResolvedValue({ id: 'show_1', slug: 'the-night', status: 'SCHEDULED' });
  orderFindMany.mockResolvedValue([{ buyerUserId: 'fan_a' }, { buyerUserId: 'fan_b' }]);
});

describe('PATCH /api/shows/[showId] — the edit page is its first caller (row 446)', () => {
  /* Until 2026-09-14 nothing fetched this route, and it admitted the creator
     alone. The venue that could CANCEL a show through the cancel route could
     not correct its date through this one. */

  it('lets the venue owner correct the title, not only the creator', async () => {
    signIn('venue-owner');
    const res = await PATCH(patch({ title: 'The Long Night' }), params);
    expect(res.status).toBe(200);
    expect(showUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'The Long Night' }) }));
  });

  it('answers a stranger 404, so the show is not confirmed to exist', async () => {
    signIn('someone-else');
    const res = await PATCH(patch({ title: 'Hijacked' }), params);
    expect(res.status).toBe(404);
    expect(showUpdate).not.toHaveBeenCalled();
  });

  it('tells every buyer once when the start time moves on a ticketed show', async () => {
    signIn('creator');
    const res = await PATCH(patch({ startsAt: '2026-10-03T20:00:00.000Z' }), params);
    expect(res.status).toBe(200);
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ showId: 'show_1', status: 'CAPTURED' }),
      distinct: ['buyerUserId'],
    }));
    expect(notifyUser).toHaveBeenCalledTimes(2);
    expect(notifyUser).toHaveBeenCalledWith('fan_a', expect.objectContaining({ type: 'show_rescheduled', link: '/shows/the-night' }));
  });

  it('sends nothing when the start time is re-sent unchanged, or when only the copy changes', async () => {
    signIn('creator');
    await PATCH(patch({ startsAt: START.toISOString(), description: 'Doors at seven.' }), params);
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it('refuses an edit once the show is live — the ticket is for what was announced', async () => {
    signIn('creator');
    showFindFirst.mockResolvedValue({ ...SHOW, status: 'LIVE' });
    const res = await PATCH(patch({ title: 'Changed mid-set' }), params);
    expect(res.status).toBe(400);
    expect(showUpdate).not.toHaveBeenCalled();
  });

  it('opens ticket sales when a ticketed draft is published through the status transition', async () => {
    signIn('creator');
    showFindFirst.mockResolvedValue({ ...SHOW, status: 'DRAFT', ticketingOpensAt: null });
    const res = await PATCH(patch({ status: 'SCHEDULED' }), params);
    expect(res.status).toBe(200);
    expect(showUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SCHEDULED', ticketingOpensAt: expect.any(Date) }),
    }));
  });

  it('leaves an already-open sale window alone on a status change', async () => {
    signIn('creator');
    showFindFirst.mockResolvedValue({ ...SHOW, status: 'DRAFT' });
    await PATCH(patch({ status: 'SCHEDULED' }), params);
    const data = showUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('ticketingOpensAt');
  });

  it('records the change even if a notice fails — a failed send never undoes a recorded edit', async () => {
    signIn('creator');
    notifyUser.mockRejectedValueOnce(new Error('push down'));
    const res = await PATCH(patch({ startsAt: '2026-10-03T20:00:00.000Z' }), params);
    expect(res.status).toBe(200);
    expect(showUpdate).toHaveBeenCalledTimes(1);
  });
});
