import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { ADMIN_EMAIL } from '@/lib/env';
import { checkPaymentFailures } from '@/lib/anomaly-detect';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const alerts: string[] = [];

  const [paymentFailures, totalPayments, spamFlags, bugReports] = await Promise.all([
    db.ticketOrder.count({
      where: {
        status: 'VOID',
        updatedAt: { gte: oneHourAgo },
        stripePaymentIntentId: { not: null },
      },
    }),
    db.ticketOrder.count({
      where: { updatedAt: { gte: oneHourAgo }, stripePaymentIntentId: { not: null } },
    }),
    db.notification.count({
      where: { type: 'SPAM_FLAG', createdAt: { gte: oneHourAgo } },
    }),
    db.supportRequest.count({
      where: { type: 'BUG_REPORT', createdAt: { gte: oneHourAgo } },
    }),
  ]);

  if (checkPaymentFailures(paymentFailures, totalPayments)) {
    alerts.push(`High payment failure rate: ${paymentFailures}/${totalPayments} (${((paymentFailures / totalPayments) * 100).toFixed(1)}%) in last hour`);
  }

  if (spamFlags > 10) {
    alerts.push(`High spam flags: ${spamFlags} in last hour`);
  }

  if (bugReports > 10) {
    alerts.push(`High bug reports: ${bugReports} in last hour`);
  }

  if (alerts.length > 0) {
    const text = `iHYPE Anomaly Alert\n\n${alerts.join('\n')}`;
    const html = `<h2>iHYPE Anomaly Alert</h2><ul>${alerts.map((a) => `<li>${a}</li>`).join('')}</ul>`;
    await sendGenericEmail({
      to: ADMIN_EMAIL,
      subject: '[iHYPE] ALERT: Anomaly detected',
      text,
      html,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, alerts });
}
