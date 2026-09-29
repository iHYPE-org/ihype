import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'venue_owner' } })) }));
vi.mock('@/lib/db', () => ({ db: { showSplitAgreement: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
vi.mock('@/lib/mailer', () => ({ sendOperationalEmail: vi.fn() }));
vi.mock('@/lib/notify', () => ({ notifyUser: vi.fn() }));
vi.mock('@/lib/settlement-statement-data', () => ({ refreshVenueHold: vi.fn() }));

import { POST } from './route';

const params = { params: Promise.resolve({ agreementId: 'agr_1' }) };
function post(body: unknown) {
  return POST(new Request('http://localhost/api/split-agreements/agr_1/payment', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), params);
}
const paid = { action: 'mark_paid', amountCents: 12_000, method: 'Venmo', reference: 'tx-1' };

beforeEach(() => { findUnique.mockReset(); findUnique.mockResolvedValue(null); });

describe('POST /api/split-agreements/[agreementId]/payment — paidOn', () => {
  it('refuses a day that matches the pattern but is not a date, before any read', async () => {
    for (const paidOn of ['2026-13-45', '2026-02-30', '2026-00-10']) {
      const res = await post({ ...paid, paidOn });
      expect(res.status, paidOn).toBe(400);
      expect((await res.json()).error).toMatch(/real date/);
    }
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('accepts a real day and goes on to read the agreement', async () => {
    const res = await post({ ...paid, paidOn: '2026-02-28' });
    expect(res.status).toBe(404); // no agreement seeded — validation passed
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
