import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsPayableCategory, AccountsPayableStatus } from '@prisma/client';

// Auto-mocked Prisma, mirroring the pattern in privacy-actions.test.ts —
// every model resolves to inert defaults; each test programs only what it
// cares about.
vi.mock('@/lib/db', () => {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  function makeModel() {
    return {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    };
  }
  const db = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (!models.has(prop)) models.set(prop, makeModel());
      return models.get(prop);
    },
  });
  return { db };
});

vi.mock('@/lib/stripe', () => ({
  isStripeConfigured: vi.fn().mockReturnValue(true),
  createPayoutTransfer: vi.fn().mockResolvedValue('tr_default'),
}));
vi.mock('@/lib/mailer', () => ({ sendGenericEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/env', () => ({ ADMIN_EMAIL: 'admin@ihype.org' }));

import { db } from '@/lib/db';
import { createPayoutTransfer, isStripeConfigured } from '@/lib/stripe';
import { sendGenericEmail } from '@/lib/mailer';
import { triggerShowPayouts } from '@/lib/show-payouts';

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const mockIsStripeConfigured = isStripeConfigured as unknown as ReturnType<typeof vi.fn>;
const mockCreatePayoutTransfer = createPayoutTransfer as unknown as ReturnType<typeof vi.fn>;
const mockSendEmail = sendGenericEmail as unknown as ReturnType<typeof vi.fn>;

function entry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ap_1',
    amountCents: 7000,
    showId: 'show_1',
    payeeLabel: 'Artist Payout',
    profile: { stripeConnectAccountId: 'acct_artist', owner: { email: 'artist@ihype.org' } },
    show: { title: 'Neon Night' },
    ...overrides,
  };
}

beforeEach(() => {
  // Model methods live behind a Proxy, so per-model iteration can't reach
  // them (see privacy-actions.test.ts) — vi.clearAllMocks() clears call
  // history on every mock, Proxy-created ones included. Re-establish the
  // default implementations afterward since clearing leaves them intact but
  // the per-test `*Once` queues need a clean slate.
  vi.clearAllMocks();
  mockIsStripeConfigured.mockReturnValue(true);
  mockCreatePayoutTransfer.mockReset().mockResolvedValue('tr_default');
  mockSendEmail.mockReset().mockResolvedValue(undefined);
  mockDb.accountsPayableEntry.findMany.mockReset().mockResolvedValue([]);
  mockDb.accountsPayableEntry.update.mockReset().mockResolvedValue({});
});

describe('triggerShowPayouts', () => {
  it('no-ops without touching the DB when Stripe is not configured', async () => {
    mockIsStripeConfigured.mockReturnValue(false);

    await expect(triggerShowPayouts()).resolves.toEqual({ released: 0, skipped: 0 });
    expect(mockDb.accountsPayableEntry.findMany).not.toHaveBeenCalled();
    expect(mockCreatePayoutTransfer).not.toHaveBeenCalled();
  });

  it('only queries PENDING, connect-category, profile-owned entries for ENDED shows', async () => {
    await triggerShowPayouts();

    const where = mockDb.accountsPayableEntry.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: AccountsPayableStatus.PENDING,
      category: { in: [
        AccountsPayableCategory.VENUE_PAYOUT,
        AccountsPayableCategory.ARTIST_PAYOUT,
        AccountsPayableCategory.PROMOTER_AFFILIATE,
      ] },
      profileId: { not: null },
      show: { status: 'ENDED' },
    });
  });

  it('transfers each eligible entry, marks it RELEASED with the transfer id, and emails the owner', async () => {
    mockDb.accountsPayableEntry.findMany.mockResolvedValue([entry()]);
    mockCreatePayoutTransfer.mockResolvedValue('tr_live_1');

    await expect(triggerShowPayouts()).resolves.toEqual({ released: 1, skipped: 0 });

    expect(mockCreatePayoutTransfer).toHaveBeenCalledWith({
      amountCents: 7000,
      connectAccountId: 'acct_artist',
      payableEntryId: 'ap_1',
      showId: 'show_1',
      description: 'Artist Payout — Neon Night',
    });
    expect(mockDb.accountsPayableEntry.update).toHaveBeenCalledWith({
      where: { id: 'ap_1' },
      data: expect.objectContaining({
        status: AccountsPayableStatus.RELEASED,
        stripeTransferId: 'tr_live_1',
        paidAt: expect.any(Date),
      }),
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'artist@ihype.org' }),
    );
  });

  it('skips (does not transfer) an entry whose profile has no Stripe Connect account', async () => {
    mockDb.accountsPayableEntry.findMany.mockResolvedValue([
      entry({ profile: { stripeConnectAccountId: null, owner: { email: 'x@ihype.org' } } }),
    ]);

    await expect(triggerShowPayouts()).resolves.toEqual({ released: 0, skipped: 1 });
    expect(mockCreatePayoutTransfer).not.toHaveBeenCalled();
    expect(mockDb.accountsPayableEntry.update).not.toHaveBeenCalled();
  });

  it('never marks an entry RELEASED when its transfer throws — it stays PENDING for retry and admin is alerted', async () => {
    mockDb.accountsPayableEntry.findMany.mockResolvedValue([entry()]);
    mockCreatePayoutTransfer.mockRejectedValue(new Error('stripe down'));

    await expect(triggerShowPayouts()).resolves.toEqual({ released: 0, skipped: 1 });
    // The load-bearing invariant: a failed transfer must not flip the entry to
    // RELEASED, or the money is owed but the ledger says it was paid.
    expect(mockDb.accountsPayableEntry.update).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@ihype.org' }),
    );
  });

  it('processes the remaining entries after one fails (a single bad transfer does not abort the batch)', async () => {
    mockDb.accountsPayableEntry.findMany.mockResolvedValue([
      entry({ id: 'ap_1' }),
      entry({ id: 'ap_2', profile: { stripeConnectAccountId: 'acct_venue', owner: { email: 'venue@ihype.org' } } }),
    ]);
    mockCreatePayoutTransfer
      .mockRejectedValueOnce(new Error('stripe down'))
      .mockResolvedValueOnce('tr_ap_2');

    await expect(triggerShowPayouts()).resolves.toEqual({ released: 1, skipped: 1 });
    expect(mockDb.accountsPayableEntry.update).toHaveBeenCalledTimes(1);
    expect(mockDb.accountsPayableEntry.update).toHaveBeenCalledWith({
      where: { id: 'ap_2' },
      data: expect.objectContaining({ status: AccountsPayableStatus.RELEASED, stripeTransferId: 'tr_ap_2' }),
    });
  });
});
