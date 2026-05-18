import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

export async function triggerShowPayouts(): Promise<{ processed: number }> {
  // Find ended shows with unsettled tickets sold
  const completedShows = await db.show.findMany({
    where: {
      status: 'ENDED',
      ticketsSoldCount: { gt: 0 },
    },
    select: {
      id: true, title: true, ticketPriceCents: true, ticketsSoldCount: true,
      promoterPayoutPercent: true, artistPayoutPercent: true,
      headlinerProfile: { select: { name: true, stripeConnectAccountId: true, owner: { select: { email: true } } } },
    },
    take: 20
  });

  const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? 'admin@ihype.org';
  let processed = 0;

  for (const show of completedShows) {
    // Check if already processed
    const existing = await db.auditLog.findFirst({ where: { action: 'PAYOUT_TRIGGERED', entityId: show.id } });
    if (existing) continue;

    const grossRevenue = show.ticketPriceCents * show.ticketsSoldCount;
    const platformFee = Math.round(grossRevenue * 0.05);
    const artistShare = Math.round(grossRevenue * ((show.artistPayoutPercent ?? 85) / 100));

    await db.auditLog.create({ data: { actorUserId: null, action: 'PAYOUT_TRIGGERED', entityType: 'Show', entityId: show.id, metadata: { grossRevenue, artistShare, platformFee } } });

    const ownerEmail = show.headlinerProfile?.owner?.email;
    if (ownerEmail) {
      await sendGenericEmail({
        to: ownerEmail,
        subject: `[iHYPE] Payout for "${show.title}"`,
        html: `<p>Your show <strong>${show.title}</strong> has completed.</p><p>Estimated payout: <strong>$${(artistShare / 100).toFixed(2)}</strong></p><p>Payouts are processed within 5 business days via Stripe Connect.</p>`,
        text: `Show "${show.title}" completed. Estimated payout: $${(artistShare / 100).toFixed(2)}.`
      }).catch(() => {});
    }

    if (!show.headlinerProfile?.stripeConnectAccountId) {
      await sendGenericEmail({ to: ADMIN_EMAIL, subject: `[iHYPE] Manual payout needed: ${show.title}`, text: `Show "${show.title}" completed but artist has no Stripe Connect account. Manual payout required. Gross: $${(grossRevenue / 100).toFixed(2)}`, html: `<p>Manual payout needed for <strong>${show.title}</strong>. No Stripe Connect account. Gross: <strong>$${(grossRevenue / 100).toFixed(2)}</strong></p>` }).catch(() => {});
    }

    processed++;
  }

  return { processed };
}
