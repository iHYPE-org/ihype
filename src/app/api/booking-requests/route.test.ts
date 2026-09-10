import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitKey: vi.fn().mockReturnValue('k'),
}));

const notifyUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notify', () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));

const profileFindUnique = vi.fn();
const requestFindFirst = vi.fn();
const requestCreate = vi.fn();
const requestFindUnique = vi.fn();
const requestUpdate = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    profile: { findUnique: (...a: unknown[]) => profileFindUnique(...a) },
    bookingRequest: {
      findFirst: (...a: unknown[]) => requestFindFirst(...a),
      create: (...a: unknown[]) => requestCreate(...a),
      findUnique: (...a: unknown[]) => requestFindUnique(...a),
      update: (...a: unknown[]) => requestUpdate(...a),
    },
  },
}));

import { auth } from '@/lib/auth';
import { PATCH, POST } from './route';

function req(method: string, body: Record<string, unknown>) {
  return new Request('https://ihype.org/api/booking-requests', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'venue-owner', email: 'v@example.com', role: 'LISTENER' }, expires: '' } as never);
  profileFindUnique.mockResolvedValue({ id: 'p_artist', ownerId: 'artist-owner', name: 'The Band', slug: 'the-band', type: 'ARTIST' });
  requestFindFirst.mockResolvedValue(null);
  requestCreate.mockResolvedValue({ id: 'br1', status: 'pending', createdAt: new Date() });
  requestFindUnique.mockResolvedValue({ fromUserId: 'venue-owner', toProfile: { ownerId: 'artist-owner', name: 'The Band' } });
  requestUpdate.mockResolvedValue({ id: 'br1', status: 'accepted' });
});

describe('a booking request reaches the act, and the answer reaches the sender', () => {
  /* The venue pressed send from the demand radar and saw "Request sent". The
     row was created and nothing was notified — and the only inbox was gated
     on the profile being a VENUE, so the ARTIST it was addressed to had no
     surface at all. Seven days later the cron expired it, telling neither. */

  it('notifies the recipient, at a link that exists for an artist', async () => {
    const res = await POST(req('POST', { toProfileId: 'p_artist', message: 'We would love to have you in March.' }));
    expect(res.status).toBe(201);
    expect(notifyUser).toHaveBeenCalledWith('artist-owner', expect.objectContaining({
      type: 'booking-request',
      link: '/app/me/artists/the-band/booking-inbox',
    }));
  });

  it('sends a venue recipient to the venue path', async () => {
    profileFindUnique.mockResolvedValue({ id: 'p_v', ownerId: 'other', name: 'The Hall', slug: 'the-hall', type: 'VENUE' });
    await POST(req('POST', { toProfileId: 'p_v', message: 'Could we play on the 12th?' }));
    expect(notifyUser).toHaveBeenCalledWith('other', expect.objectContaining({ link: '/app/me/venues/the-hall/booking-inbox' }));
  });

  it('tells the sender when their request is answered', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'artist-owner', email: 'a@example.com', role: 'LISTENER' }, expires: '' } as never);
    await PATCH(req('PATCH', { id: 'br1', status: 'accepted' }));
    expect(notifyUser).toHaveBeenCalledWith('venue-owner', expect.objectContaining({ type: 'booking-accepted' }));
  });

  it('records the request even when the notice fails', async () => {
    notifyUser.mockRejectedValueOnce(new Error('push is down'));
    const res = await POST(req('POST', { toProfileId: 'p_artist', message: 'Still a real request.' }));
    expect(res.status).toBe(201);
  });

  it('does not notify someone about their own action', async () => {
    profileFindUnique.mockResolvedValue({ id: 'p_self', ownerId: 'venue-owner', name: 'Mine', slug: 'mine', type: 'ARTIST' });
    await POST(req('POST', { toProfileId: 'p_self', message: 'A note to myself about booking.' }));
    expect(notifyUser).not.toHaveBeenCalled();
  });
});
