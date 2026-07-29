import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';
import { getAdminAlertRecipients } from '@/lib/env';
import type { AdCampaignStatus } from '@/lib/ad-vetting';

export async function sendAdminWeeklyReport(): Promise<{ ok: boolean }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    newUsers, newProfiles, newShows,
    pendingAdCampaigns,
    aiFlaggedRadioUploads,
    openFeatureRequests, bugReports,
  ] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.profile.count({ where: { createdAt: { gte: since } } }),
    db.show.count({ where: { createdAt: { gte: since } } }),
    db.ad.count({ where: { status: 'PENDING' satisfies AdCampaignStatus } }),
    db.auditLog.count({ where: { action: 'media.free_use.auto_flagged', createdAt: { gte: since } } }),
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
  <li>Radio ad campaigns awaiting manual review: <strong>${pendingAdCampaigns}</strong></li>
  <li>Radio uploads AI-flagged out of the free-use crate (7d): <strong>${aiFlaggedRadioUploads}</strong></li>
  <li>Open feature requests: <strong>${openFeatureRequests}</strong></li>
  <li>Bug reports this week: <strong>${bugReports}</strong></li>
</ul>
<p><a href="${getBaseUrl()}/admin">Open admin dashboard</a></p>`;

  const text = `iHYPE Weekly Report\n\nNew users: ${newUsers}\nNew profiles: ${newProfiles}\nNew shows: ${newShows}\nRadio ad campaigns awaiting manual review: ${pendingAdCampaigns}\nRadio uploads AI-flagged out of the free-use crate (7d): ${aiFlaggedRadioUploads}\nOpen feature requests: ${openFeatureRequests}\nBug reports: ${bugReports}`;

  await sendGenericEmail({ to: getAdminAlertRecipients(), subject: '[iHYPE] Weekly Admin Report', html, text });
  return { ok: true };
}
