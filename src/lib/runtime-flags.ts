import { kvGet } from '@/lib/kv';

export async function readRuntimeOverride(key: string): Promise<boolean | null> {
  const value = await kvGet<string>('flags:' + key);
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

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

export function isInviteCodeRequired() {
  return parseBooleanFlag(process.env.FEATURE_REQUIRE_INVITE_CODE, false);
}

export function isValidInviteCode(value: string | null | undefined) {
  const configuredCodes = process.env.BETA_INVITE_CODES?.split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);

  if (!configuredCodes?.length) {
    return !isInviteCodeRequired();
  }

  return configuredCodes.includes(value?.trim().toLowerCase() ?? '');
}
