import crypto from 'crypto';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { ADMIN_DEVICE_COOKIE } from '@/lib/auth-redirects';

const OTP_EXPIRY_SEC = 20 * 60;

function secret(): string {
  const s = readRuntimeEnv('ADMIN_DEVICE_SECRET');
  if (!s) throw new Error('ADMIN_DEVICE_SECRET is not set');
  return s;
}

export function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashDeviceToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getDeviceCookieName(): string {
  return ADMIN_DEVICE_COOKIE;
}

type OtpPurpose = 'admin-device-setup' | 'admin-device-change';

export function createDeviceOtp(purpose: OtpPurpose): string {
  const payload = {
    purpose,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + OTP_EXPIRY_SEC,
  };
  const h = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${sig}`;
}

export function verifyDeviceOtp(token: string, expectedPurpose: OtpPurpose): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [h, b, sig] = parts;
    const expected = crypto.createHmac('sha256', secret()).update(`${h}.${b}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expected, 'base64url'))) return false;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString()) as { purpose: string; exp: number };
    if (payload.purpose !== expectedPurpose) return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

// Monday 08:00–08:59 America/New_York (covers both EST UTC-5 and EDT UTC-4)
export function isDeviceChangeWindow(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '-1', 10);
  return weekday === 'Monday' && hour === 8;
}
