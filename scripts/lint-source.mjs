#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];

async function text(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

async function walk(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(relative)));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

const sourceFiles = await walk('src');

/*
 * Inline `fontSize` in px does not scale.
 *
 * Settings → Accessibility → Text size writes `--ihype-text-scale`, and
 * `mmm-workflows.css` applies it as `:root { font-size: calc(100% * var(...)) }` — so
 * `rem` follows it and `px` cannot. 691 inline px sizes across 77 files were
 * therefore invisible to that control, which is an accessibility setting that
 * silently did nothing on most of the app.
 *
 * px is still correct in three places and they are exempt: Satori /
 * ImageResponse surfaces (OG cards, QR, posters) have no root font size at
 * all, email HTML does not carry our stylesheet, and the EPK is a print
 * document sized for paper.
 */
const PX_FONT_SIZE_EXEMPT = [
  'opengraph-image', 'api/og/', 'qr/route', 'poster/route', 'card/route',
  'src/lib/', 'epk/',
];
const inlinePxFontSize = /fontSize: (?:'\d+(?:\.\d+)?px'|\d+(?:\.\d+)?)(?=[,}\s])/;

/**
 * No emoji in the UI (Design System 8, ADHERENCE rule 29).
 *
 * The rule is precise and the precision matters: **Unicode glyphs are fine**
 * — `▶ ❚❚ ♥ ♡ ✕ ✓ ★ ⚑ ⬟ ♪` are the system's own vocabulary — while
 * pictographic emoji (`🔥 🎤 🏛 🎟`) are not. So this matches only the
 * pictographic blocks, not the whole symbol range. A rule that flagged `✓`
 * would be wrong and would be turned off within a week.
 *
 * Why a rule rather than review: 40 of these had accumulated across 20 files,
 * including one (`\u{1F8ED}`) that is an unassigned codepoint and rendered as
 * tofu in the privacy panel for nobody knows how long. Emoji arrive one at a
 * time, in a hurry, and each one looks harmless on its own.
 *
 * Comment lines are skipped — this file and the design docs have to be able to
 * name the characters they forbid.
 */
const PICTOGRAPHIC_EMOJI = /[\u{1F000}-\u{1FAFF}]/u;
const EMOJI_EXEMPT = [
  // Reaction sets are content the member picks, not chrome the system draws;
  // the stored `ShowCommentReaction.emoji` values are these exact strings.
  'ShowComments.tsx',
];

