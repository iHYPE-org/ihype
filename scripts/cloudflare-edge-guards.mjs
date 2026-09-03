#!/usr/bin/env node
/**
 * The two edge guards Project Galileo makes free, written down as code.
 *
 *   1. WAF rate-limiting rules (Business plan: five allowed, two used here) in
 *      front of the auth and analytics endpoints — a first line AHEAD of the
 *      Durable Object limiter in `src/lib/rate-limit.ts`, which has had its own
 *      timeouts and degrades to a halved KV limit when it does.
 *   2. Cloudflare Access in front of `/admin` — a second gate ahead of the app's
 *      own `isAdminSession()` check, for the one account that can act on
 *      everything.
 *
 * Both are DASHBOARD configuration, which is exactly why they are a script:
 * CLAUDE.md's standing complaint is that a change made in a dashboard leaves
 * no record in this repository, and the next session does not know it exists.
 * This file is the record. Run it and the edge matches it; read it and you
 * know what the edge does.
 *
 * Dry-run by default — it reads the zone and account and prints the changes
 * it WOULD make. `--apply` makes them. Idempotent: rules are matched by
 * description, the Access application by its domain, so running it twice
 * changes nothing the second time.
 *
 * What it will not do: create the Zero Trust organization. That is a one-time
 * choice of team name with terms to accept and a plan to pick (Free covers 50
 * seats; this needs one). If the account has none, the Access half stops with
 * that instruction and exit code 3, and the rate-limit half still runs.
 *
 * Env: CLOUDFLARE_API_TOKEN (needs Zone WAF:Edit, Zone:Read, and for the
 * Access half Access: Apps and Policies:Edit + Access: Organizations,
 * Identity Providers, and Groups:Edit), CLOUDFLARE_ACCOUNT_ID, and either
 * CLOUDFLARE_ZONE_ID or EDGE_GUARD_ZONE_NAME (default ihype.org).
 */

import { fileURLToPath } from 'node:url';

export const ZONE_NAME_DEFAULT = 'ihype.org';
export const ADMIN_EMAIL_DEFAULT = 'admin@ihype.org';
/**
 * Every address the Access application admits. Mirrors `DEFAULT_ADMIN_EMAILS`
 * in `src/lib/admin-allowlist.ts` — the edge gate and the app gate must name
 * the same people, or an administrator the app accepts is stopped at the PIN
 * page. `EDGE_GUARD_ADMIN_EMAIL` may be a comma-separated list.
 */
export const ADMIN_EMAILS_DEFAULT = [ADMIN_EMAIL_DEFAULT, 'staff@ihype.org'];

/** Normalise one address or a comma-separated list into a de-duplicated array. */
export function adminEmailList(value) {
  const list = (Array.isArray(value) ? value : String(value ?? '').split(','))
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e.includes('@'));
  return list.length ? [...new Set(list)] : [...ADMIN_EMAILS_DEFAULT];
}
const API = 'https://api.cloudflare.com/client/v4';

/**
 * The rate-limit rules, sized as a FLOOD backstop and not as the product's
 * limit — the app's own buckets (5 registrations per 5 min, 20 passkey
 * option requests per minute, per IP) are far below these. The gap is
 * deliberate: a venue's guest wifi is one IP shared by everyone at the door,
 * and a rule tight enough to be the real limit would lock a whole room out
 * of signing up at the show that brought them. `cf.colo.id` is mandatory in
 * every rule's characteristics (Cloudflare counts per data centre) and must
 * never appear in the expression.
 */
export const RATE_LIMIT_RULES = [
  {
    description: 'iHYPE auth flood guard',
    expression: '(starts_with(http.request.uri.path, "/api/auth/") or http.request.uri.path eq "/api/register")',
    action: 'block',
    ratelimit: {
      characteristics: ['cf.colo.id', 'ip.src'],
      period: 60,
      requests_per_period: 120,
      mitigation_timeout: 300,
    },
  },
  {
    description: 'iHYPE analytics flood guard',
    expression: '(http.request.uri.path eq "/api/analytics/track")',
    action: 'block',
    ratelimit: {
      characteristics: ['cf.colo.id', 'ip.src'],
      period: 60,
      requests_per_period: 600,
      mitigation_timeout: 60,
    },
  },
];

