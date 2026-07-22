import { AccountsPayableStatus, TicketOrderStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { refundCapturedTicketOrder, voidReservedTicketOrder } from '@/lib/ticket-order-state';

type TicketOrderTx = Parameters<typeof voidReservedTicketOrder>[0];

function createTx({
  orderStatus = TicketOrderStatus.RESERVED,
  transitionCount = 1,
  releaseCount = 1,
}: {
  orderStatus?: TicketOrderStatus;
  transitionCount?: number;
  releaseCount?: number;
} = {}) {
  const ticketOrder = {
    findUnique: vi.fn().mockResolvedValue({
      id: 'order_1',
      showId: 'show_1',
      quantity: 2,
      status: orderStatus,
    }),
    updateMany: vi.fn().mockResolvedValue({ count: transitionCount }),
  };
  const show = {
    updateMany: vi.fn().mockResolvedValue({ count: releaseCount }),
  };

  return {
    tx: { ticketOrder, show } as unknown as TicketOrderTx,
    ticketOrder,
    show,
  };
}

describe('voidReservedTicketOrder', () => {
  it('atomically marks the order void and releases its reserved capacity', async () => {
    const { tx, ticketOrder, show } = createTx();

    await expect(voidReservedTicketOrder(tx, 'order_1')).resolves.toBe(true);
    expect(ticketOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', status: TicketOrderStatus.RESERVED },
      data: { status: TicketOrderStatus.VOID },
    });
    expect(show.updateMany).toHaveBeenCalledWith({
      where: { id: 'show_1', ticketsSoldCount: { gte: 2 } },
      data: { ticketsSoldCount: { decrement: 2 } },
    });
  });

  it('does nothing when the order is no longer reserved', async () => {
    const { tx, ticketOrder, show } = createTx({ orderStatus: TicketOrderStatus.CAPTURED });

    await expect(voidReservedTicketOrder(tx, 'order_1')).resolves.toBe(false);
    expect(ticketOrder.updateMany).not.toHaveBeenCalled();
    expect(show.updateMany).not.toHaveBeenCalled();
  });

  it('throws when capacity cannot be released so the surrounding transaction rolls back', async () => {
    const { tx } = createTx({ releaseCount: 0 });

    await expect(voidReservedTicketOrder(tx, 'order_1')).rejects.toThrow(
      'voided without releasing reserved capacity',
    );
  });
});

type RefundTx = Parameters<typeof refundCapturedTicketOrder>[0];

function createRefundTx({
  order = { id: 'order_1', showId: 'show_1', quantity: 2, status: TicketOrderStatus.CAPTURED } as {
    id: string;
    showId: string;
    quantity: number;
    status: TicketOrderStatus;
  } | null,
  transitionCount = 1,
  releaseCount = 1,
}: {
  order?: {
    id: string;
    showId: string;
    quantity: number;
    status: TicketOrderStatus;
  } | null;
  transitionCount?: number;
  releaseCount?: number;
} = {}) {
  const ticketOrder = {
    findUnique: vi.fn().mockResolvedValue(order),
    updateMany: vi.fn().mockResolvedValue({ count: transitionCount }),
  };
  const ticket = {
    updateMany: vi.fn().mockResolvedValue({ count: 2 }),
  };
  const show = {
    updateMany: vi.fn().mockResolvedValue({ count: releaseCount }),
  };
  const accountsPayableEntry = {
    updateMany: vi.fn().mockResolvedValue({ count: 3 }),
  };

  return {
    tx: { ticketOrder, ticket, show, accountsPayableEntry } as unknown as RefundTx,
    ticketOrder,
    ticket,
    show,
    accountsPayableEntry,
  };
}

describe('refundCapturedTicketOrder', () => {
  it('voids the order, voids its unscanned tickets, releases capacity, and voids pending payables', async () => {
    const { tx, ticketOrder, ticket, show, accountsPayableEntry } = createRefundTx();

    await expect(refundCapturedTicketOrder(tx, 'order_1')).resolves.toBe(true);

    expect(ticketOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', status: TicketOrderStatus.CAPTURED },
      data: { status: TicketOrderStatus.VOID },
    });
    // Only VALID (unscanned) tickets are voided — a scanned ticket must never
    // be silently invalidated by a refund.
    expect(ticket.updateMany).toHaveBeenCalledWith({
      where: { ticketOrderId: 'order_1', status: 'VALID' },
      data: { status: 'VOID' },
    });
    expect(show.updateMany).toHaveBeenCalledWith({
      where: { id: 'show_1', ticketsSoldCount: { gte: 2 } },
      data: { ticketsSoldCount: { decrement: 2 } },
    });
    // Payout-safety invariant: a refunded order's still-PENDING payable
    // entries are voided so the payout cron can never later pay them out.
    expect(accountsPayableEntry.updateMany).toHaveBeenCalledWith({
      where: { ticketOrderId: 'order_1', status: AccountsPayableStatus.PENDING },
      data: { status: AccountsPayableStatus.VOID },
    });
  });

  it('does nothing when the order does not exist', async () => {
    const { tx, ticketOrder, ticket, show, accountsPayableEntry } = createRefundTx({ order: null });

    await expect(refundCapturedTicketOrder(tx, 'order_1')).resolves.toBe(false);
    expect(ticketOrder.updateMany).not.toHaveBeenCalled();
    expect(ticket.updateMany).not.toHaveBeenCalled();
    expect(show.updateMany).not.toHaveBeenCalled();
    expect(accountsPayableEntry.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when the order is not in the CAPTURED state', async () => {
    const { tx, ticketOrder, ticket } = createRefundTx({
      order: { id: 'order_1', showId: 'show_1', quantity: 2, status: TicketOrderStatus.VOID },
    });

    await expect(refundCapturedTicketOrder(tx, 'order_1')).resolves.toBe(false);
    expect(ticketOrder.updateMany).not.toHaveBeenCalled();
    expect(ticket.updateMany).not.toHaveBeenCalled();
  });

  it('bails out without touching tickets or capacity when the CAPTURED→VOID transition is lost to a concurrent write', async () => {
    const { tx, ticket, show, accountsPayableEntry } = createRefundTx({ transitionCount: 0 });

    await expect(refundCapturedTicketOrder(tx, 'order_1')).resolves.toBe(false);
    // The guarded updateMany already lost the race; nothing downstream should run.
    expect(ticket.updateMany).not.toHaveBeenCalled();
    expect(show.updateMany).not.toHaveBeenCalled();
    expect(accountsPayableEntry.updateMany).not.toHaveBeenCalled();
  });

  it('throws when sold capacity cannot be released, so the surrounding transaction rolls back the whole refund', async () => {
    const { tx, accountsPayableEntry } = createRefundTx({ releaseCount: 0 });

    await expect(refundCapturedTicketOrder(tx, 'order_1')).rejects.toThrow(
      'refunded without releasing sold capacity',
    );
    // The throw must happen before payables are voided — the whole tx unwinds.
    expect(accountsPayableEntry.updateMany).not.toHaveBeenCalled();
  });
});
