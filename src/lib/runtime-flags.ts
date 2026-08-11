import { kvGet } from '@/lib/kv';
import { log } from '@/lib/logger';
import { readRuntimeEnv } from '@/lib/runtime-env';

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

export type RuntimeFlagKey =
  | 'demo_logins'
  | 'invite_only_signup'
  | 'invite_code_sharing'
  | 'hide_demo_content'
  | 'blob_media_storage'
  | 'ticket_payment_capture'
  | 'registrations_enabled'
  | 'uploads_enabled'
  | 'outbound_email_enabled'
  | 'advertising_enabled'
  | 'payments_enabled'
  | 'tickets_enabled'
  | 'radio_enabled'
  | 'maps_enabled';

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

/**
 * Whether a code that can be PASSED AROUND opens the door.
 *
 * `invite_only_signup` says the door is shut; this says which keys fit. There
 * are three invite channels and they are not the same kind of thing:
 *
 *  1. a shared `BETA_INVITE_CODES` code — one string, a whole channel of people
 *  2. an admin-minted `InviteCode` row — single-use, claimed in the signup
 *     transaction, issued to one person
 *  3. a member's own HYPE code / `/invite/[hexId]` link — never consumed, so
 *     one member admits unlimited friends
 *
 * 1 and 3 are sharing; 2 is issuance. While this flag is OFF only 2 is
 * accepted, which makes the landing page's request form the single way in: you
 * ask, and an admin issues you a code that admits exactly you. Turning it on
 * re-opens 1 and 3 with no deploy, which is the point of it being a runtime
 * flag rather than deleted code.
 *
 * Defaults to FALSE, and that direction matters: a flag that fails open would
 * mean an unreachable KV silently re-opens signup to anyone holding any shared
 * code. Read by `POST /api/register` and `POST /api/referral/validate`, which
 * must agree — the second exists to predict the first.
 */
export const isInviteCodeSharingEnabledRuntime = () => getRuntimeFlag('invite_code_sharing', false);

export const areRegistrationsEnabledRuntime = () => getRuntimeFlag('registrations_enabled', true);
export const areUploadsEnabledRuntime = () => getRuntimeFlag('uploads_enabled', true);
export const isOutboundEmailEnabledRuntime = () => getRuntimeFlag('outbound_email_enabled', true);
export const isAdvertisingEnabledRuntime = () => getRuntimeFlag('advertising_enabled', true);
export const arePaymentsEnabledRuntime = () => getRuntimeFlag(
  'payments_enabled',
  // This is an independent emergency brake. Payment readiness continues to
  // fail closed through FEATURE_ENABLE_TICKET_PAYMENTS and Stripe validation.
  parseBooleanFlag(readRuntimeEnv('FEATURE_ENABLE_PAYMENTS'), true),
);
export const isTicketingEnabledRuntime = () => getRuntimeFlag(
  'tickets_enabled',
  parseBooleanFlag(readRuntimeEnv('FEATURE_ENABLE_TICKETING'), true),
);
export const isRadioEnabledRuntime = () => getRuntimeFlag(
  'radio_enabled',
  parseBooleanFlag(readRuntimeEnv('FEATURE_ENABLE_RADIO'), true),
);
export const areMapsEnabledRuntime = () => getRuntimeFlag(
  'maps_enabled',
  parseBooleanFlag(readRuntimeEnv('FEATURE_ENABLE_MAPS'), true),
);

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
