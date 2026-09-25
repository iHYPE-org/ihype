import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendOperationalEmail } from '@/lib/mailer';
import { getAdminAlertRecipients } from '@/lib/env';
import { centsOrDash, getUnpayableBalance } from '@/lib/unpayable-balance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  /* REVENUE IN, AND WHETHER ANY OF IT CAN GO OUT. This report named the
     money arriving and stopped, on a product whose charter promise is that
     the artist's share of it reaches the act — so the one figure an operator most needs
     beside revenue was absent, and at an alpha where no venue has finished
     Connect onboarding the honest answer has been "none of it, for everyone"
     the whole time. Reported, never a gate; see `unpayable-balance.ts`. */
  const [newSignups, revenueAgg, openSupport, openModFlags, owed] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: yesterday } } }),
    db.ticketOrder.aggregate({
      where: { status: 'CAPTURED', updatedAt: { gte: yesterday } },
      _sum: { totalChargeCents: true },
    }),
    db.supportRequest.count({ where: { status: 'OPEN' } }),
    db.show.count({ where: { moderationStatus: 'FLAGGED' } }),
    getUnpayableBalance(),
  ]);

  const revenue = revenueAgg._sum.totalChargeCents ?? 0;
  const revenueLabel = `$${(revenue / 100).toFixed(2)}`;
  /* A dash, never $0.00: "nothing is stuck" is the most reassuring thing this
     mail can say and the one it must never say from a failed read. */
  const unpayableLabel = centsOrDash(owed.unpayableCents);
  const payeeCount = owed.unpayablePayees === null ? '—' : String(owed.unpayablePayees);
  const taxLabel = centsOrDash(owed.manualRemittanceCents);
  const unpayableIsBad = (owed.unpayableCents ?? 0) > 0;

  const text = [
    `iHYPE Daily Ops Report — ${new Date().toDateString()}`,
    '',
    `New signups (24h): ${newSignups}`,
    `Revenue (24h): ${revenueLabel}`,
    `Owed but unpayable: ${unpayableLabel} across ${payeeCount} payee(s) with no finished payout account`,
    `Owed as tax, remitted by hand: ${taxLabel}`,
    `Open support requests: ${openSupport}`,
    `Flagged shows (needs review): ${openModFlags}`,
  ].join('\n');

  const html = `
    <h2>iHYPE Daily Ops Report</h2>
    <p><em>${new Date().toDateString()}</em></p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td style="padding:6px 16px 6px 0;color:#888">New signups (24h)</td><td style="padding:6px 0;font-weight:700">${newSignups}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888">Revenue (24h)</td><td style="padding:6px 0;font-weight:700">${revenueLabel}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888">Owed but unpayable</td><td style="padding:6px 0;font-weight:700;color:${unpayableIsBad ? '#e74c3c' : 'inherit'}">${unpayableLabel} &middot; ${payeeCount} payee(s) with no finished payout account</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888">Owed as tax (by hand)</td><td style="padding:6px 0;font-weight:700">${taxLabel}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888">Open support requests</td><td style="padding:6px 0;font-weight:700">${openSupport}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888">Flagged shows (mod queue)</td><td style="padding:6px 0;font-weight:700;color:${openModFlags > 0 ? '#e74c3c' : 'inherit'}">${openModFlags}</td></tr>
    </table>
  `;

  const emailed = await sendOperationalEmail({ to: getAdminAlertRecipients(), subject: '[iHYPE] Daily ops report', text, html }, 'daily-ops');

  // `emailed` is part of the response on purpose: the job previously
  // returned ok:true whether or not the report actually left the building,
  // so a cron dashboard showing 200s proved nothing about delivery.
  return NextResponse.json({ ok: true, emailed, newSignups, revenue, openSupport, openModFlags, owed });
}
