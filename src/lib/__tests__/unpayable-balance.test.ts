import { beforeEach, describe, expect, it, vi } from 'vitest';

const aggregate = vi.fn();
const findMany = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    accountsPayableEntry: {
      aggregate: (...a: unknown[]) => aggregate(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
  },
}));

import { centsOrDash, getUnpayableBalance } from '@/lib/unpayable-balance';

beforeEach(() => {
  vi.clearAllMocks();
  aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });
  findMany.mockResolvedValue([]);
});

describe('getUnpayableBalance', () => {
  it('asks for PENDING transferable payables whose profile has not FINISHED onboarding', async () => {
    /* `stripeConnectOnboarded`, not the presence of an account id: the id is
       written the moment Stripe creates the account, before the member has
       been through a screen of the hosted flow, so an id alone would count a
       half-onboarded payee as payable — the same too-loose test the payout
       run itself carried. */
    await getUnpayableBalance();

    const where = aggregate.mock.calls[0][0].where;
    expect(where.status).toBe('PENDING');
    expect(where.profile).toEqual({ stripeConnectOnboarded: false });
    expect(where.category.in).toContain('ARTIST_PAYOUT');
    expect(where.category.in).not.toContain('TAX_LOCAL');
  });

  it('counts tax entries separately, because nothing automated ever releases them', async () => {
    await getUnpayableBalance();

    const taxWhere = aggregate.mock.calls.find((c) => c[0].where.category?.notIn)?.[0].where;
    expect(taxWhere, 'no query asked for the non-transferable categories').toBeDefined();
    expect(taxWhere.status).toBe('PENDING');
  });

  it('reads null, never 0, when a query fails', async () => {
    /* "$0.00 owed but unpayable" is the most reassuring thing this module can
       say and the one it must never say by accident: an operator reading it
       concludes every payee can be paid. */
    aggregate.mockRejectedValue(new Error('connection terminated'));
    findMany.mockRejectedValue(new Error('connection terminated'));

    const owed = await getUnpayableBalance();

    expect(owed.unpayableCents).toBeNull();
    expect(owed.unpayablePayees).toBeNull();
    expect(owed.manualRemittanceCents).toBeNull();
    expect(centsOrDash(owed.unpayableCents)).toBe('—');
  });

  it('one failed read never hides the others', async () => {
    aggregate
      .mockResolvedValueOnce({ _sum: { amountCents: 12_345 } })
      .mockRejectedValueOnce(new Error('down'));
    findMany.mockResolvedValue([{ profileId: 'p1' }, { profileId: 'p2' }]);

    const owed = await getUnpayableBalance();

    expect(owed.unpayableCents).toBe(12_345);
    expect(owed.unpayablePayees).toBe(2);
    expect(owed.manualRemittanceCents).toBeNull();
  });

  it('a sum over no rows is a real zero, not an unread figure', async () => {
    aggregate.mockResolvedValue({ _sum: { amountCents: null } });

    const owed = await getUnpayableBalance();

    expect(owed.unpayableCents).toBe(0);
    expect(centsOrDash(owed.unpayableCents)).toBe('$0.00');
  });
});
