import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/request-meta', () => ({ readClientAddress: () => '127.0.0.1' }));
const notifyUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notify', () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));
const emailSignedAgreement = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/split-agreement-copy', () => ({ emailSignedAgreement: (...a: unknown[]) => emailSignedAgreement(...a) }));

const slotFindFirst = vi.fn();
const showFindUnique = vi.fn();
const slotUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const agreementCreate = vi.fn().mockResolvedValue({ id: 'agr_1' });
const slotFindMany = vi.fn().mockResolvedValue([{ status: 'ACCEPTED' }]);
const showUpdate = vi.fn().mockResolvedValue({});
vi.mock('@/lib/db', () => {
  const tx = {
    showLineupSlot: { updateMany: (...a: unknown[]) => slotUpdateMany(...a), findMany: (...a: unknown[]) => slotFindMany(...a) },
    showSplitAgreement: { create: (...a: unknown[]) => agreementCreate(...a) },
    show: { update: (...a: unknown[]) => showUpdate(...a) },
  };
  return {
    db: {
      profile: { findMany: vi.fn().mockResolvedValue([{ id: 'artist_1' }]) },
      showLineupSlot: { findFirst: (...a: unknown[]) => slotFindFirst(...a), update: vi.fn() },
      show: { findUnique: (...a: unknown[]) => showFindUnique(...a) },
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});

import { auth } from '@/lib/auth';
import { renderAndHashAgreement } from '@/lib/split-agreement';
import { termsFor } from '@/lib/split-agreement-data';
import { PATCH } from './route';

const SHOW = {
  id: 'show_1', slug: 'the-night', title: 'The Night', status: 'DRAFT', startsAt: new Date('2026-12-01T01:00:00Z'), timeZone: 'America/New_York',
  isTicketed: true, ticketingOpensAt: null,
  venueProfile: { id: 'venue_1', ownerId: 'venue-owner', name: 'The Room', addressLine1: '1 Main St', city: 'Portland', stateRegion: 'ME', postalCode: '04101' },
};
const SLOT_TERMS = { splitPercent: 70, guaranteeCents: null, approvedDeductions: [], guarantorName: null, juryWaiver: false };
let hash = '';

function slot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'slot_1', status: 'PENDING', profileId: 'artist_1', ...SLOT_TERMS,
    agreementVersion: '2026-09-27.1', agreementHash: hash,
    venueSignerUserId: 'venue-owner', venueSignerName: 'Pat Venue', venueSignedAt: new Date('2026-09-27T00:00:00Z'), venueSignerIp: null, venueSignerDevice: null,
    profile: { name: 'The Band', payoutMethodKind: 'PAYMENT_APP', payoutMethodDetails: 'Venmo @band' },
    ...overrides,
  };
}
const params = { params: Promise.resolve({ showId: 'show_1' }) };
const req = (body: unknown) => new Request('https://ihype.org/api/shows/show_1/lineup/respond', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'artist-owner' } } as never);
  hash = (await renderAndHashAgreement(termsFor({ show: SHOW, venue: SHOW.venueProfile, artistName: 'The Band', slot: SLOT_TERMS }))).hash;
  showFindUnique.mockResolvedValue(SHOW);
  slotFindFirst.mockResolvedValue(slot());
  slotUpdateMany.mockResolvedValue({ count: 1 });
  slotFindMany.mockResolvedValue([{ status: 'ACCEPTED' }]);
});

describe('PATCH /api/shows/[showId]/lineup/respond — the act signs the split agreement', () => {
  it('records the signed agreement with the exact text, schedules the show and opens sales on the last signature', async () => {
    const res = await PATCH(req({ status: 'ACCEPTED', agreementHash: hash, signerName: 'Sam Band' }), params);
    expect(res.status).toBe(200);
    const [{ data }] = agreementCreate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.textHash).toBe(hash);
    expect(String(data.text)).toContain('SHOW REVENUE SPLIT AGREEMENT');
    expect(data.artistSignerName).toBe('Sam Band');
    expect(data.artistPaymentMethod).toBe('Payment app: Venmo @band');
    expect(showUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SCHEDULED', ticketingOpensAt: expect.any(Date) }) }));
    expect(emailSignedAgreement).toHaveBeenCalledWith('agr_1');
  });

  it('refuses to sign text that differs from what the act was shown', async () => {
    const res = await PATCH(req({ status: 'ACCEPTED', agreementHash: 'a'.repeat(64), signerName: 'Sam Band' }), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'AGREEMENT_CHANGED' });
    expect(agreementCreate).not.toHaveBeenCalled();
  });

  it('refuses when the show changed after the venue signed, so the stored hash no longer matches', async () => {
    showFindUnique.mockResolvedValueOnce({ ...SHOW, title: 'Renamed' });
    const res = await PATCH(req({ status: 'ACCEPTED', agreementHash: hash, signerName: 'Sam Band' }), params);
    expect(res.status).toBe(409);
    expect(agreementCreate).not.toHaveBeenCalled();
  });

  it('needs a payment method on file before the act can sign (5.2)', async () => {
    slotFindFirst.mockResolvedValueOnce(slot({ profile: { name: 'The Band', payoutMethodKind: null, payoutMethodDetails: null } }));
    const res = await PATCH(req({ status: 'ACCEPTED', agreementHash: hash, signerName: 'Sam Band' }), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'PAYOUT_METHOD_REQUIRED' });
  });

  it('cannot sign an offer the venue has not signed', async () => {
    slotFindFirst.mockResolvedValueOnce(slot({ agreementHash: null, venueSignedAt: null }));
    const res = await PATCH(req({ status: 'ACCEPTED', agreementHash: hash, signerName: 'Sam Band' }), params);
    expect(res.status).toBe(409);
  });

  it('leaves the show a draft while another act has not signed', async () => {
    slotFindMany.mockResolvedValueOnce([{ status: 'ACCEPTED' }, { status: 'PENDING' }]);
    const res = await PATCH(req({ status: 'ACCEPTED', agreementHash: hash, signerName: 'Sam Band' }), params);
    expect(res.status).toBe(200);
    expect(showUpdate).not.toHaveBeenCalled();
  });

  it('writes nothing if the slot changed under it (a revision or a second tap)', async () => {
    slotUpdateMany.mockResolvedValueOnce({ count: 0 });
    const res = await PATCH(req({ status: 'ACCEPTED', agreementHash: hash, signerName: 'Sam Band' }), params);
    expect(res.status).toBe(409);
    expect(agreementCreate).not.toHaveBeenCalled();
  });
});