/**
 * The Access application. `ihype.org/admin` covers `/admin` and everything
 * under it — the pages. It deliberately does NOT cover `/api/admin/*`: those
 * are fetched by the admin pages with the app's own session cookie, and an
 * Access redirect on an XHR is a broken page, not a login prompt. The app's
 * `isAdminSession()` still guards every one of those routes.
 */
export function adminAccessApp(zoneName = ZONE_NAME_DEFAULT, adminEmail = ADMIN_EMAILS_DEFAULT) {
  const emails = adminEmailList(adminEmail);
  const domain = `${zoneName}/admin`;
  return {
    name: 'iHYPE admin',
    type: 'self_hosted',
    domain,
    self_hosted_domains: [domain],
    session_duration: '24h',
    auto_redirect_to_identity: false,
    http_only_cookie_attribute: true,
    policies: [
      {
        name: 'iHYPE admin (allow)',
        decision: 'allow',
        precedence: 1,
        include: emails.map((email) => ({ email: { email } })),
      },
    ],
  };
}

/** Field-by-field equality on the parts of a rule this script owns. */
export function ruleMatches(existing, desired) {
  if (!existing || existing.expression !== desired.expression || existing.action !== desired.action) return false;
  const a = existing.ratelimit ?? {};
  const b = desired.ratelimit;
  const chars = [...(a.characteristics ?? [])].sort().join(',') === [...b.characteristics].sort().join(',');
  return chars
    && a.period === b.period
    && a.requests_per_period === b.requests_per_period
    && a.mitigation_timeout === b.mitigation_timeout
    && (existing.enabled ?? true) === true;
}

/**
 * Pure planner: what to create, update or leave alone, matching by
 * description. Rules this script does not own are never touched.
 */
export function planRateLimitRules(existingRules, desired = RATE_LIMIT_RULES) {
  const plan = { create: [], update: [], unchanged: [] };
  for (const rule of desired) {
    const found = (existingRules ?? []).find((r) => r.description === rule.description);
    if (!found) plan.create.push(rule);
    else if (ruleMatches(found, rule)) plan.unchanged.push({ id: found.id, ...rule });
    else plan.update.push({ id: found.id, ...rule });
  }
  return plan;
}

/** Does an Access policy list already let EVERY listed admin in? */
export function policyAllows(policies, adminEmail) {
  const emails = adminEmailList(adminEmail);
  return emails.every((email) => (policies ?? []).some((p) =>
    p.decision === 'allow'
    && (p.include ?? []).some((inc) => inc?.email?.email?.toLowerCase() === email)));
}

export function planAccessApp(existingApps, desired) {
  const found = (existingApps ?? []).find((app) =>
    app.domain === desired.domain || (app.self_hosted_domains ?? []).includes(desired.domain));
  if (!found) return { action: 'create', app: null };
  return { action: 'exists', app: found };
}

// ---------------------------------------------------------------------------

function fail(message, code = 1) {
  console.error(`\n✖ ${message}`);
  process.exit(code);
}

async function cf(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, ok: res.ok && json?.success !== false, json };
}

/**
 * Cloudflare answers a bad or under-scoped token with 400/401/403 and one of a
 * few well-known codes. Those must never be read as "nothing there yet" — an
 * unauthenticated GET of the ruleset looks exactly like a zone with no rules,
 * and the Access organization check would report "no organization" for a
 * token that simply cannot see it.
 */
const AUTH_ERROR_CODES = new Set([6003, 6111, 9103, 9106, 9109, 10000, 10001]);
export function isAuthError(result) {
  if (result.status === 401 || result.status === 403) return true;
  return (result.json?.errors ?? []).some((e) => AUTH_ERROR_CODES.has(Number(e.code)));
}

async function verifyToken(token) {
  const res = await cf(token, 'GET', '/user/tokens/verify');
  if (!res.ok || res.json?.result?.status !== 'active') {
    fail(`The Cloudflare API token is not valid or not active: ${describeErrors(res)}`);
  }
}

