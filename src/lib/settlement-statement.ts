/**
 * The Settlement Statement (Show Revenue Split Agreement, Section 6) — pure.
 *
 * iHYPE computes what it can see (sales through iHYPE, tax, refunds) and the
 * venue adds what it cannot (admission sold elsewhere, chargebacks it lost,
 * the approved deductions it applies). Each act's Artist Share then follows
 * Section 4 of its own agreement. Nothing here moves money: the venue pays,
 * and the statement is the record both parties agreed to treat as binding
 * (6.3).
 */
import {
  NON_PAYMENT_PAUSE_DAYS,
  PAYMENT_AUTO_CONFIRM_DAYS,
  cancellationAmount,
  computeArtistShare,
  settlementDateFor,
} from '@/lib/split-agreement';

const DAY_MS = 24 * 60 * 60 * 1000;

export type StatementOrder = {
  status: 'RESERVED' | 'CAPTURED' | 'VOID';
  quantity: number;
  subtotalCents: number;
  totalTaxCents: number;
  chargedAt: Date | null;
  refundedAt: Date | null;
};

/** Orders that were paid at some point: captured now, or captured then refunded. */
export function summarizeOrders(orders: StatementOrder[]) {
  let ticketsSold = 0;
  let ticketsRefunded = 0;
  let grossCents = 0;
  let taxCents = 0;
  let refundsCents = 0;
  for (const o of orders) {
    const wasPaid = o.status === 'CAPTURED' || Boolean(o.refundedAt) || (o.status === 'VOID' && Boolean(o.chargedAt));
    if (!wasPaid) continue;
    ticketsSold += o.quantity;
    grossCents += o.subtotalCents + o.totalTaxCents;
    taxCents += o.totalTaxCents;
    if (o.refundedAt) {
      ticketsRefunded += o.quantity;
      /* Agreement 4.2: the refund line is the FACE value refunded. The tax on
         a refunded ticket is already in the tax line, so it is not taken
         twice. */
      refundsCents += o.subtotalCents;
    }
  }
  return { ticketsSold, ticketsRefunded, grossCents, taxCents, refundsCents };
}

export type PaymentState =
  | 'NOT_DUE'
  | 'DUE'
  | 'OVERDUE'
  | 'MARKED_PAID'
  | 'COMPLETE'
  | 'REPORTED';

export function paymentState(input: {
  now: Date;
  showStartsAt: Date;
  paidMarkedAt: Date | null;
  artistConfirmedAt: Date | null;
  reportedAt: Date | null;
  reportResolvedAt: Date | null;
}): PaymentState {
  if (input.reportedAt && !input.reportResolvedAt) return 'REPORTED';
  if (input.artistConfirmedAt) return 'COMPLETE';
  if (input.paidMarkedAt) {
    /* 5.3: complete when the act confirms, or 5 days after the venue marks it
       paid with no report. */
    return input.now.getTime() - input.paidMarkedAt.getTime() >= PAYMENT_AUTO_CONFIRM_DAYS * DAY_MS ? 'COMPLETE' : 'MARKED_PAID';
  }
  const due = settlementDateFor(input.showStartsAt);
  if (input.now < input.showStartsAt) return 'NOT_DUE';
  return input.now > due ? 'OVERDUE' : 'DUE';
}

/** 8.6: the moment an unresolved report makes the venue pausable. */
export function holdThreshold(showStartsAt: Date): Date {
  return new Date(settlementDateFor(showStartsAt).getTime() + NON_PAYMENT_PAUSE_DAYS * DAY_MS);
}

export function isHoldEligible(input: { now: Date; showStartsAt: Date; reportedAt: Date | null; reportResolvedAt: Date | null }): boolean {
  return Boolean(input.reportedAt && !input.reportResolvedAt && input.now > holdThreshold(input.showStartsAt));
}

export type StatementLine = {
  agreementId: string;
  artistName: string;
  splitPercent: number;
  guaranteeCents: number | null;
  deductionCapCents: number;
  deductionsAppliedCents: number;
  bySplitCents: number;
  artistShareCents: number;
  /** Section 7.3 — owed only if the VENUE cancelled for a reason outside 7.5. */
  venueCancellationCents: number | null;
};

export function buildStatementLines(input: {
  orders: ReturnType<typeof summarizeOrders>;
  offPlatformCents: number;
  chargebacksLostCents: number;
  cancelled: boolean;
  agreements: {
    id: string;
    artistName: string;
    splitPercent: number;
    guaranteeCents: number | null;
    deductionCapCents: number;
    deductionsAppliedCents: number;
  }[];
}): { netCents: number; grossCents: number; lines: StatementLine[] } {
  const grossCents = input.orders.grossCents + input.offPlatformCents;
  /* The show-level Net Ticket Receipts, before any one act's approved
     deductions (those are per agreement, so each line applies its own). */
  const netCents = Math.max(0, grossCents - input.orders.taxCents - input.orders.refundsCents - input.chargebacksLostCents);
  const lines = input.agreements.map((a) => {
    // Approved deductions are the venue's to apply, never above the cap the act signed.
    const applied = Math.min(Math.max(0, a.deductionsAppliedCents), a.deductionCapCents);
    const share = computeArtistShare({
      grossThroughIhypeCents: input.orders.grossCents,
      taxCents: input.orders.taxCents,
      refundsCents: input.orders.refundsCents,
      chargebacksLostCents: input.chargebacksLostCents,
      offPlatformCents: input.offPlatformCents,
      approvedDeductionsCents: applied,
      splitPercent: a.splitPercent,
      guaranteeCents: a.guaranteeCents,
    });
    return {
      agreementId: a.id,
      artistName: a.artistName,
      splitPercent: a.splitPercent,
      guaranteeCents: a.guaranteeCents,
      deductionCapCents: a.deductionCapCents,
      deductionsAppliedCents: applied,
      bySplitCents: share.bySplitCents,
      artistShareCents: share.artistShareCents,
      venueCancellationCents: input.cancelled
        ? cancellationAmount({
          grossAtCancellationCents: input.orders.grossCents + input.offPlatformCents,
          taxCents: input.orders.taxCents,
          splitPercent: a.splitPercent,
          guaranteeCents: a.guaranteeCents,
        })
        : null,
    };
  });
  return { netCents, grossCents, lines };
}
