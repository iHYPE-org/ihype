import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auto-mocked Prisma (Proxy pattern from show-payouts.test.ts).
vi.mock('@/lib/db', () => {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  function makeModel() {
    return {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
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

import { db } from '@/lib/db';
import { GET } from '@/app/api/shows/[showId]/attendees/route';

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function get(showId = 'show1') {
  const req = new Request(`https://ihype.org/api/shows/${showId}/attendees`) as never;
  return GET(req, { params: Promise.resolve({ showId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.showAttendee.findMany.mockResolvedValue([]);
  mockDb.showAttendee.count.mockResolvedValue(0);
});

describe('GET /api/shows/[showId]/attendees — bounded public read', () => {
  it('caps the joined attendee rows with a take limit', async () => {
    await get();
    const arg = mockDb.showAttendee.findMany.mock.calls[0][0];
    expect(typeof arg.take).toBe('number');
    expect(arg.take).toBeLessThanOrEqual(50);
    expect(arg.where).toEqual({ showId: 'show1', optedIn: true });
  });

  it('returns the TRUE total from count(), not the capped list length', async () => {
    // 24 rows returned (the preview cap) but 5000 opted in overall.
    mockDb.showAttendee.findMany.mockResolvedValue(
      Array.from({ length: 24 }, (_, i) => ({ user: { name: `Fan ${i}`, image: null } })),
    );
    mockDb.showAttendee.count.mockResolvedValue(5000);
    const res = await get();
    const body = await res.json();
    expect(body.attendees).toHaveLength(24);
    expect(body.count).toBe(5000);
    expect(mockDb.showAttendee.count).toHaveBeenCalledWith({ where: { showId: 'show1', optedIn: true } });
  });

  it('maps attendees to name + avatar only (no other user fields leak)', async () => {
    mockDb.showAttendee.findMany.mockResolvedValue([{ user: { name: 'Ada', image: 'a.png' } }]);
    mockDb.showAttendee.count.mockResolvedValue(1);
    const res = await get();
    const body = await res.json();
    expect(body.attendees).toEqual([{ name: 'Ada', avatar: 'a.png' }]);
  });
});
