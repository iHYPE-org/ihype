import { env } from '@/lib/env';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MFA_ISSUER = 'iHYPE.org';
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getWebCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable.');
  }

  return globalThis.crypto;
}

function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string) {
  const sanitized = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of sanitized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) {
      throw new Error('Invalid MFA secret.');
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Uint8Array.from(bytes);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function counterToBytes(counter: number) {
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);

  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(value & 255n);
    value >>= 8n;
  }

  return bytes;
}

async function getEncryptionKey() {
  const webCrypto = getWebCrypto();
  const digest = await webCrypto.subtle.digest('SHA-256', textEncoder.encode(env.AUTH_SECRET));

  return webCrypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function getTotpAt(secret: string, counter: number) {
  const webCrypto = getWebCrypto();
  const key = await webCrypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(await webCrypto.subtle.sign('HMAC', key, counterToBytes(counter)));
  const offset = signature[signature.length - 1] & 0x0f;
  const code =
    (((signature[offset] & 0x7f) << 24) |
      ((signature[offset + 1] & 0xff) << 16) |
      ((signature[offset + 2] & 0xff) << 8) |
      (signature[offset + 3] & 0xff)) %
    10 ** TOTP_DIGITS;

  return code.toString().padStart(TOTP_DIGITS, '0');
}

export function generateMfaSecret() {
  const bytes = new Uint8Array(20);
  getWebCrypto().getRandomValues(bytes);
  return base32Encode(bytes);
}

export async function encryptMfaSecret(secret: string) {
  const webCrypto = getWebCrypto();
  const iv = new Uint8Array(12);
  webCrypto.getRandomValues(iv);

  const encrypted = new Uint8Array(
    await webCrypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getEncryptionKey(), textEncoder.encode(secret))
  );

  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(encrypted)}`;
}

export async function decryptMfaSecret(payload: string) {
  const [iv, encrypted] = payload.split('.');

  if (!iv || !encrypted) {
    throw new Error('Invalid MFA payload.');
  }

  const decrypted = await getWebCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(iv) },
    await getEncryptionKey(),
    base64UrlToBytes(encrypted)
  );

  return textDecoder.decode(decrypted);
}

export async function verifyTotpCode(code: string, secret: string, window = 1) {
  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    if (await getTotpAt(secret, currentCounter + offset) === normalizedCode) {
      return true;
    }
  }

  return false;
}

export function buildOtpAuthUri(email: string, secret: string) {
  const label = encodeURIComponent(`${MFA_ISSUER}:${email}`);
  const issuer = encodeURIComponent(MFA_ISSUER);

  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

export function getMfaSetupCopy(secret: string) {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 8; // chars, alphanumeric

export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 for readability
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const bytes = new Uint8Array(BACKUP_CODE_LENGTH);
    getWebCrypto().getRandomValues(bytes);
    codes.push(Array.from(bytes).map((b) => chars[b % chars.length]).join(''));
  }
  return codes;
}

export async function encryptBackupCodes(codes: string[]): Promise<string> {
  const webCrypto = getWebCrypto();
  const iv = new Uint8Array(12);
  webCrypto.getRandomValues(iv);
  const encrypted = new Uint8Array(
    await webCrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await getEncryptionKey(),
      textEncoder.encode(JSON.stringify(codes))
    )
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(encrypted)}`;
}

export async function decryptBackupCodes(payload: string): Promise<string[]> {
  const [iv, encrypted] = payload.split('.');
  if (!iv || !encrypted) return [];
  const decrypted = await getWebCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(iv) },
    await getEncryptionKey(),
    base64UrlToBytes(encrypted)
  );
  return JSON.parse(textDecoder.decode(decrypted));
}

export async function verifyAndConsumeBackupCode(
  inputCode: string,
  encryptedCodes: string
): Promise<{ valid: boolean; updatedEncryptedCodes: string | null }> {
  const normalized = inputCode.trim().toUpperCase();
  const codes = await decryptBackupCodes(encryptedCodes);
  const index = codes.indexOf(normalized);
  if (index === -1) return { valid: false, updatedEncryptedCodes: null };
  const remaining = codes.filter((_, i) => i !== index);
  const updatedEncryptedCodes = remaining.length > 0 ? await encryptBackupCodes(remaining) : null;
  return { valid: true, updatedEncryptedCodes };
}
