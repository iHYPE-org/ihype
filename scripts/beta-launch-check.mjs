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
  { key: 'RESEND_WEBHOOK_SECRET', hint: 'Verifies bounce and complaint webhooks' },
  { key: 'EMAIL_FROM', hint: 'Verified Resend sender address' },
  { key: 'CRON_SECRET', hint: 'Protects /api/cron/* routes; generate with: openssl rand -hex 32' },
  { key: 'TURNSTILE_SECRET_KEY', hint: 'Server-side signup abuse protection' },
  { key: 'ADMIN_DEVICE_SECRET', hint: 'Protects first-party admin-device enrollment' },
  { key: 'ADMIN_ALERT_EMAIL', hint: 'Comma-separated operational alert recipients' },
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
  { key: 'MUX_TOKEN_ID', hint: 'Video streaming' },
  { key: 'MUX_TOKEN_SECRET', hint: 'Video streaming' },
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
