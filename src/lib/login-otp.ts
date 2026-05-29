import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { sendLoginOtpEmail } from '@/lib/mailer';

function generateOtp() {
  const bytes = randomBytes(4);
  return String(bytes.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

function waitForInvalidCredential() {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

export async function createLoginOtpChallenge({
  identifier,
  password
}: {
  identifier: string;
  password: string;
}) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  const user = await db.user.findFirst({
    where: { OR: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }, { phone: normalizedIdentifier }] }
  });

  if (!user) {
    await waitForInvalidCredential();
    return null;
  }

  // Users who registered via passkey/OAuth have no password hash.
  // For them, the OTP itself is sufficient proof (their email is already verified).
  // For password-having accounts, require the password before sending OTP.
  if (user.passwordHash) {
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await waitForInvalidCredential();
      return null;
    }
  } else if (!user.emailVerified) {
    // No password AND no email verification — block to prevent account enumeration
    await waitForInvalidCredential();
    return null;
  }

  await db.mfaChallenge.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date() } }
  });

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 8);
  const challengeToken = randomBytes(32).toString('hex');

  await db.mfaChallenge.create({
    data: {
      token: challengeToken,
      userId: user.id,
      secretCiphertext: otpHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  if (!user.email) {
    await waitForInvalidCredential();
    return null;
  }

  await sendLoginOtpEmail({ email: user.email, name: user.name, otp });

  return {
    challengeId: challengeToken,
    email: user.email
  };
}
