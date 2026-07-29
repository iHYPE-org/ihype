import { kvGet } from '@/lib/kv';
import { log } from '@/lib/logger';

function parseBooleanFlag(value: unknown, defaultValue: boolean) {
  if (value == null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return defaultValue;
  }
  if (typeof value !== 'string') return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

type RuntimeFlagKey =
  | 'demo_logins'
  | 'invite_only_signup'
  | 'hide_demo_content'
  | 'blob_media_storage'
  | 'ticket_payment_capture';

async function readRuntimeOverride(key: RuntimeFlagKey) {
  try {
    const value = await kvGet<unknown>(`flags:${key}`);
    if (value == null) return null;
    return parseBooleanFlag(value, false);
  } catch (error) {
    log.error('[runtime-flags]', error instanceof Error ? error : { error: String(error) }, 'flag read failed');
    return null;
  }
}

export async function getRuntimeFlag(key: RuntimeFlagKey, fallback: boolean) {
  const override = await readRuntimeOverride(key);
  return override ?? fallback;
}

const demoIdentifiers = new Set([
  'fan',
  'fan@ihype.org',
  'artist',
  'artist@ihype.org',
  'promoter',
  'promoter@ihype.org',
  'venue',
  'venue@ihype.org',
]);

const knownWeakInviteCodes = new Set(['ihype', 'hype2026', 'beta', 'listen']);

function isStrongInviteCode(code: string) {
  return code.length >= 16 && !knownWeakInviteCodes.has(code.toLowerCase());
}

function getConfiguredInviteCodes() {
  const codes = process.env.BETA_INVITE_CODES?.split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean) ?? [];

  if (process.env.NODE_ENV !== 'production') return codes;

  const strongCodes = codes.filter(isStrongInviteCode);
  if (strongCodes.length !== codes.length) {
    log.error(
      '[invite-codes]',
      { rejected: codes.length - strongCodes.length },
      'ignoring weak production invite codes; use at least 16 random characters per code',
    );
  }
  return strongCodes;
}

export const demoUserEmails = [
  'fan@ihype.org',
  'artist@ihype.org',
  'promoter@ihype.org',
  'venue@ihype.org',
];

function areDemoLoginsEnabled() {
  return parseBooleanFlag(
    process.env.FEATURE_ENABLE_DEMO_LOGINS,
    process.env.NODE_ENV !== 'production',
  );
}

export async function areDemoLoginsEnabledRuntime() {
  return getRuntimeFlag('demo_logins', areDemoLoginsEnabled());
}

function isDemoIdentifier(identifier: string | null | undefined) {
  if (!identifier) return false;
  return demoIdentifiers.has(identifier.trim().toLowerCase());
}

export function isDemoUser(user: { email?: string | null; username?: string | null }) {
  return isDemoIdentifier(user.email) || isDemoIdentifier(user.username);
}

export function shouldHideDemoContent() {
  return process.env.NODE_ENV === 'production' && !areDemoLoginsEnabled();
}

export async function shouldHideDemoContentRuntime() {
  return getRuntimeFlag(
    'hide_demo_content',
    process.env.NODE_ENV === 'production' && !(await areDemoLoginsEnabledRuntime()),
  );
}

export function getDemoOwnerExclusion() {
  return shouldHideDemoContent() ? { owner: { email: { notIn: demoUserEmails } } } : {};
}

export function getDemoCreatorExclusion() {
  return shouldHideDemoContent() ? { creator: { email: { notIn: demoUserEmails } } } : {};
}

export function getDemoProfileRelationExclusion() {
  return shouldHideDemoContent()
    ? { profile: { owner: { email: { notIn: demoUserEmails } } } }
    : {};
}

export function getDemoShowRelationExclusion() {
  return shouldHideDemoContent()
    ? { show: { creator: { email: { notIn: demoUserEmails } } } }
    : {};
}

export function isReservedPlatformEmail(email: string | null | undefined) {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith('@ihype.org');
}

export function isProductionSeedingAllowed() {
  return parseBooleanFlag(process.env.ALLOW_PRODUCTION_SEEDING, false);
}

function areDatabaseMediaUploadsEnabled() {
  return parseBooleanFlag(
    process.env.FEATURE_ALLOW_DATABASE_MEDIA_STORAGE,
    process.env.NODE_ENV !== 'production',
  );
}

export async function areDatabaseMediaUploadsEnabledRuntime() {
  return getRuntimeFlag('blob_media_storage', areDatabaseMediaUploadsEnabled());
}

function isInviteCodeRequired() {
  return parseBooleanFlag(process.env.FEATURE_REQUIRE_INVITE_CODE, true);
}

export async function isInviteCodeRequiredRuntime() {
  return getRuntimeFlag('invite_only_signup', isInviteCodeRequired());
}

export function isValidInviteCode(
  value: string | null | undefined,
  requiredOverride?: boolean,
) {
  const configuredCodes = getConfiguredInviteCodes();
  if (!configuredCodes.length) return !(requiredOverride ?? isInviteCodeRequired());
  return configuredCodes.includes(value?.trim().toLowerCase() ?? '');
}
