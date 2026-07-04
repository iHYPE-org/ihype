import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';
import { ADMIN_EMAIL } from '@/lib/env';
import type { AdSubmissionStatus, AdCampaignStatus } from '@/lib/ad-vetting';

export async function sendAdminWeeklyReport(): Promise<{ ok: boolean }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    newUsers, newProfiles, newShows,
    pendingAdSubmissions, pendingAdCampaigns,
    aiFlaggedRadioUploads,
    openFeatureRequests, bugReports,
  ] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.profile.count({ where: { createdAt: { gte: since } } }),
    db.show.count({ where: { createdAt: { gte: since } } }),
    // 'manual_review' is the actual status the AI vetting pipeline writes —
    // this previously queried 'PENDING', a status this pipeline never sets,
    // so the count was silently always 0.
    db.adSubmission.count({ where: { status: 'manual_review' satisfies AdSubmissionStatus } }),
    db.ad.count({ where: { status: 'PENDING' satisfies AdCampaignStatus } }),
    db.auditLog.count({ where: { action: 'media.free_use.auto_flagged', createdAt: { gte: since } } }),
    db.featureRequest.count({ where: { status: 'open' } }),
    db.auditLog.count({ where: { action: 'BUG_REPORT', createdAt: { gte: since } } })
  ]);

  const pendingAds = pendingAdSubmissions + pendingAdCampaigns;

  const html = `
<h2>iHYPE Weekly Admin Report</h2>
<p><strong>Period:</strong> Last 7 days</p>
<ul>
  <li>New users: <strong>${newUsers}</strong></li>
  <li>New profiles: <strong>${newProfiles}</strong></li>
  <li>New shows: <strong>${newShows}</strong></li>
  <li>Ads awaiting manual review: <strong>${pendingAds}</strong> (${pendingAdSubmissions} submissions, ${pendingAdCampaigns} self-serve campaigns)</li>
  <li>Radio uploads AI-flagged out of the free-use crate (7d): <strong>${aiFlaggedRadioUploads}</strong></li>
  <li>Open feature requests: <strong>${openFeatureRequests}</strong></li>
  <li>Bug reports this week: <strong>${bugReports}</strong></li>
</ul>
<p><a href="${getBaseUrl()}/admin">Open admin dashboard</a></p>`;

  const text = `iHYPE Weekly Report\n\nNew users: ${newUsers}\nNew profiles: ${newProfiles}\nNew shows: ${newShows}\nAds awaiting manual review: ${pendingAds} (${pendingAdSubmissions} submissions, ${pendingAdCampaigns} self-serve campaigns)\nRadio uploads AI-flagged out of the free-use crate (7d): ${aiFlaggedRadioUploads}\nOpen feature requests: ${openFeatureRequests}\nBug reports: ${bugReports}`;

  await sendGenericEmail({ to: ADMIN_EMAIL, subject: '[iHYPE] Weekly Admin Report', html, text });
  return { ok: true };
}
