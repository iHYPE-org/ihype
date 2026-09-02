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
  // No prior transfer for any entry unless a test says otherwise.
  findPayoutTransfer: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/mailer', () => ({ sendGenericEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/env', () => ({ getAdminAlertRecipients: () => ['admin@ihype.org'] }));

import { db } from '@/lib/db';
import { createPayoutTransfer, findPayoutTransfer, isStripeConfigured } from '@/lib/stripe';
import { sendGenericEmail } from '@/lib/mailer';
import { triggerShowPayouts } from '@/lib/show-payouts';

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const mockIsStripeConfigured = isStripeConfigured as unknown as ReturnType<typeof vi.fn>;
const mockCreatePayoutTransfer = createPayoutTransfer as unknown as ReturnType<typeof vi.fn>;
const mockFindPayoutTransfer = findPayoutTransfer as unknown as ReturnType<typeof vi.fn>;
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
  mockFindPayoutTransfer.mockReset().mockResolvedValue(null);
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

  /* THE CRON RUNNING TWICE IS THE ONE FAILURE NOBODY SEES UNTIL IT COSTS
     MONEY, and until now nothing asserted it.

     `docs/runbooks/money-path-rehearsal.md` ends on exactly this check —
     "running the payout cron twice and seeing `released: 0`" — because a
     double payout does not raise an error, does not fail a request, and
     leaves no complaint: the money simply leaves the platform balance twice
     and the second transfer looks as ordinary as the first. The runbook has
     to be walked by a person against a real database, so the guarantee had
     no automated cover at all.

     What makes it safe is one clause: the query filters `status: PENDING`,
     and a released entry is no longer PENDING. So this test models the store
     statefully and applies that filter, which means the second pass finds
     nothing BECAUSE the first pass wrote RELEASED — not because a mock was
     told to return an empty array. A test that stubbed the second findMany
     to `[]` would pass with the filter deleted, which is precisely the
     regression worth catching. */
  it('pays once when the cron runs twice — the second pass releases nothing', async () => {
    /* Typed wider than `entry()` returns because the release WRITES fields the
       fixture does not declare — `stripeTransferId` and `paidAt` arrive via the
       update below, and asserting on them is the point. */
    const store: Array<Record<string, unknown> & { id: string; status: AccountsPayableStatus }> = [
      { ...entry(), status: AccountsPayableStatus.PENDING },
    ];
    /* An ABSENT status filter must return EVERYTHING, the way a real query
       would. Modelling it as `row.status === args.where.status` looks
       equivalent and is not: with the filter deleted the comparison is
       `=== undefined`, the fake returns nothing, and the test fails on the
       FIRST pass releasing 0 — reporting the mutation but never once
       exercising a double payment. Verified by deleting the filter and
       watching this fake pay twice. */
    mockDb.accountsPayableEntry.findMany.mockImplementation(
      async (args: { where: { status?: AccountsPayableStatus } }) =>
        store.filter((row) => args.where.status === undefined || row.status === args.where.status),
    );
    mockDb.accountsPayableEntry.update.mockImplementation(
      async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.find((candidate) => candidate.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return row ?? {};
      },
    );
    mockCreatePayoutTransfer.mockResolvedValue('tr_once');

    await expect(triggerShowPayouts()).resolves.toEqual({ released: 1, skipped: 0 });
    await expect(triggerShowPayouts()).resolves.toEqual({ released: 0, skipped: 0 });

    // The assertion that actually protects the money.
    expect(mockCreatePayoutTransfer).toHaveBeenCalledTimes(1);
    expect(store[0].status).toBe(AccountsPayableStatus.RELEASED);
    expect(store[0].stripeTransferId).toBe('tr_once');
  });

  it('records an existing Stripe transfer instead of paying the entry a second time', async () => {
    // Last run's transfer succeeded but the RELEASED write failed; the entry
    // is still PENDING and Stripe already holds a transfer for it.
    mockDb.accountsPayableEntry.findMany.mockResolvedValue([entry()]);
    mockFindPayoutTransfer.mockResolvedValueOnce('tr_existing');

    const result = await triggerShowPayouts();

    expect(mockCreatePayoutTransfer).not.toHaveBeenCalled();
    expect(mockDb.accountsPayableEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ap_1' },
      data: expect.objectContaining({ status: 'RELEASED', stripeTransferId: 'tr_existing' }),
    }));
    expect(result.released).toBe(1);
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
      // Now a list: ADMIN_ALERT_EMAIL accepts several comma-separated
      // addresses so an alert is not a bus factor of one.
      expect.objectContaining({ to: ['admin@ihype.org'] }),
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
