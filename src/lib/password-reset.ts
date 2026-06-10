import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';

export const PASSWORD_RESET_CODE_TTL_MINUTES = 5;
export const PASSWORD_RESET_CODE_TTL_MS = PASSWORD_RESET_CODE_TTL_MINUTES * 60 * 1000;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

export function createPasswordResetCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// bcrypt (like the OTP and email-verification flows) so codes can't be
// verified offline if a server secret ever leaks.
export async function hashPasswordResetCode(code: string) {
  return bcrypt.hash(code, 10);
}

export async function verifyPasswordResetCode(code: string, codeHash: string) {
  return bcrypt.compare(code, codeHash);
}

export function createPasswordResetExpiry() {
  return new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS);
}

export function isPasswordResetExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}
