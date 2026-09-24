/**
 * Ticket transfer, both paths (2026-09-24, DESIGN_SYNC row 513).
 *
 * A transfer code minted before an email transfer used to stay live, so its
 * holder could claim the tickets back from the new owner; and the email
 * transfer told the sender "emailed" whatever the provider answered, while
 * for a recipient with no account the email was the only copy of the codes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitKey: vi.fn().mockReturnValue('k'),
}));
const sendGenericEmail = vi.fn();
vi.mock('@/lib/mailer', () => ({ sendGenericEmail: (...a: unknown[]) => sendGenericEmail(...a) }));

const tx = {
  ticket: { update: vi.fn().mockResolvedValue({}) },
  ticketOrder: { update: vi.fn().mockResolvedValue({}), updateMany: vi.fn() },
  ticketTransferCode: { updateMany: vi.fn() },
};
const transaction = vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx));
const orderFindUnique = vi.fn();
const userFindUnique = vi.fn();
const codeFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: (fn: (t: typeof tx) => unknown) => transaction(fn),
    ticketOrder: { findUnique: (...a: unknown[]) => orderFindUnique(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    ticketTransferCode: { findUnique: (...a: unknown[]) => codeFindUnique(...a) },
  },
}));

import { auth } from '@/lib/auth';
import { POST as transfer } from '@/app/api/tickets/[serializedId]/transfer/route';
import { POST as claim } from '@/app/api/tickets/claim/route';

const post = (url: string, body: unknown) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  tx.ticketTransferCode.updateMany.mockResolvedValue({ count: 1 });
  tx.ticketOrder.updateMany.mockResolvedValue({ count: 1 });
  sendGenericEmail.mockResolvedValue(undefined);
});

describe('email transfer', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'sender' } } as never);
    orderFindUnique.mockResolvedValue({
      id: 'order1', buyerUserId: 'sender', status: 'CAPTURED', confirmationCode: 'C1',
      show: { title: 'Night', startsAt: new Date() },
      tickets: [{ serializedId: 'T1', holderName: 'S', status: 'VALID' }],
    });
  });
  const send = () => transfer(post('https://ihype.org/api/tickets/order1/transfer', { toEmail: 'friend@example.com' }) as never, { params: Promise.resolve({ serializedId: 'order1' }) });

  it('expires every live transfer code on the order in the same transaction', async () => {
    userFindUnique.mockResolvedValue({ id: 'friend' });
    const res = await send();
    expect(res.status).toBe(200);
    expect(tx.ticketTransferCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ticketOrderId: 'order1', claimedAt: null }),
    }));
  });

  it('transfers nothing when the email to a recipient with no account fails', async () => {
    userFindUnique.mockResolvedValue(null);
    sendGenericEmail.mockRejectedValue(new Error('provider down'));
    const res = await send();
    expect(res.status).toBe(502);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('reports a failed notice to a member instead of claiming it was sent', async () => {
    userFindUnique.mockResolvedValue({ id: 'friend' });
    sendGenericEmail.mockRejectedValue(new Error('provider down'));
    const res = await send();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ transferred: true, emailed: false });
  });
});

describe('transfer-code claim', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'claimer', email: 'c@example.com' } } as never);
  });
  const code = (buyerUserId: string) => ({
    id: 'code1', createdById: 'sender', claimedAt: null, expiresAt: new Date(Date.now() + 3_600_000),
    ticketOrder: { id: 'order1', status: 'CAPTURED', buyerUserId, show: { title: 'Night' }, tickets: [{ serializedId: 'T1', status: 'VALID' }] },
  });

  it('refuses a code whose creator no longer owns the order', async () => {
    codeFindUnique.mockResolvedValue(code('someone-else'));
    const res = await claim(post('https://ihype.org/api/tickets/claim', { code: 'ABCD2345' }));
    expect(res.status).toBe(404);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rolls back when the order changes hands between the read and the write', async () => {
    codeFindUnique.mockResolvedValue(code('sender'));
    tx.ticketOrder.updateMany.mockResolvedValue({ count: 0 });
    const res = await claim(post('https://ihype.org/api/tickets/claim', { code: 'ABCD2345' }));
    expect(res.status).toBe(404);
    expect(tx.ticket.update).not.toHaveBeenCalled();
  });
});
