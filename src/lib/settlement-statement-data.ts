/**
 * The database half of the Settlement Statement: reading one show's figures,
 * and keeping a venue's non-payment pause (Split Agreement 8.6) in step with
 * the reports that justify it.
 */
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { notifyUser } from '@/lib/notify';
import { parseApprovedDeductions } from '@/lib/split-agreement-data';
import { buildStatementLines, isHoldEligible, summarizeOrders } from '@/lib/settlement-statement';

export async function loadShowSettlement(showId: string) {
  const [orders, statement, agreements] = await Promise.all([
    db.ticketOrder.findMany({
      where: { showId },
      select: { status: true, quantity: true, subtotalCents: true, totalTaxCents: true, chargedAt: true, refundedAt: true },
    }),
    db.showSettlementStatement.findUnique({ where: { showId } }),
    db.showSplitAgreement.findMany({
      where: { showId, supersededAt: null },
      orderBy: { artistSignedAt: 'asc' },
      select: {
        id: true, splitPercent: true, guaranteeCents: true, approvedDeductions: true, artistPaymentMethod: true,
        artistProfileId: true,
        artistProfile: { select: { name: true, ownerId: true, payoutMethodKind: true, payoutMethodDetails: true, payoutMethodUpdatedAt: true } },
        payment: true,
      },
    }),
  ]);
  const summary = summarizeOrders(orders);
  const offPlatformCents = statement?.offPlatformCents ?? 0;
  const chargebacksLostCents = statement?.chargebacksLostCents ?? 0;
  return { summary, statement, agreements, offPlatformCents, chargebacksLostCents };
}

export function statementFor(
  loaded: Awaited<ReturnType<typeof loadShowSettlement>>,
  cancelled: boolean,
) {
  return buildStatementLines({
    orders: loaded.summary,
    offPlatformCents: loaded.offPlatformCents,
    chargebacksLostCents: loaded.chargebacksLostCents,
    cancelled,
    agreements: loaded.agreements.map((a) => ({
      id: a.id,
      artistName: a.artistProfile.name,
      splitPercent: a.splitPercent,
      guaranteeCents: a.guaranteeCents,
      deductionCapCents: parseApprovedDeductions(a.approvedDeductions).reduce((sum, d) => sum + d.capCents, 0),
      deductionsAppliedCents: a.payment?.deductionsAppliedCents ?? 0,
    })),
  });
}

/**
 * Set or clear one venue's pause from the reports that exist right now.
 * Returns whether the venue is paused after the call.
 */
export async function refreshVenueHold(venueProfileId: string, now = new Date()): Promise<boolean> {
  const [venue, open] = await Promise.all([
    db.profile.findUnique({ where: { id: venueProfileId }, select: { paymentReportHoldAt: true, ownerId: true, name: true } }),
    db.artistSharePayment.findMany({
      where: { reportedAt: { not: null }, reportResolvedAt: null, agreement: { venueProfileId, supersededAt: null } },
      select: { reportedAt: true, reportResolvedAt: true, agreement: { select: { show: { select: { startsAt: true } } } } },
    }),
  ]);
  if (!venue) return false;
  const eligible = open.some((p) => isHoldEligible({ now, showStartsAt: p.agreement.show.startsAt, reportedAt: p.reportedAt, reportResolvedAt: p.reportResolvedAt }));
  if (eligible && !venue.paymentReportHoldAt) {
    await db.profile.update({ where: { id: venueProfileId }, data: { paymentReportHoldAt: now } });
    await notifyUser(venue.ownerId, {
      type: 'venue_payment_hold',
      title: 'Ticket sales paused',
      body: 'An artist payment report on one of your shows is still unresolved past the settlement window. New ticket sales and lineup offers are paused until the artist confirms payment.',
      link: '/app/me/payouts',
    }).catch(() => undefined);
    return true;
  }
  if (!eligible && venue.paymentReportHoldAt) {
    await db.profile.update({ where: { id: venueProfileId }, data: { paymentReportHoldAt: null } });
    return false;
  }
  return eligible;
}

/**
 * The daily settlement job: tell both sides a statement is ready once a show
 * has been over for a day (6.1), and bring every venue's pause into line with
 * its reports (8.6). Reports and pauses only — it never touches money.
 */
export async function runSplitSettlement(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let notified = 0;
  const ready = await db.show.findMany({
    where: {
      startsAt: { lt: dayAgo },
      splitAgreements: { some: { supersededAt: null } },
      OR: [{ settlementStatement: null }, { settlementStatement: { notifiedAt: null } }],
    },
    select: {
      id: true, slug: true, title: true,
      venueProfile: { select: { ownerId: true } },
      splitAgreements: { where: { supersededAt: null }, select: { artistProfile: { select: { ownerId: true } } } },
    },
    take: 200,
  });
  for (const show of ready) {
    const link = `/app/me/shows/${show.slug}/settlement`;
    const owners = new Set([show.venueProfile?.ownerId, ...show.splitAgreements.map((a) => a.artistProfile.ownerId)].filter((id): id is string => Boolean(id)));
    for (const ownerId of owners) {
      await notifyUser(ownerId, {
        type: 'settlement_statement_ready',
        title: 'Settlement statement ready',
        body: `The settlement statement for "${show.title}" is ready. The venue pays each act within 7 days of the show.`,
        link,
      }).catch((error) => log.error('[split-settlement]', error instanceof Error ? error : null, 'notify failed'));
    }
    await db.showSettlementStatement.upsert({
      where: { showId: show.id },
      create: { showId: show.id, notifiedAt: now },
      update: { notifiedAt: now },
    });
    notified += 1;
  }

  const venues = await db.profile.findMany({
    where: {
      OR: [
        { paymentReportHoldAt: { not: null } },
        { venueSplitAgreements: { some: { supersededAt: null, payment: { reportedAt: { not: null }, reportResolvedAt: null } } } },
      ],
    },
    select: { id: true },
    take: 500,
  });
  let paused = 0;
  for (const v of venues) {
    if (await refreshVenueHold(v.id, now)) paused += 1;
  }
  return { statementsNotified: notified, venuesChecked: venues.length, venuesPaused: paused };
}