function describeErrors(result) {
  const errs = result.json?.errors ?? [];
  const text = errs.map((e) => `${e.code ?? ''} ${e.message ?? ''}`.trim()).join('; ');
  const hint = result.status === 403 || /authentication|permission|not authorized|Unauthorized/i.test(text)
    ? ' — the token lacks a permission this step needs; see the header of scripts/cloudflare-edge-guards.mjs for the list.'
    : '';
  return `HTTP ${result.status}${text ? `: ${text}` : ''}${hint}`;
}

async function resolveZoneId(token, env) {
  if (env.CLOUDFLARE_ZONE_ID) return env.CLOUDFLARE_ZONE_ID;
  const name = env.EDGE_GUARD_ZONE_NAME || ZONE_NAME_DEFAULT;
  const res = await cf(token, 'GET', `/zones?name=${encodeURIComponent(name)}`);
  if (!res.ok) fail(`Could not look up zone ${name}: ${describeErrors(res)}`);
  const zone = res.json?.result?.[0];
  if (!zone) fail(`No zone named ${name} is visible to this token.`);
  return zone.id;
}

async function applyRateLimits({ token, zoneId, apply }) {
  console.log('\n## WAF rate-limiting rules');
  const entry = await cf(token, 'GET', `/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`);
  let existingRules = [];
  let rulesetId = null;
  if (entry.ok) {
    existingRules = entry.json.result?.rules ?? [];
    rulesetId = entry.json.result?.id ?? null;
  } else if (entry.status !== 404 || isAuthError(entry)) {
    fail(`Could not read the zone's rate-limit ruleset: ${describeErrors(entry)}`);
  }
  const plan = planRateLimitRules(existingRules);
  for (const r of plan.unchanged) console.log(`  = ${r.description} (unchanged)`);
  for (const r of plan.create) console.log(`  + ${r.description}: ${r.ratelimit.requests_per_period}/${r.ratelimit.period}s per IP → block ${r.ratelimit.mitigation_timeout}s`);
  for (const r of plan.update) console.log(`  ~ ${r.description}: update to ${r.ratelimit.requests_per_period}/${r.ratelimit.period}s per IP → block ${r.ratelimit.mitigation_timeout}s`);
  const others = existingRules.filter((r) => !RATE_LIMIT_RULES.some((d) => d.description === r.description));
  if (others.length) console.log(`  · ${others.length} other rule(s) on the zone, left alone: ${others.map((r) => r.description || r.id).join(', ')}`);
  if (!apply) return;

  if (!rulesetId) {
    const res = await cf(token, 'PUT', `/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`, { rules: plan.create });
    if (!res.ok) fail(`Creating the rate-limit ruleset failed: ${describeErrors(res)}`);
    console.log(`  ✓ created the ruleset with ${plan.create.length} rule(s)`);
    return;
  }
  for (const rule of plan.create) {
    const res = await cf(token, 'POST', `/zones/${zoneId}/rulesets/${rulesetId}/rules`, rule);
    if (!res.ok) fail(`Creating "${rule.description}" failed: ${describeErrors(res)}`);
    console.log(`  ✓ created ${rule.description}`);
  }
  for (const { id, ...rule } of plan.update) {
    const res = await cf(token, 'PATCH', `/zones/${zoneId}/rulesets/${rulesetId}/rules/${id}`, { ...rule, enabled: true });
    if (!res.ok) fail(`Updating "${rule.description}" failed: ${describeErrors(res)}`);
    console.log(`  ✓ updated ${rule.description}`);
  }
}

