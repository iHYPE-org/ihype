import { db } from '@/lib/db';
import { createMagicLinkToken } from '@/lib/magic-link-token';
import { sendGenericEmail } from '@/lib/mailer';

/**
 * Creates a magic-link token for a user and emails it — the same sign-in
 * mechanism used everywhere in this app (there is no password login flow;
 * see src/lib/auth.ts's header comment). Shared by /api/auth/magic-link
 * (existing-user sign-in) and /api/advertise/register (new advertiser
 * accounts, which skip the rest of /register's music-industry-specific
 * signup flow entirely).
 */
export async function sendMagicLinkEmail(userId: string, email: string) {
  const { token, tokenHash } = createMagicLinkToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.magicLinkToken.create({ data: { token: tokenHash, userId, expiresAt } });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    'https://ihype.org';
  const link = `${baseUrl.replace(/\/$/, '')}/api/auth/magic?token=${token}`;

  try {
    await sendGenericEmail({
      to: email,
      subject: 'Your iHYPE sign-in link',
      text: `Click this link to sign in to iHYPE (expires in 15 minutes):\n\n${link}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Click the link below to sign in to iHYPE. It expires in 15 minutes.</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`,
    });
  } catch (error) {
    // Do not leave a live bearer token behind when delivery failed.
    await db.magicLinkToken.delete({ where: { token: tokenHash } }).catch(() => {});
    throw error;
  }
}
