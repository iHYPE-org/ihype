import { sendMarketingEmail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';

export async function sendWeeklyDigestEmail(user: {
  id: string;
  email: string;
  name: string | null;
  hypeStreak: number;
  hyped: number;
  saved: number;
}) {
  const name = user.name ?? 'there';
  const streakLine = user.hypeStreak > 1
    ? `You're on a ${user.hypeStreak}-day hype streak 🔥 Keep it going!`
    : 'Jump back in and start a hype streak!';
  return sendMarketingEmail(user.id, {
    to: user.email,
    subject: `Your iHYPE week — ${user.hyped} hypes, ${user.saved} saves`,
    text: `Hey ${name}, here's your iHYPE week:\n\n• ${user.hyped} hypes\n• ${user.saved} saves\n\n${streakLine}\n\nOpen iHYPE: https://ihype.org/home`,
    html: `<p>Hey ${escapeHtml(name)}, here's your iHYPE week:</p><ul><li><strong>${user.hyped}</strong> hypes</li><li><strong>${user.saved}</strong> saves</li></ul><p>${streakLine}</p><p><a href="https://ihype.org/home">Open iHYPE →</a></p>`,
  });
}
