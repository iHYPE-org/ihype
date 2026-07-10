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
for (const file of sourceFiles) {
  const content = await text(file);
  if (/\beval\s*\(/.test(content)) fail(file, 'eval() is forbidden.');
  if (/\bnew\s+Function\s*\(/.test(content)) fail(file, 'new Function() is forbidden.');
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

const wranglerConfig = await text('wrangler.toml');
if (!/FEATURE_ENABLE_TICKET_PAYMENTS\s*=\s*"false"/.test(wranglerConfig)) {
  fail('wrangler.toml', 'the deployed Workers runtime must pin paid ticketing to disabled.');
}

const payments = await text('src/lib/payments.ts');
if (!payments.includes('FEATURE_ENABLE_TICKET_PAYMENTS')) {
  fail('src/lib/payments.ts', 'payment readiness must require the explicit launch flag.');
}
if (!payments.includes("NODE_ENV === 'production'") || !payments.includes("startsWith('sk_test_')")) {
  fail('src/lib/payments.ts', 'production payment readiness must reject Stripe test credentials.');
}

const magicLinkRequest = await text('src/app/api/auth/magic-link/route.ts');
if (!magicLinkRequest.includes('token: tokenHash')) {
  fail('src/app/api/auth/magic-link/route.ts', 'magic-link bearer tokens must be hashed at rest.');
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
  'src/app/api/ads/stripe-webhook/route.ts',
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
if (showPage.includes('void canWatch') || !showPage.includes('protectShowProductionPlan')) {
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
