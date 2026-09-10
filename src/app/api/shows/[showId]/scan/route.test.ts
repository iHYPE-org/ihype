import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/hype-ledger', () => ({ awardHype: vi.fn().mockResolvedValue({ applied: false }) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const showFindUnique = vi.fn();
const ticketFindFirst = vi.fn();
const ticketUpdateMany = vi.fn();
const userFindUnique = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/db', () => ({
  db: {
    show: { findUnique: (...a: unknown[]) => showFindUnique(...a) },
    ticket: { findFirst: (...a: unknown[]) => ticketFindFirst(...a), updateMany: (...a: unknown[]) => ticketUpdateMany(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
  },
}));

import { auth } from '@/lib/auth';
import { POST } from './route';

const SHOW = {
  id: 'show_1', slug: 'night', title: 'Night', startsAt: new Date(),
  creatorId: 'promoter',
  venueProfile: { ownerId: 'venue' },
  headlinerProfile: { ownerId: 'act' },
};
const CODE = '0x0123456789abcdef01234567';
const params = { params: Promise.resolve({ showId: 'show_1' }) };

function post(body: Record<string, unknown>) {
  return new NextRequest('https://ihype.org/api/shows/show_1/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function signedInAs(id: string) {
  vi.mocked(auth).mockResolvedValue({ user: { id, email: `${id}@example.com`, role: 'LISTENER' }, expires: '' } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  showFindUnique.mockResolvedValue(SHOW);
  ticketFindFirst.mockResolvedValue({ id: 'tk_1', status: 'VALID', holderName: 'Ada', holderEmail: 'ada@example.com', scannedAt: null });
  ticketUpdateMany.mockResolvedValue({ count: 1 });
  userFindUnique.mockResolvedValue(null);
});

describe('POST /api/shows/[showId]/scan — who may work the door', () => {
  it('admits the venue owner, who used to be answered 403 at the door their own dashboard sent them to', async () => {
    signedInAs('venue');
    const res = await POST(post({ ticketId: CODE }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).ticket.holderName).toBe('Ada');
  });

  it('still refuses a fan', async () => {
    signedInAs('fan');
    expect((await POST(post({ ticketId: CODE }), params)).status).toBe(403);
    expect(ticketUpdateMany).not.toHaveBeenCalled();
  });
});

describe('POST /api/shows/[showId]/scan — the offline door syncing later', () => {
  it('records a plausible claimed time as the scan time', async () => {
    signedInAs('venue');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const res = await POST(post({ ticketId: CODE, scannedAt: tenMinutesAgo }), params);
    expect(res.status).toBe(200);
    const written = ticketUpdateMany.mock.calls[0][0].data.scannedAt as Date;
    expect(written.toISOString()).toBe(tenMinutesAgo);
    expect((await res.json()).ticket.scannedAt).toBe(tenMinutesAgo);
  });

  it('uses its own clock for a claim from the future or from garbage', async () => {
    signedInAs('venue');
    const before = Date.now();
    await POST(post({ ticketId: CODE, scannedAt: new Date(Date.now() + 60_000).toISOString() }), params);
    const written = ticketUpdateMany.mock.calls[0][0].data.scannedAt as Date;
    expect(written.getTime()).toBeGreaterThanOrEqual(before);
    expect(written.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('matches the code as typed or lower-cased, so a typed 0X… finds a minted id and an IHY-… id is not lower-cased away', async () => {
    signedInAs('venue');
    await POST(post({ ticketId: ` ${CODE.toUpperCase()} ` }), params);
    expect(ticketFindFirst.mock.calls[0][0].where.serializedId).toEqual({ in: [CODE.toUpperCase(), CODE] });
    await POST(post({ ticketId: 'IHY-1A2B3C4D' }), params);
    expect(ticketFindFirst.mock.calls[1][0].where.serializedId).toEqual({ in: ['IHY-1A2B3C4D', 'ihy-1a2b3c4d'] });
  });

  it('answers 409 when the atomic flip found the ticket already used — the duplicate a second door reports', async () => {
    signedInAs('venue');
    const usedAt = new Date('2026-10-01T01:00:00.000Z');
    ticketFindFirst.mockResolvedValue({ id: 'tk_1', status: 'SCANNED', holderName: 'Ada', holderEmail: 'ada@example.com', scannedAt: usedAt });
    ticketUpdateMany.mockResolvedValue({ count: 0 });
    const res = await POST(post({ ticketId: CODE }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).scannedAt).toBe(usedAt.toISOString());
  });
});
