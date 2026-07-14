import { AccountsPayableCategory, AccountsPayableStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { ADMIN_EMAIL } from '@/lib/env';
import { createPayoutTransfer, isStripeConfigured } from '@/lib/stripe';

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
 * (the actual 45/45/10-split rows computed at order-capture time, see
 * src/lib/ticket-order-state.ts) for shows that have ended, via a real
 * per-entry Stripe transfer. Replaces a previous version that only ever
 * computed a rough gross-revenue estimate and emailed a promise — no money
 * ever actually moved for the venue/promoter shares, and the artist share
 * used different (wrong) percentages than what was actually captured.
 */
export async function triggerShowPayouts(): Promise<{ released: number; skipped: number }> {
  if (!isStripeConfigured()) return { released: 0, skipped: 0 };

  const entries = await db.accountsPayableEntry.findMany({
    where: {
      status: AccountsPayableStatus.PENDING,
      category: { in: CONNECT_PAYOUT_CATEGORIES },
      profileId: { not: null },
      show: { status: 'ENDED' },
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
      const transferId = await createPayoutTransfer({
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
      console.error('[show-payouts] transfer failed', entry.id, error);
      await sendGenericEmail({
        to: ADMIN_EMAIL,
        subject: `[iHYPE] Payout transfer failed: ${entry.show.title}`,
        text: `Payout for "${entry.payeeLabel}" on show "${entry.show.title}" (entry ${entry.id}) failed: ${error instanceof Error ? error.message : String(error)}`,
        html: `<p>Payout for <strong>${entry.payeeLabel}</strong> on show <strong>${entry.show.title}</strong> (entry ${entry.id}) failed. Needs manual attention.</p>`,
      }).catch(() => {});
      skipped++;
    }
  }

  return { released, skipped };
}
