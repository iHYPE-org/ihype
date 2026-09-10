import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashTicketCode } from '@/lib/door-manifest';

/**
 * The one thing this route must never do is put a ticket code on a door
 * phone, and the one thing it must do is let the venue's owner have the list.
 * Everything below is one of those two, plus the gate.
 */
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitKey: vi.fn().mockReturnValue('door-manifest:user'),
}));

const showFindFirst = vi.fn();
const ticketFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    show: { findFirst: (...a: unknown[]) => showFindFirst(...a) },
    ticket: { findMany: (...a: unknown[]) => ticketFindMany(...a) },
  },
}));

import { auth } from '@/lib/auth';
import { GET } from './route';

const SHOW = {
  id: 'show_1',
  slug: 'night',
  title: 'Night',
  startsAt: new Date('2026-10-01T02:00:00.000Z'),
  creatorId: 'promoter',
  venueProfile: { ownerId: 'venue' },
  headlinerProfile: { ownerId: 'act' },
};
const VALID = '0x0123456789abcdef01234567';
const USED = '0x89abcdef0123456789abcdef';
const params = { params: Promise.resolve({ showId: 'show_1' }) };
const request = new Request('https://ihype.org/api/shows/show_1/door-manifest');

function signedInAs(id: string) {
  vi.mocked(auth).mockResolvedValue({ user: { id, email: `${id}@example.com`, role: 'LISTENER' }, expires: '' } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  showFindFirst.mockResolvedValue(SHOW);
  ticketFindMany.mockResolvedValue([
    { serializedId: VALID, holderName: 'Ada', status: 'VALID' },
    { serializedId: USED, holderName: 'Ben', status: 'SCANNED' },
  ]);
});

describe('GET /api/shows/[showId]/door-manifest', () => {
  it('refuses a signed-out caller and a fan', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await GET(request, params)).status).toBe(401);
    signedInAs('fan');
    expect((await GET(request, params)).status).toBe(403);
    expect(ticketFindMany).not.toHaveBeenCalled();
  });

  it('gives the venue owner the list — hashes and names, never a code', async () => {
    signedInAs('venue');
    const res = await GET(request, params);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const text = await res.text();
    expect(text.includes(VALID)).toBe(false);
    expect(text.includes(USED)).toBe(false);
    expect(text.includes(VALID.slice(2))).toBe(false);
    const body = JSON.parse(text);
    expect(body.showId).toBe('show_1');
    expect(body.valid).toEqual([{ h: await hashTicketCode('show_1', VALID), name: 'Ada' }]);
    expect(body.scanned).toEqual([await hashTicketCode('show_1', USED)]);
    // Void tickets are not asked for at all — nothing at the door can admit one.
    expect(ticketFindMany.mock.calls[0][0].where.status).toEqual({ in: ['VALID', 'SCANNED'] });
  });

  it('admits the headliner owner and the creator too, like the cancel route', async () => {
    signedInAs('act');
    expect((await GET(request, params)).status).toBe(200);
    signedInAs('promoter');
    expect((await GET(request, params)).status).toBe(200);
  });

  it('answers 404 for a show that does not exist before deciding anything about access', async () => {
    showFindFirst.mockResolvedValue(null);
    signedInAs('venue');
    expect((await GET(request, params)).status).toBe(404);
  });
});
