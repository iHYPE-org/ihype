#!/usr/bin/env node
/**
 * Validates required configuration before alpha or beta launch.
 *
 * Usage:
 *   node -r dotenv/config scripts/beta-launch-check.mjs
 */

const paymentEnabled = process.env.FEATURE_ENABLE_TICKET_PAYMENTS?.trim().toLowerCase() === 'true';

const REQUIRED = [
  { key: 'AUTH_SECRET', hint: 'Generate with: openssl rand -hex 32' },
  { key: 'DATABASE_URL', hint: 'Runtime Postgres connection URL' },
  { key: 'RESEND_API_KEY', hint: 'Required for OTP login and account email' },
  { key: 'RESEND_WEBHOOK_SECRET', hint: 'Verifies bounce, complaint, and delivery webhooks' },
  { key: 'EMAIL_FROM', hint: 'Verified Resend sender address' },
  { key: 'CRON_SECRET', hint: 'Protects /api/cron/* routes; generate with: openssl rand -hex 32' },
  { key: 'TURNSTILE_SECRET_KEY', hint: 'Required for production signup abuse protection' },
  { key: 'ADMIN_DEVICE_SECRET', hint: 'Protects admin-device registration; generate with: openssl rand -hex 32' },
  { key: 'ADMIN_ALERT_EMAIL', hint: 'Comma-separated operational alert recipients' },
  { key: 'RESTORE_DRILL_VERIFIED_AT', hint: 'ISO timestamp from a successful isolated backup restore drill' },
  { key: 'VAPID_PUBLIC_KEY', hint: 'Generate with: node scripts/generate-vapid-keys.mjs' },
  { key: 'VAPID_PRIVATE_KEY', hint: 'Generate with: node scripts/generate-vapid-keys.mjs' },
  { key: 'VAPID_SUBJECT', hint: 'e.g. mailto:hello@ihype.org' },
  { key: 'BETA_INVITE_CODES', hint: 'Comma-separated high-entropy codes; generate with openssl rand -hex 16' },
  ...(paymentEnabled
    ? [
        { key: 'STRIPE_SECRET_KEY', hint: 'Required only when paid ticketing is explicitly enabled' },
        { key: 'STRIPE_WEBHOOK_SECRET', hint: 'Required only when paid ticketing is explicitly enabled' },
      ]
    : []),
];

const OPTIONAL = [
  { key: 'NEXT_PUBLIC_SENTRY_DSN', hint: 'Sentry error monitoring' },
  { key: 'OPENAI_API_KEY', hint: 'AI discovery features' },
  /* MUX_TOKEN_ID/MUX_TOKEN_SECRET were listed here as "Video streaming" and
     are gone (2026-08-14). iHYPE hosts no video, no live streams and no
     recorded video — it is a brand constant, not a missing feature — and
     nothing in src/ has ever read them. An operator running this check at the
     one moment they are deciding whether the product is ready was being told
     that video streaming is a thing they could configure. */
  ...(!paymentEnabled
    ? [
        { key: 'STRIPE_SECRET_KEY', hint: 'Not required while FEATURE_ENABLE_TICKET_PAYMENTS=false' },
        { key: 'STRIPE_WEBHOOK_SECRET', hint: 'Not required while FEATURE_ENABLE_TICKET_PAYMENTS=false' },
      ]
    : []),
];

let failed = false;
console.log('\n=== iHYPE Alpha Launch Configuration Check ===\n');
console.log(`  Paid ticketing: ${paymentEnabled ? 'ENABLED' : 'DISABLED'}\n`);

for (const { key, hint } of REQUIRED) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(`  MISSING  ${key}`);
    console.error(`           ${hint}\n`);
    failed = true;
  } else {
    console.log(`  OK       ${key}`);
  }
}

const inviteCodes = (process.env.BETA_INVITE_CODES ?? '')
  .split(',')
  .map((code) => code.trim())
  .filter(Boolean);
const weakInviteCodes = inviteCodes.filter(
  (code) => code.length < 16 || /^(ihype|hype2026|beta|listen)$/i.test(code),
);
if (weakInviteCodes.length > 0) {
  console.error('  WEAK     BETA_INVITE_CODES contains short or predictable values.');
  console.error('           Replace every code with at least 16 random characters.\n');
  failed = true;
}

for (const key of ['AUTH_SECRET', 'CRON_SECRET', 'ADMIN_DEVICE_SECRET']) {
  const value = process.env[key]?.trim() ?? '';
  if (value && value.length < 32) {
    console.error(`  WEAK     ${key} must contain at least 32 characters.`);
    failed = true;
  }
}

const alertRecipients = (process.env.ADMIN_ALERT_EMAIL ?? '')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);
if (alertRecipients.length < 2) {
  console.error('  INVALID  ADMIN_ALERT_EMAIL must contain both operator addresses for alpha.');
  failed = true;
}

const restoreVerifiedAt = new Date(process.env.RESTORE_DRILL_VERIFIED_AT ?? '');
const restoreAgeMs = Date.now() - restoreVerifiedAt.getTime();
const restoreMaxAgeMs = 35 * 24 * 60 * 60 * 1000;
if (!Number.isFinite(restoreVerifiedAt.getTime()) || restoreAgeMs < 0 || restoreAgeMs > restoreMaxAgeMs) {
  console.error('  INVALID  RESTORE_DRILL_VERIFIED_AT must record a successful drill within the last 35 days.');
  failed = true;
}

if (paymentEnabled) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (!stripeKey.startsWith('sk_live_')) {
    console.error('  INVALID  STRIPE_SECRET_KEY must be a live key when paid ticketing is enabled.');
    failed = true;
  }
  if (!(process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '').startsWith('whsec_')) {
    console.error('  INVALID  STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret.');
    failed = true;
  }
}

console.log('\n--- Optional ---\n');
for (const { key, hint } of OPTIONAL) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.log(`  MISSING  ${key}  (optional: ${hint})`);
  } else {
    console.log(`  OK       ${key}`);
  }
}

if (failed) {
  console.error('\nFAILED: required configuration is missing or insecure.\n');
  process.exit(1);
}

console.log('\nPASSED: required alpha configuration is present.\n');
