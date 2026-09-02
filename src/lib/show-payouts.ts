import { AccountsPayableCategory, AccountsPayableStatus } from '@prisma/client/edge';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { getAdminAlertRecipients } from '@/lib/env';
import { createPayoutTransfer, findPayoutTransfer, isStripeConfigured } from '@/lib/stripe';
import { log } from '@/lib/logger';

// Only these three categories are ever paid out via a Stripe Connect
// transfer — tax entries (TAX_LOCAL/STATE/COUNTRY/INTERNATIONAL) have no
// profileId/Connect account and are a manual remittance matter, out of
// scope here; they stay PENDING for a human to handle.
const CONNECT_PAYOUT_CATEGORIES: AccountsPayableCategory[] = [
  AccountsPayableCategory.VENUE_PAYOUT,
  AccountsPayableCategory.ARTIST_PAYOUT,
  AccountsPayableCategory.PROMOTER_AFFILIATE,
];

/**
 * Real payout release — pays out every still-PENDING AccountsPayableEntry
 * (the actual 70/20/10-split rows computed at order-capture time, see
 * src/lib/ticket-order-state.ts) for shows that have ended, via a real
 * per-entry Stripe transfer. Replaces a previous version that only ever
 * computed a rough gross-revenue estimate and emailed a promise — no money
 * ever actually moved for the venue/promoter shares, and the artist share
 * used different (wrong) percentages than what was actually captured.
 */
/**
 * How long after a show ends before its payables are released.
 *
 * ## Why any delay at all
 *
 * Until 2026-08-27 there was none: an entry became payable the moment the show
 * flipped to ENDED, so there was ZERO window between the last note and the
 * money being gone. A dispute arriving the next morning had nothing left to
 * reverse, and Stripe debits a disputed amount plus its $15 fee from the
 * PLATFORM account whether or not the charge was settled on the act's behalf.
 * The hold is the only thing that makes recovery possible rather than
 * theoretical.
 *
 * ## Why ten days and not longer
 *
 * A card dispute can arrive up to about 120 days out, and holding artists' door
 * money for four months is not a thing a platform for artists can do. Ten days
 * covers the shape of dispute that actually happens on event tickets — "I did
 * not authorise this", "the event was cancelled" — which arrives before or
 * within days of the date, while a late dispute is rare and is what the
 * protection reserve exists to absorb.
 *
 * It is a deliberate trade, not a safety maximum: raising it protects the fund
 * and costs artists patience, lowering it does the reverse. Ten is the number
 * to argue with.
 */
export const PAYOUT_HOLD_DAYS = 10;

export async function triggerShowPayouts(): Promise<{ released: number; skipped: number }> {
  if (!isStripeConfigured()) return { released: 0, skipped: 0 };

  const releasableAfter = new Date(Date.now() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);

  const entries = await db.accountsPayableEntry.findMany({
    where: {
      status: AccountsPayableStatus.PENDING,
      category: { in: CONNECT_PAYOUT_CATEGORIES },
      profileId: { not: null },
      /* ENDED *and* ten days past the date. Both conditions, because they
         answer different questions: the status says the show happened, the
         clock says the dispute window has mostly closed. Filtering on the
         status alone is what left no recovery window at all. */
      show: { status: 'ENDED', startsAt: { lte: releasableAfter } },
    },
    include: {
      profile: { select: { stripeConnectAccountId: true, owner: { select: { email: true } } } },
      show: { select: { title: true } },
    },
    take: 200,
  });

  let released = 0;
  let skipped = 0;

  for (const entry of entries) {
    const connectAccountId = entry.profile?.stripeConnectAccountId;
    if (!connectAccountId) {
      skipped++;
      continue;
    }

    try {
      /* Ask Stripe before paying. A transfer whose RELEASED write failed last
         run is still PENDING here and would otherwise be paid twice once the
         24-hour idempotency window has passed. */
      const existingTransferId = await findPayoutTransfer({ payableEntryId: entry.id, showId: entry.showId });
      if (existingTransferId) {
        log.error('[show-payouts]', null, `entry ${entry.id} already has transfer ${existingTransferId}; recording it instead of paying again`);
      }
      const transferId = existingTransferId ?? await createPayoutTransfer({
        amountCents: entry.amountCents,
        connectAccountId,
        payableEntryId: entry.id,
        showId: entry.showId,
        description: `${entry.payeeLabel} — ${entry.show.title}`,
      });

      await db.accountsPayableEntry.update({
        where: { id: entry.id },
        data: { status: AccountsPayableStatus.RELEASED, paidAt: new Date(), stripeTransferId: transferId },
      });

      const ownerEmail = entry.profile?.owner?.email;
      if (ownerEmail) {
        await sendGenericEmail({
          to: ownerEmail,
          subject: `[iHYPE] Payout sent for "${entry.show.title}"`,
          html: `<p>$${(entry.amountCents / 100).toFixed(2)} was just transferred to your account for <strong>${entry.show.title}</strong>.</p>`,
          text: `$${(entry.amountCents / 100).toFixed(2)} was just transferred to your account for "${entry.show.title}".`,
        }).catch(() => {});
      }

      released++;
    } catch (error) {
      log.error('[show-payouts]', error instanceof Error ? error : { error: String(error) }, `transfer failed for entry ${entry.id}`);
      await sendGenericEmail({
        to: getAdminAlertRecipients(),
        subject: `[iHYPE] Payout transfer failed: ${entry.show.title}`,
        text: `Payout for "${entry.payeeLabel}" on show "${entry.show.title}" (entry ${entry.id}) failed: ${error instanceof Error ? error.message : String(error)}`,
        html: `<p>Payout for <strong>${entry.payeeLabel}</strong> on show <strong>${entry.show.title}</strong> (entry ${entry.id}) failed. Needs manual attention.</p>`,
      }).catch(() => {});
      skipped++;
    }
  }

  return { released, skipped };
}
