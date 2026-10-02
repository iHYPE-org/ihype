import { db } from '@/lib/db';
import { createMagicLinkToken } from '@/lib/magic-link-token';
import { sendGenericEmail } from '@/lib/mailer';
import { pendingDigest } from '@/lib/magic-link-pending';
import { getTForLocale } from '@/lib/i18n/server';
import { readUserLocale } from '@/lib/user-locale';

/**
 * Creates a magic-link token for a user and emails it — the same sign-in
 * mechanism used everywhere in this app (there is no password login flow;
 * see src/lib/auth.ts's header comment). Shared by /api/auth/magic-link
 * (existing-user sign-in) and /api/advertise/register (new advertiser
 * accounts, which skip the rest of /register's music-industry-specific
 * signup flow entirely).
 *
 * Returns the pending-marker digest of the token it sent (never the token), so
 * the requesting route can let THIS browser's confirm page submit THIS link
 * by itself (src/lib/magic-link-pending.ts).
 */
export async function sendMagicLinkEmail(userId: string, email: string): Promise<string> {
  const { token, tokenHash } = createMagicLinkToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.magicLinkToken.create({ data: { token: tokenHash, userId, expiresAt } });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    'https://ihype.org';
  const link = `${baseUrl.replace(/\/$/, '')}/api/auth/magic?token=${token}`;

  /* The first email that follows the member's language (2026-10-02): the one
     every member receives, written in the locale stored on their account.
     Nothing member-typed is interpolated — the dictionary's own sentences and
     the link this function minted. */
  const t = await getTForLocale(await readUserLocale(userId));
  const intro = t('email.magicLink.intro', 'Click the link below to sign in to iHYPE. It expires in 15 minutes.');
  const ignore = t('email.magicLink.ignore', 'If you did not request this, ignore this email.');

  try {
    await sendGenericEmail({
      to: email,
      subject: t('email.magicLink.subject', 'Your iHYPE sign-in link'),
      text: `${intro}\n\n${link}\n\n${ignore}`,
      html: `<p>${intro}</p><p><a href="${link}">${link}</a></p><p>${ignore}</p>`,
    });
  } catch (error) {
    // Do not leave a live bearer token behind when delivery failed.
    await db.magicLinkToken.delete({ where: { token: tokenHash } }).catch(() => {});
    throw error;
  }
  return pendingDigest(token);
}