async function applyAccess({ token, accountId, apply, zoneName, adminEmail }) {
  console.log('\n## Cloudflare Access in front of /admin');
  const org = await cf(token, 'GET', `/accounts/${accountId}/access/organizations`);
  if (!org.ok && (isAuthError(org) || org.status !== 404)) {
    fail(`Could not read the Zero Trust organization: ${describeErrors(org)}`);
  }
  const authDomain = org.json?.result?.auth_domain;
  if (!org.ok || !authDomain) {
    console.log('  ✖ this account has no Zero Trust organization yet.');
    console.log('    Create it once in the dashboard (Zero Trust → choose a team name; the Free plan covers');
    console.log('    50 seats and this needs one), then re-run. Nothing on the Access side was changed.');
    return 3;
  }
  console.log(`  · team domain ${authDomain}`);

  const idps = await cf(token, 'GET', `/accounts/${accountId}/access/identity_providers`);
  if (!idps.ok) fail(`Could not list identity providers: ${describeErrors(idps)}`);
  const hasOtp = (idps.json.result ?? []).some((idp) => idp.type === 'onetimepin');
  if (hasOtp) console.log('  = One-time PIN identity provider present');
  else {
    console.log(`  + One-time PIN identity provider (a code emailed to ${adminEmail} is the login)`);
    if (apply) {
      const res = await cf(token, 'POST', `/accounts/${accountId}/access/identity_providers`, { name: 'One-time PIN', type: 'onetimepin', config: {} });
      if (!res.ok) fail(`Creating the One-time PIN provider failed: ${describeErrors(res)}`);
      console.log('  ✓ created One-time PIN provider');
    }
  }

  const desired = adminAccessApp(zoneName, adminEmail);
  const apps = await cf(token, 'GET', `/accounts/${accountId}/access/apps`);
  if (!apps.ok) fail(`Could not list Access applications: ${describeErrors(apps)}`);
  const plan = planAccessApp(apps.json.result, desired);
  if (plan.action === 'create') {
    console.log(`  + application "${desired.name}" on ${desired.domain}, allow ${adminEmail}, session ${desired.session_duration}`);
    if (apply) {
      const res = await cf(token, 'POST', `/accounts/${accountId}/access/apps`, desired);
      if (!res.ok) fail(`Creating the Access application failed: ${describeErrors(res)}`);
      console.log(`  ✓ created application ${res.json.result?.id ?? ''}`);
    }
    return 0;
  }
  const app = plan.app;
  console.log(`  = application "${app.name}" already on ${desired.domain} (${app.id})`);
  const policies = await cf(token, 'GET', `/accounts/${accountId}/access/apps/${app.id}/policies`);
  if (!policies.ok) fail(`Could not read the application's policies: ${describeErrors(policies)}`);
  if (policyAllows(policies.json.result, adminEmail)) {
    console.log(`  = an allow policy already admits ${adminEmail}`);
  } else {
    console.log(`  + allow policy for ${adminEmail} (none of the ${policies.json.result?.length ?? 0} existing policies admits that address)`);
    if (apply) {
      const res = await cf(token, 'POST', `/accounts/${accountId}/access/apps/${app.id}/policies`, desired.policies[0]);
      if (!res.ok) fail(`Creating the allow policy failed: ${describeErrors(res)}`);
      console.log('  ✓ created the allow policy');
    }
  }
  return 0;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const env = process.env;
  const token = env.CLOUDFLARE_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!token) fail('CLOUDFLARE_API_TOKEN is not set.');
  const zoneName = env.EDGE_GUARD_ZONE_NAME || ZONE_NAME_DEFAULT;
  const adminEmail = adminEmailList(env.EDGE_GUARD_ADMIN_EMAIL).join(', ');

  console.log(`Cloudflare edge guards — ${apply ? 'APPLYING' : 'dry run (pass --apply to make changes)'}`);
  await verifyToken(token);
  let exit = 0;
  if (!args.has('--skip-ratelimit')) {
    const zoneId = await resolveZoneId(token, env);
    await applyRateLimits({ token, zoneId, apply });
  }
  if (!args.has('--skip-access')) {
    if (!accountId) fail('CLOUDFLARE_ACCOUNT_ID is not set (needed for the Access half; pass --skip-access to do only the rate limits).');
    exit = await applyAccess({ token, accountId, apply, zoneName, adminEmail });
  }
  console.log(apply ? '\nDone. Record the outcome in CLAUDE.md (infrastructure list) so the next session knows the edge carries these.' : '\nDry run complete.');
  process.exit(exit);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
