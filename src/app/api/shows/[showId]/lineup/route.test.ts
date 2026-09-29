import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }), rateLimitKey: () => 'k' }));
vi.mock('@/lib/request-meta', () => ({ readClientAddress: () => '127.0.0.1' }));
vi.mock('@/lib/notify', () => ({ notifyUser: vi.fn().mockResolvedValue(undefined) }));

const showFindUnique = vi.fn();
const orderCount = vi.fn().mockResolvedValue(0);
const profileFindMany = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/db', () => ({
  db: {
    show: { findUnique: (...a: unknown[]) => showFindUnique(...a) },
    ticketOrder: { count: (...a: unknown[]) => orderCount(...a) },
    profile: { findMany: (...a: unknown[]) => profileFindMany(...a) },
    $transaction: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { POST } from './route';

const SHOW = {
  id: 'show_1', slug: 'the-night', title: 'The Night', status: 'SCHEDULED', startsAt: new Date(Date.now() + 14 * 86_400_000), timeZone: 'America/New_York',
  isTicketed: true, ticketPriceCents: 1_800,
  venueProfile: { id: 'venue_1', ownerId: 'venue-owner', name: 'The Room', paymentReportHoldAt: null, addressLine1: '1 Main St', city: 'Portland', stateRegion: 'ME', postalCode: '04101' },
};
const params = { params: Promise.resolve({ showId: 'show_1' }) };
const OFFER = {
  slots: [{ profileId: 'cmfzzzzzzzzzzzzzzzzzzzzzz', splitPercent: 60, performance: { loadInTime: '16:00', soundcheckTime: '17:00', setStartTime: '21:00', setLengthMinutes: 60 } }],
  engagement: { purchaserLegalName: 'The Room LLC', purchaserContact: 'room@example.com', doorsTime: '19:00' },
  preview: true,
};

function post(body: unknown) {
  return new Request('https://ihype.org/api/shows/show_1/lineup', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'venue-owner', email: 'v@example.com', role: 'VENUE' }, expires: '' } as never);
  showFindUnique.mockResolvedValue(SHOW);
  orderCount.mockResolvedValue(0);
});

describe('POST /api/shows/[showId]/lineup — the offer cannot be revised under sold tickets (row 533)', () => {
  it('refuses to send or re-send once a ticket has been sold, before reading the body', async () => {
    orderCount.mockResolvedValueOnce(2);
    const res = await POST(post(OFFER), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'AGREEMENT_HAS_SALES' });
    expect(profileFindMany).not.toHaveBeenCalled();
  });

  it('reaches the offer itself when nothing has been sold', async () => {
    // An offer naming an act the database does not hold answers 400 from the
    // act lookup — which is past the sales gate, and the point of the test.
    const res = await POST(post(OFFER), params);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('could not be found') });
    expect(orderCount).toHaveBeenCalledWith({ where: { showId: 'show_1', status: 'CAPTURED' } });
  });
});
