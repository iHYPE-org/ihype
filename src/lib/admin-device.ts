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

/**
 * The device cookie carries its own signature.
 *
 * WHY: the console's device gate lives in `admin/layout.tsx`, and a layout's
 * `redirect()` cannot answer 307 once the page has begun streaming — so an
 * invalid device cookie still received **200 with the whole console in the
 * body** (measured: 115KB including real member addresses). Middleware can
 * stop the request before any of that renders, but only if it can judge the
 * cookie WITHOUT a database round-trip, which the Edge runtime cannot do here.
 *
 * So the cookie is `<token>.<hmac>`. Middleware verifies the HMAC statelessly
 * with Web Crypto; the database still stores only SHA-256 of the raw token, so
 * what is at rest is unchanged. The signature authenticates "this cookie was
 * issued by us", which is exactly enough to refuse a forged one before the
 * console renders. Whether that token is still REGISTERED remains the
 * database's question, asked in the layout as before.
 */
export function signDeviceCookieValue(token: string): string {
  const sig = crypto.createHmac('sha256', secret()).update(token).digest('base64url');
  return `${token}.${sig}`;
}

/**
 * Pulls the raw token out of a cookie value, accepting the unsigned form.
 *
 * Lenient on purpose: this runs server-side where the database is the real
 * authority, and a device registered before the cookie was signed must still
 * resolve to its token so the operator is not locked out by a format change
 * alone. Middleware is where the signature is REQUIRED.
 */
export function extractDeviceToken(cookieValue: string): string {
  const dot = cookieValue.indexOf('.');
  return dot === -1 ? cookieValue : cookieValue.slice(0, dot);
}
