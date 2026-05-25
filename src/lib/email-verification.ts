import { db } from '@/lib/db';
import { isEmailDeliveryConfigured, sendGenericEmail } from '@/lib/mailer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
// Prefix stored in the `email` column to distinguish verification records
// from password-reset records. The PasswordResetCode model requires an email
// field — we store the real email prefixed with 'verify:' so queries can
// filter by this sentinel without a dedicated table or migration.
const VERIFY_EMAIL_PREFIX = 'verify:';

export async function createEmailVerificationCode(
  userId: string,
  email: string
): Promise<string> {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + EXPIRY_MS);
  const codeHash = await bcrypt.hash(code, 8);

  // Remove any existing pending verification codes for this user.
  await db.passwordResetCode.deleteMany({
    where: { userId, email: `${VERIFY_EMAIL_PREFIX}${email}` }
  });

  await db.passwordResetCode.create({
    data: {
      userId,
      email: `${VERIFY_EMAIL_PREFIX}${email}`,
      codeHash,
      expiresAt
    }
  });

  return code;
}

export async function verifyEmailCode(
  userId: string,
  email: string,
  code: string
): Promise<boolean> {
  const records = await db.passwordResetCode.findMany({
    where: {
      userId,
      email: `${VERIFY_EMAIL_PREFIX}${email}`,
      expiresAt: { gt: new Date() },
      consumedAt: null
    }
  });

  for (const record of records) {
    const match = await bcrypt.compare(code, record.codeHash);
    if (match) {
      await db.passwordResetCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() }
      });
      return true;
    }
  }

  return false;
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<void> {
  if (!isEmailDeliveryConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[email-verify] ${email} -> ${code}`);
    }
    return;
  }

  await sendGenericEmail({
    to: email,
    subject: 'Verify your iHYPE.org email',
    text: `Your iHYPE.org verification code is: ${code}\n\nThis code expires in 24 hours.`,
    html: `<p>Your iHYPE.org verification code is: <strong>${code}</strong></p><p>This code expires in 24 hours.</p>`
  });
}
