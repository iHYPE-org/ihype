import { AccountsPayableCategory, AccountsPayableStatus } from '@prisma/client/edge';
import { CONNECT_PAYOUT_CATEGORIES, PAYOUT_HOLD_DAYS } from '@/lib/payout-release';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { getAdminAlertRecipients } from '@/lib/env';
import { createPayoutTransfer, findPayoutTransfer, isStripeConfigured } from '@/lib/stripe';
import { log } from '@/lib/logger';
import { escapeHtml } from '@/lib/html-escape';

/* The five release conditions live in payout-release.ts, because the member
   surfaces that promise a member when their money arrives read the same ones.
   Two copies of "when does a payable pay" is how "released automatically once
   the show ends" came to be printed over a tax entry nothing ever releases. */
export { PAYOUT_HOLD_DAYS };

/**
 * Real payout release — pays out every still-PENDING AccountsPayableEntry
 * (the actual 70/20/10-split rows computed at order-capture time, see
 * src/lib/ticket-order-state.ts) for shows that have ended, via a real
 * per-entry Stripe transfer. Replaces a previous version that only ever
 * computed a rough gross-revenue estimate and emailed a promise — no money
 * ever actually moved for the venue/promoter shares, and the artist share
 * used different (wrong) percentages than what was actually captured.
 */

