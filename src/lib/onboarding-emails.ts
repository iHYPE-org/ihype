import { db } from '@/lib/db';
import { sendMarketingEmail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';

async function getUserForEmail(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, name: true, emailBounced: true }
  });
}

function wrapText(text: string): string {
  // The text carries the member's own display name; a name written as markup
  // must render as text, not as markup.
  return `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`;
}

export async function sendDay1Email(userId: string): Promise<void> {
  const user = await getUserForEmail(userId);
  if (!user?.email || user.emailBounced) return;

  const name = user.name ?? user.username;
  const text = [
    `Hey ${name}, welcome to iHYPE!`,
    '',
    "You're now part of the hypest music community on the internet.",
    'Head over to iHYPE.org to explore artists, hype your favorites, and discover your next obsession.',
    '',
    'The iHYPE team'
  ].join('\n');
  await sendMarketingEmail(user.id, { to: user.email, subject: 'Welcome to iHYPE — start discovering music', text, html: wrapText(text) });
}

export async function sendDay3Email(userId: string): Promise<void> {
  const user = await getUserForEmail(userId);
  if (!user?.email || user.emailBounced) return;

  const name = user.name ?? user.username;
  const text = [
    `Hey ${name},`,
    '',
    "It looks like you haven't hyped an artist yet — and you're missing out!",
    'Hype an artist to show your support and help them get discovered.',
    '',
    'Visit iHYPE.org to get started.',
    '',
    'The iHYPE team'
  ].join('\n');
  await sendMarketingEmail(user.id, { to: user.email, subject: 'Your first hype is waiting', text, html: wrapText(text) });
}

export async function sendDay7Email(userId: string): Promise<void> {
  const user = await getUserForEmail(userId);
  if (!user?.email || user.emailBounced) return;

  const name = user.name ?? user.username;
  const text = [
    `Hey ${name},`,
    '',
    "A week in and you still haven't hype-d anyone. No worries — there's always time.",
    'Check out who\'s trending this week and find your first artist to support.',
    '',
    'iHYPE.org/trending',
    '',
    'The iHYPE team'
  ].join('\n');
  await sendMarketingEmail(user.id, { to: user.email, subject: 'The scene misses you — come back to iHYPE', text, html: wrapText(text) });
}
