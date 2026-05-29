import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { ADMIN_EMAIL } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [newSignups, revenueAgg, openSupport, openModFlags] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: yesterday } } }),
    db.ticketOrder.aggregate({
      where: { status: 'CAPTURED', updatedAt: { gte: yesterday } },
      _sum: { totalChargeCents: true },
    }),
    db.supportRequest.count({ where: { status: 'OPEN' } }),
    db.show.count({ where: { moderationStatus: 'FLAGGED' } }),
  ]);

  const revenue = revenueAgg._sum.totalChargeCents ?? 0;
  const revenueLabel = `$${(revenue / 100).toFixed(2)}`;

  const text = [
    `iHYPE Daily Ops Report — ${new Date().toDateString()}`,
    '',
    `New signups (24h): ${newSignups}`,
    `Revenue (24h): ${revenueLabel}`,
    `Open support requests: ${openSupport}`,
    `Flagged shows (needs review): ${openModFlags}`,
  ].join('\n');

  const html = `
    <h2>iHYPE Daily Ops Report</h2>
    <p><em>${new Date().toDateString()}</em></p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td style="padding:6px 16px 6px 0;color:#888">New signups (24h)</td><td style="padding:6px 0;font-weight:700">${newSignups}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888">Revenue (24h)</td><td style="padding:6px 0;font-weight:700">${revenueLabel}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888">Open support requests</td><td style="padding:6px 0;font-weight:700">${openSupport}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888">Flagged shows (mod queue)</td><td style="padding:6px 0;font-weight:700;color:${openModFlags > 0 ? '#e74c3c' : 'inherit'}">${openModFlags}</td></tr>
    </table>
  `;

  await sendGenericEmail({ to: ADMIN_EMAIL, subject: '[iHYPE] Daily ops report', text, html }).catch(() => {});

  return NextResponse.json({ ok: true, newSignups, revenue, openSupport, openModFlags });
}
