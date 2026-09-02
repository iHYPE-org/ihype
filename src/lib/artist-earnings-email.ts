import { sendMarketingEmail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';

export async function sendArtistEarningsSummaryEmail(user: {
  id: string;
  email: string;
  name: string | null;
  pendingCents: number;
  trackCount: number;
  hypeCount7d: number;
}) {
  const name = user.name ?? 'there';
  const earnings = (user.pendingCents / 100).toFixed(2);
  return sendMarketingEmail(user.id, {
    to: user.email,
    subject: `Your iHYPE earnings this month — $${earnings}`,
    text: `Hey ${name}, here's your iHYPE artist summary:\n\n• $${earnings} in pending earnings\n• ${user.trackCount} tracks live\n• ${user.hypeCount7d} hypes this week\n\nLog in to see your full dashboard: https://ihype.org/home`,
    html: `<p>Hey ${escapeHtml(name)}, here's your iHYPE artist summary:</p><ul><li><strong>$${earnings}</strong> in pending earnings</li><li><strong>${user.trackCount}</strong> tracks live</li><li><strong>${user.hypeCount7d}</strong> hypes this week</li></ul><p><a href="https://ihype.org/home">View your dashboard →</a></p>`,
  });
}