for (const file of sourceFiles) {
  const content = await text(file);
  if (/\beval\s*\(/.test(content)) fail(file, 'eval() is forbidden.');
  if (/\bnew\s+Function\s*\(/.test(content)) fail(file, 'new Function() is forbidden.');

  const portable = file.split(path.sep).join('/');
  if (portable.endsWith('.tsx') && !PX_FONT_SIZE_EXEMPT.some((x) => portable.includes(x))
      && inlinePxFontSize.test(content)) {
    fail(file, 'inline fontSize in px ignores the Text size accessibility setting — use rem (px / 16).');
  }

  if (portable.endsWith('.tsx') && !EMOJI_EXEMPT.some((x) => portable.includes(x))) {
    for (const [index, line] of content.split('\n').entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
      const match = PICTOGRAPHIC_EMOJI.exec(line);
      if (match) {
        fail(file, `line ${index + 1}: emoji ${match[0]} — Design System 8 allows Unicode glyphs (▶ ✓ ★ ⬟) but no emoji.`);
        break;
      }
    }
  }
}

const readme = await text('README.md');
if (readme.includes('cite')) fail('README.md', 'internal rendered citation tokens must not be committed.');

const environmentExample = await text('.env.example');
if (/BETA_INVITE_CODES=.*\b(?:IHYPE|HYPE2026|BETA|LISTEN)\b/i.test(environmentExample)) {
  fail('.env.example', 'predictable beta invite codes are forbidden.');
}
if (!/FEATURE_ENABLE_TICKET_PAYMENTS="false"/.test(environmentExample)) {
  fail('.env.example', 'paid ticketing must default to disabled.');
}

// Paid ticketing went live 2026-07-19: 501c3 status confirmed and a live
// Stripe account is attached to the org's bank account (explicit,
// unambiguous product/business confirmation — this line is a deliberate,
// reviewed edit, not a default someone forgot to flip back). Actual
// charging still additionally requires live STRIPE_SECRET_KEY/
// STRIPE_WEBHOOK_SECRET Cloudflare Worker secrets (never touched by this
// repo or its CI — see src/lib/payments.ts's getPaymentProcessingReadiness,
// which fails closed if either is missing or STRIPE_SECRET_KEY is a
// sk_test_ key in production).
const wranglerConfig = await text('wrangler.toml');
if (!/FEATURE_ENABLE_TICKET_PAYMENTS\s*=\s*"true"/.test(wranglerConfig)) {
  fail('wrangler.toml', 'paid ticketing launch flag was reverted — confirm this is intentional before changing it back.');
}

const payments = await text('src/lib/payments.ts');
if (!payments.includes('FEATURE_ENABLE_TICKET_PAYMENTS')) {
  fail('src/lib/payments.ts', 'payment readiness must require the explicit launch flag.');
}
if (!payments.includes("NODE_ENV === 'production'") || !payments.includes("startsWith('sk_test_')")) {
  fail('src/lib/payments.ts', 'production payment readiness must reject Stripe test credentials.');
}

// The token-issuing logic lives in src/lib/magic-link.ts (shared by
// /api/auth/magic-link and /api/advertise/register) rather than duplicated
// inline in the route — check the shared helper for the hashing invariant.
const magicLinkIssue = await text('src/lib/magic-link.ts');
if (!magicLinkIssue.includes('token: tokenHash')) {
  fail('src/lib/magic-link.ts', 'magic-link bearer tokens must be hashed at rest.');
}

const magicLinkConsume = await text('src/app/api/auth/magic/route.ts');
if (!magicLinkConsume.includes('updateMany') || !magicLinkConsume.includes('used: false')) {
  fail('src/app/api/auth/magic/route.ts', 'magic-link consumption must use a conditional atomic update.');
}

const scanRoute = await text('src/app/api/tickets/[serializedId]/scan/route.ts');
if (!scanRoute.includes('updateMany') || !scanRoute.includes("status: 'VALID'")) {
  fail('src/app/api/tickets/[serializedId]/scan/route.ts', 'ticket scanning must be a conditional atomic transition.');
}

const middleware = await text('src/middleware.ts');
const scriptDirective = middleware.match(/script-src[^`\n]*/)?.[0] ?? '';
if (scriptDirective.includes("'unsafe-inline'")) {
  fail('src/middleware.ts', 'script-src must not allow unsafe-inline scripts.');
}
if (!middleware.includes("'nonce-${nonce}'")) {
  fail('src/middleware.ts', 'script-src must include a per-request nonce.');
}

const nextConfig = await text('next.config.mjs');
if (/key:\s*['"]Content-Security-Policy['"]/.test(nextConfig)) {
  fail(
    'next.config.mjs',
    "must not set Content-Security-Policy — it's set exclusively by src/middleware.ts (a static header here applies to the same routes and silently wins over middleware's per-request nonce, making the CSP script-src check above meaningless in practice)."
  );
}

for (const webhookFile of [
  'src/app/api/stripe/webhook/route.ts',
  'src/app/api/webhooks/resend/route.ts',
]) {
  const content = await text(webhookFile);
  if (!content.includes('db.$transaction')) {
    fail(webhookFile, 'webhook business logic and idempotency marker must share a transaction.');
  }
}

const firstPasskeyRoute = await text('src/app/api/auth/passkey/register-first/route.ts');
if (firstPasskeyRoute.includes("jar.get('pk_reg_first_uid')")) {
  fail('src/app/api/auth/passkey/register-first/route.ts', 'raw user-ID cookies must not authorize passkey bootstrap.');
}
if (!firstPasskeyRoute.includes('passkeyBootstrapToken.updateMany')) {
  fail('src/app/api/auth/passkey/register-first/route.ts', 'passkey bootstrap capabilities must be consumed atomically.');
}

const showPage = await text('src/app/shows/[slug]/page.tsx');
const showPageIsAlias = showPage.includes("redirect(`/app/shows/");
if (!showPageIsAlias && (showPage.includes('void canWatch') || !showPage.includes('protectShowProductionPlan'))) {
  fail('src/app/shows/[slug]/page.tsx', 'ticketed production plans must be entitlement-gated and URL-protected.');
}

const privacyExport = await text('src/app/api/privacy/export/route.ts');
for (const relation of ['issuedTickets', 'followers', 'receivedBookingRequests']) {
  const broadRelationLoad = new RegExp(`^\\s{10}${relation}: true,`, 'm');
  if (broadRelationLoad.test(privacyExport)) {
    fail('src/app/api/privacy/export/route.ts', `third-party relation records must not be exported: ${relation}`);
  }
}

// Windows cannot create files or directories named after DOS device names
// (aux, con, nul, ...), so one such path segment makes `git clone` fail to
// check out the tree on every Windows machine. src/app/aux once did exactly
// that — it now lives at src/app/aux-queue behind a /aux rewrite.
const WINDOWS_RESERVED = /^(?:aux|con|prn|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
async function walkAllPaths(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const relative = directory ? path.join(directory, entry.name) : entry.name;
    if (WINDOWS_RESERVED.test(entry.name) || /[. ]$/.test(entry.name)) {
      fail(relative, 'path segment is not checkout-safe on Windows (reserved device name or trailing dot/space).');
    }
    if (entry.isDirectory()) await walkAllPaths(relative);
  }
}
await walkAllPaths('');

for (const workflowFile of ['.github/workflows/ci.yml', '.github/workflows/deploy-production.yml']) {
  const workflow = await text(workflowFile);
  for (const line of workflow.split('\n')) {
    const match = line.match(/uses:\s+([^@\s]+)@([^#\s]+)/);
    if (match && !/^[a-f0-9]{40}$/.test(match[2])) {
      fail(workflowFile, `GitHub Action must be pinned to a full commit SHA: ${line.trim()}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Source policy lint failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Source policy lint passed for ${sourceFiles.length} source files.`);
