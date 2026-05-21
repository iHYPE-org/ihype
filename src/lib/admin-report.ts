import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

export async function sendAdminWeeklyReport(): Promise<{ ok: boolean }> {
  const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? 'admin@ihype.org';
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [newUsers, newProfiles, newShows, pendingAds, openFeatureRequests, bugReports] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.profile.count({ where: { createdAt: { gte: since } } }),
    db.show.count({ where: { createdAt: { gte: since } } }),
    db.adSubmission.count({ where: { status: 'PENDING' } }),
    db.featureRequest.count({ where: { status: 'open' } }),
    db.auditLog.count({ where: { action: 'BUG_REPORT', createdAt: { gte: since } } })
  ]);

  const html = `
<h2>iHYPE Weekly Admin Report</h2>
<p><strong>Period:</strong> Last 7 days</p>
<ul>
  <li>New users: <strong>${newUsers}</strong></li>
  <li>New profiles: <strong>${newProfiles}</strong></li>
  <li>New shows: <strong>${newShows}</strong></li>
  <li>Pending ads (awaiting review): <strong>${pendingAds}</strong></li>
  <li>Open feature requests: <strong>${openFeatureRequests}</strong></li>
  <li>Bug reports this week: <strong>${bugReports}</strong></li>
</ul>
<p><a href="${getBaseUrl()}/admin">Open admin dashboard</a></p>`;

  const text = `iHYPE Weekly Report\n\nNew users: ${newUsers}\nNew profiles: ${newProfiles}\nNew shows: ${newShows}\nPending ads: ${pendingAds}\nOpen feature requests: ${openFeatureRequests}\nBug reports: ${bugReports}`;

  await sendGenericEmail({ to: ADMIN_EMAIL, subject: '[iHYPE] Weekly Admin Report', html, text });
  return { ok: true };
}