export async function triggerShowPayouts(): Promise<{ released: number; skipped: number }> {
  if (!isStripeConfigured()) return { released: 0, skipped: 0 };

  const releasableAfter = new Date(Date.now() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);

  const entries = await db.accountsPayableEntry.findMany({
    where: {
      status: AccountsPayableStatus.PENDING,
      category: { in: [...CONNECT_PAYOUT_CATEGORIES] as AccountsPayableCategory[] },
      profileId: { not: null },
      /* ENDED *and* ten days past the date. Both conditions, because they
         answer different questions: the status says the show happened, the
         clock says the dispute window has mostly closed. Filtering on the
         status alone is what left no recovery window at all. */
      show: { status: 'ENDED', startsAt: { lte: releasableAfter } },
    },
    include: {
      profile: { select: { stripeConnectAccountId: true, stripeConnectOnboarded: true, owner: { select: { email: true } } } },
      show: { select: { title: true } },
    },
    /* OLDEST FIRST, because `take` without `orderBy` is not a queue.
       Postgres may return any 200 of the matching rows and need not return
       the same 200 twice, so past the cap an entry could be passed over run
       after run while every run reported success — the money is owed, the
       row is due, and nothing is stuck enough for anything to notice.
       Ordered, the cap is a batch size: the oldest debts clear first and the
       tail drains over successive runs. */
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  let released = 0;
  let skipped = 0;
  /* WHO was skipped, so the log names them. See the block after the loop. */
  const noDestination: {
    entryId: string;
    profileId: string | null;
    payeeLabel: string;
    amountCents: number;
    /** 'none' = never started Connect. 'unfinished' = has an account, onboarding not complete. */
    reason: 'none' | 'unfinished';
  }[] = [];

  for (const entry of entries) {
    const connectAccountId = entry.profile?.stripeConnectAccountId;
    /* AN ACCOUNT ID IS NOT A PAYOUT DESTINATION, and the gap between them is
       the ordinary state of every member mid-signup. `connect/onboard` writes
       `stripeConnectAccountId` the moment Stripe creates the account — BEFORE
       the member has seen one screen of the hosted flow — so an id exists for
       everyone who has ever pressed the button and wandered off. Paying on
       the id alone sent a real transfer to an account with no active
       `stripe_transfers` capability: Stripe refuses, the catch below emails
       the administrators, and it repeats every day, for ever, about somebody
       doing nothing wrong.

       The connect-health cron says exactly this about its OWN alert — that
       "started onboarding and has not finished is the ordinary condition of
       every member mid-signup", and that including it "is how an alert
       becomes something nobody reads" — and then this file paid on the looser
       test. Two files, one state, opposite conclusions.

       `stripeConnectOnboarded` is the flag that means a transfer can land:
       `connect/return` sets it from the real capability check, the
       connect-health cron promotes a stale one every six hours, and the
       webhook backstops it — so a flag that is false while the account is
       genuinely ready converges within hours rather than stranding anyone.
       `describePayableRelease` reads the same thing, so what the member is
       told and what this run pays cannot disagree.

       THE GATE IS HERE AND NOT IN THE `where`, deliberately. Filtering these
       entries out of the query would make them invisible again — which is the
       whole of what the block after this loop was written to fix. They have
       to be SELECTED to be REPORTED. */
    if (!connectAccountId || !entry.profile?.stripeConnectOnboarded) {
      skipped++;
      noDestination.push({
        entryId: entry.id,
        profileId: entry.profileId,
        payeeLabel: entry.payeeLabel,
        amountCents: entry.amountCents,
        reason: connectAccountId ? 'unfinished' : 'none',
      });
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
          html: `<p>$${(entry.amountCents / 100).toFixed(2)} was just transferred to your account for <strong>${escapeHtml(entry.show.title)}</strong>.</p>`,
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
        html: `<p>Payout for <strong>${escapeHtml(entry.payeeLabel)}</strong> on show <strong>${escapeHtml(entry.show.title)}</strong> (entry ${entry.id}) failed. Needs manual attention.</p>`,
      }).catch(() => {});
      skipped++;
    }
  }

  /* A SKIPPED PAYABLE WAS SILENT — NO LOG, NO SENTRY, NO EMAIL — AND THE
   * COUNT WENT INTO AN HTTP RESPONSE NOBODY READS (2026-09-15).
   *
   * `triggerShowPayouts()` returns `{ released, skipped }` to the cron route,
   * which puts it in a JSON body that the scheduled invocation discards. So an
   * entry owed to a profile with no Connect account was passed over on every
   * run, for ever, and nothing anywhere said so — while the transfer-failure
   * branch twenty lines above logs AND emails. That asymmetry is the bug: a
   * failed transfer is loud and a payee who can never be paid is silent, and
   * the second is the one that persists.
   *
   * It is not hypothetical on this product: with no artist or venue having
   * finished Connect onboarding, this branch takes EVERY payable, every day.
   *
   * `log.error` because that is the only thing that reaches Sentry (see
   * `src/lib/logger.ts`) — `console.error` lands in Worker logs nobody tails.
   * One line per RUN rather than per entry: a hundred payables owed to three
   * profiles is three problems, and a hundred-line log is one nobody reads.
   * No email: the operator's surface for this is the workbench queue, and a
   * daily mail saying the same thing is what `workbench-digest.ts` exists to
   * avoid. */
  if (noDestination.length > 0) {
    /* THE TWO REASONS ARE DIFFERENT PROBLEMS AND TAKE DIFFERENT ACTION, so
       the line names both rather than blending them. A payee who never
       started Connect needs to be asked to; a payee who started and did not
       finish needs the shorter nudge, and will clear themselves the moment
       they do — the connect-health cron promotes the flag within six hours of
       the capability going active. One line collapsing them says "these
       people cannot be paid" about a group that is half nearly-there. */
    const owedCents = noDestination.reduce((sum, e) => sum + e.amountCents, 0);
    const describe = (reason: 'none' | 'unfinished') => {
      const payees = [...new Set(noDestination.filter((e) => e.reason === reason).map((e) => e.profileId ?? e.payeeLabel))];
      return payees.length === 0 ? null : `${payees.length} ${reason === 'none' ? 'with no Connect account' : 'still onboarding'} (${payees.slice(0, 10).join(', ')})`;
    };
    const parts = [describe('none'), describe('unfinished')].filter(Boolean);
    log.error(
      '[show-payouts]',
      null,
      `${noDestination.length} payable(s) worth ${owedCents}c could not be paid — ${parts.join('; ')}`,
    );
  }

  return { released, skipped };
}
