function parseBooleanFlag(value: string | undefined, defaultValue: boolean) {
  if (value == null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

import { kvGet } from '@/lib/kv';

type RuntimeFlagKey =
  | 'demo_logins'
  | 'invite_only_signup'
  | 'hide_demo_content'
  | 'blob_media_storage'
  | 'ticket_payment_capture';

async function readRuntimeOverride(key: RuntimeFlagKey): Promise<boolean | null> {
  try {
    const value = await kvGet<string>(`flags:${key}`);
    if (value == null) return null;
    return parseBooleanFlag(value, false);
  } catch (error) {
    console.error('Runtime flag read failed', error);
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
  'venue@ihype.org'
]);

export const demoUserEmails = [
  'fan@ihype.org',
  'artist@ihype.org',
  'promoter@ihype.org',
  'venue@ihype.org'
];

export function areDemoLoginsEnabled() {
  return parseBooleanFlag(
    process.env.FEATURE_ENABLE_DEMO_LOGINS,
    process.env.NODE_ENV !== 'production'
  );
}

export async function areDemoLoginsEnabledRuntime() {
  return getRuntimeFlag('demo_logins', areDemoLoginsEnabled());
}

export function isDemoIdentifier(identifier: string | null | undefined) {
  if (!identifier) {
    return false;
  }

  return demoIdentifiers.has(identifier.trim().toLowerCase());
}

export function isDemoUser(user: {
  email?: string | null;
  username?: string | null;
}) {
  return isDemoIdentifier(user.email) || isDemoIdentifier(user.username);
}

export function shouldHideDemoContent() {
  return process.env.NODE_ENV === 'production' && !areDemoLoginsEnabled();
}

export async function shouldHideDemoContentRuntime() {
  return getRuntimeFlag('hide_demo_content', process.env.NODE_ENV === 'production' && !(await areDemoLoginsEnabledRuntime()));
}

export function getDemoOwnerExclusion() {
  return shouldHideDemoContent() ? { owner: { email: { notIn: demoUserEmails } } } : {};
}

export function getDemoCreatorExclusion() {
  return shouldHideDemoContent() ? { creator: { email: { notIn: demoUserEmails } } } : {};
}

export function getDemoProfileRelationExclusion() {
  return shouldHideDemoContent() ? { profile: { owner: { email: { notIn: demoUserEmails } } } } : {};
}

export function getDemoShowRelationExclusion() {
  return shouldHideDemoContent() ? { show: { creator: { email: { notIn: demoUserEmails } } } } : {};
}

export function isReservedPlatformEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return email.trim().toLowerCase().endsWith('@ihype.org');
}

export function isProductionSeedingAllowed() {
  return parseBooleanFlag(process.env.ALLOW_PRODUCTION_SEEDING, false);
}

export function areDatabaseMediaUploadsEnabled() {
  return parseBooleanFlag(
    process.env.FEATURE_ALLOW_DATABASE_MEDIA_STORAGE,
    process.env.NODE_ENV !== 'production'
  );
}

export async function areDatabaseMediaUploadsEnabledRuntime() {
  return getRuntimeFlag('blob_media_storage', areDatabaseMediaUploadsEnabled());
}

export function isInviteCodeRequired() {
  return parseBooleanFlag(process.env.FEATURE_REQUIRE_INVITE_CODE, false);
}

export async function isInviteCodeRequiredRuntime() {
  return getRuntimeFlag('invite_only_signup', isInviteCodeRequired());
}

export function isValidInviteCode(value: string | null | undefined, requiredOverride?: boolean) {
  const configuredCodes = process.env.BETA_INVITE_CODES?.split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);

  if (!configuredCodes?.length) {
    return !(requiredOverride ?? isInviteCodeRequired());
  }

  return configuredCodes.includes(value?.trim().toLowerCase() ?? '');
}
