/**
 * WHAT A VENUE OWES ITS ACTS, AND BY WHEN — the venue dashboard's money card.
 *
 * Under the split agreement (2026-09-27, DESIGN_SYNC row 528) a venue is never
 * PAID by iHYPE: it collects every sale itself and pays each act the signed
 * percentage within `SETTLEMENT_DAYS_AFTER_SHOW` of the show. Until 2026-09-29
 * (row 533) its dashboard's "Next Payout" card read only the legacy
 * `AccountsPayableEntry` rows the payout cron issues, so a venue holding a
 * sold-out night's takings read "No pending payouts right now" — true of a
 * payout it was never going to receive, silent about the money it owed.
 *
 * This is the order-level reading, like `artist-share.ts`: the face value the
 * captured orders carried times each unpaid act's signed split, before the
 * deductions, refunds and guarantees the settlement statement applies. The
 * statement remains the figure the venue pays; this is the reminder.
 *
 * An act is UNPAID until the venue has marked it paid (5.3) or the act has
 * confirmed; an agreement the venue already marked paid is out of the sum
 * even before the act confirms, because the venue has done its part.
 */
import { orderActShareCents, type ShareOrder } from './artist-share';
import { VENUE_KEEPS_ALL } from './settlement-mode';
import { settlementDateFor } from './split-agreement';

export type SettlementShow = {
  startsAt: Date;
  /** The show's LIVE agreements (`supersededAt: null`). */
  agreements: { splitPercent: number; payment: { paidMarkedAt: Date | null; artistConfirmedAt: Date | null } | null }[];
  /** The show's CAPTURED orders. */
  orders: ShareOrder[];
};

export type ActSettlementDue = {
  /** The soonest settlement date among the shows with an unpaid act. */
  dueAt: Date;
  /** Everything owed across those shows, before deductions. */
  owedCents: number;
  /** How many shows carry an unpaid act. */
  shows: number;
};

export function nextActSettlement(shows: SettlementShow[]): ActSettlementDue | null {
  let dueAt: Date | null = null;
  let owedCents = 0;
  let count = 0;
  for (const show of shows) {
    const unpaid = show.agreements.filter((a) => !a.payment?.paidMarkedAt && !a.payment?.artistConfirmedAt);
    const sold = show.orders.filter((o) => o.settlementMode === VENUE_KEEPS_ALL);
    if (unpaid.length === 0 || sold.length === 0) continue;
    let showOwed = 0;
    for (const agreement of unpaid) {
      for (const order of sold) showOwed += orderActShareCents(order, agreement.splitPercent) ?? 0;
    }
    owedCents += showOwed;
    count += 1;
    const due = settlementDateFor(show.startsAt);
    if (!dueAt || due < dueAt) dueAt = due;
  }
  return dueAt ? { dueAt, owedCents, shows: count } : null;
}
