/**
 * Pre-deploy smoke test against the REAL Workers runtime (workerd).
 *
 * Boots the already-built `.open-next` worker bundle in `wrangler dev`
 * (miniflare/workerd) against a local Postgres, then exercises the code
 * paths that have historically broken ONLY on workerd. Prisma engine
 * selection cannot fail in Node, so `next build` + vitest passing proves
 * nothing about it (see DESIGN_SYNC rows 171-176: five green builds
 * shipped a sitewide DB outage that only workerd could surface).
 *
 * Also runs the Lighthouse performance budget (scripts/lighthouse-budget.mjs)
 * against this same instance once the functional checks pass. That budget
 * has the identical workerd-only requirement (its DB-backed pages need a real
 * Prisma engine), so it shares this boot rather than starting a second,
 * broken Node server. Set SKIP_LIGHTHOUSE_BUDGET=1 to skip it for a faster
 * functional-only smoke run.
 *
 * Prerequisites (CI provides these; see .github/workflows/ci.yml):
 *   - `npm run cf:build` has already produced `.open-next/`
 *   - WORKERD_SMOKE_DATABASE_URL points at a Postgres with the schema
 *     applied (prisma db push) and pg_trgm/citext extensions created
 *
 * Usage: node scripts/workerd-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { runLighthouseBudget } from './lighthouse-budget.mjs';

const PORT = Number(process.env.WORKERD_SMOKE_PORT || 8787);
const BASE = `http://127.0.0.1:${PORT}`;
const DB_URL = process.env.WORKERD_SMOKE_DATABASE_URL;
const HEALTH_CHECK_TOKEN =
  process.env.WORKERD_SMOKE_CRON_SECRET || 'workerd-smoke-health-token-0123456789';
const AUTH_SECRET =
  process.env.AUTH_SECRET || 'workerd-smoke-auth-secret-0123456789';
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || AUTH_SECRET;
const BOOT_TIMEOUT_MS = 120_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const TMP_CONFIG = '.wrangler-workerd-smoke.toml';

if (!DB_URL) {
  console.error('[workerd-smoke] WORKERD_SMOKE_DATABASE_URL is required');
  process.exit(1);
}

function tomlString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function upsertTomlVariable(varsSection, name, value) {
  const assignment = `${name} = "${tomlString(value)}"`;
  const pattern = new RegExp(`^${name}\\s*=.*$`, 'm');
  if (pattern.test(varsSection)) return varsSection.replace(pattern, assignment);
  return varsSection.replace('\n[vars]\n', `\n[vars]\n${assignment}\n`);
}

// Derive a smoke config from the real wrangler.toml at runtime so bindings
// cannot drift between two files, minus two sections:
// - [build]: re-runs the full cf:build on `wrangler dev` startup; CI already
//   built, so it would only add minutes of redundant rebuild.
// - [ai]: Workers AI is remote-only in local dev and refuses to start without
//   CLOUDFLARE_API_TOKEN credentials. The app's AI call sites already degrade
//   when the binding is absent, so the smoke runs without it.
//
// Shell environment variables are not automatically exposed as Worker runtime
// variables by `wrangler dev`. Inject only the local smoke values required by
// the production configuration validator and protected health/auth routes.
function writeStrippedConfig() {
  const source = readFileSync('wrangler.toml', 'utf8');
  let stripped = source;
  for (const section of ['build', 'ai']) {
    const before = stripped;
    stripped = stripped.replace(new RegExp(`\\n\\[${section}\\][\\s\\S]*?(?=\\n\\[|$)`), '\n');
    if (stripped === before) {
      console.warn(`[workerd-smoke] no [${section}] section found to strip; continuing`);
    }
  }

  const varsPattern = /\n\[vars\]\n[\s\S]*?(?=\n\[|$)/;
  let varsSection = stripped.match(varsPattern)?.[0];
  if (!varsSection) {
    throw new Error('wrangler.toml must contain a [vars] section for Workerd smoke configuration');
  }

  for (const [name, value] of Object.entries({
    CRON_SECRET: HEALTH_CHECK_TOKEN,
    DATABASE_URL: DB_URL,
    AUTH_SECRET,
    NEXTAUTH_SECRET,
  })) {
    varsSection = upsertTomlVariable(varsSection, name, value);
  }
  varsSection = varsSection.replace(/\n{3,}/g, '\n\n');
  stripped = stripped.replace(varsPattern, varsSection);

  writeFileSync(TMP_CONFIG, stripped);
}

async function probe(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBoot(child) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev exited early with code ${child.exitCode}`);
    }
    try {
      await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      return;
    } catch {
      await delay(2000);
    }
  }
  throw new Error(`wrangler dev did not become reachable within ${BOOT_TIMEOUT_MS}ms`);
}

function signalProcessTree(child, signal) {
  if (!child.pid || child.exitCode !== null) return;

  try {
    // On Unix, the detached child is the leader of a process group containing
    // npx, Wrangler, Miniflare, and workerd. Signalling the negative PID stops
    // the entire tree instead of orphaning descendants that keep CI alive.
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

async function stopProcessTree(child) {
  if (child.exitCode !== null) return;

  const exited = new Promise((resolve) => child.once('exit', resolve));
  signalProcessTree(child, 'SIGTERM');
  await Promise.race([exited, delay(SHUTDOWN_TIMEOUT_MS)]);

  if (child.exitCode === null) {
    signalProcessTree(child, 'SIGKILL');
    await Promise.race([exited, delay(SHUTDOWN_TIMEOUT_MS)]);
  }

  child.unref();
}

const failures = [];

function check(name, ok, detail) {
  if (ok) {
    console.log(`[workerd-smoke] PASS ${name}`);
  } else {
    failures.push(name);
    console.error(`[workerd-smoke] FAIL ${name}: ${detail}`);
  }
}

async function run() {
  writeStrippedConfig();

  const child = spawn(
    'npx',
    ['wrangler', 'dev', '--config', TMP_CONFIG, '--port', String(PORT), '--show-interactive-dev-session=false'],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        // Point the HYPERDRIVE binding at the local scratch Postgres.
        // Wrangler 4.107 flags this name as deprecated in favor of the
        // CLOUDFLARE prefix, but the replacement crashes its own miniflare
        // options validation. Keep the working variable until Wrangler fixes it.
        WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: DB_URL,
        CI: 'true',
      },
    },
  );

  try {
    await waitForBoot(child);

    // 1. Anonymous health is deliberately a low-information liveness probe.
    // It must stay useful to load balancers without leaking dependency state.
    const liveness = await probe('/api/health', { headers: { accept: 'application/json' } });
    const livenessBody = parseJson(liveness.text);
    check(
      '/api/health exposes public liveness without dependency details',
      liveness.status === 200 &&
        livenessBody?.status === 'ok' &&
        livenessBody?.scope === 'liveness' &&
        !Object.hasOwn(livenessBody, 'database'),
      `status=${liveness.status} body=${liveness.text.slice(0, 200)}`,
    );

    // 2. The authorized health probe must run a REAL query and report truthfully.
    // This is the check that catches a broken Prisma engine in workerd.
    const health = await probe('/api/health', {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${HEALTH_CHECK_TOKEN}`,
      },
    });
    const healthBody = parseJson(health.text);
    check(
      '/api/health reports a working database when authorized',
      health.status === 200 && healthBody?.status === 'ok' && healthBody?.database?.ok === true,
      `status=${health.status} body=${health.text.slice(0, 200)}`,
    );

    // 3. Auth.js must have its runtime secret inside the Worker isolate. A
    // successful unauthenticated session response proves configuration without
    // manufacturing a user session for the smoke test.
    const authSession = await probe('/api/auth/session', {
      headers: { accept: 'application/json' },
    });
    check(
      'GET /api/auth/session responds without Auth.js configuration errors',
      authSession.status === 200,
      `status=${authSession.status} body=${authSession.text.slice(0, 200)}`,
    );

    // 4. The historically-broken auth path: magic-link runs user.findUnique
    // through the Prisma engine. On every broken engine config this returned
    // a 500 "Something went wrong".
    const magicLink = await probe('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'workerd-smoke@example.com' }),
    });
    check(
      'POST /api/auth/magic-link succeeds (Prisma query on workerd)',
      magicLink.status === 200 && magicLink.text.includes('"ok":true'),
      `status=${magicLink.status} body=${magicLink.text.slice(0, 200)}`,
    );

    // 5. The magic verify route must reject a bogus token without surfacing
    // raw database/engine failures.
    const magicVerify = await probe('/api/auth/magic?token=workerd-smoke-bogus');
    const verifyOk = magicVerify.status === 307 || magicVerify.status === 302;
    check(
      'GET /api/auth/magic redirects (no engine crash)',
      verifyOk,
      `status=${magicVerify.status} body=${magicVerify.text.slice(0, 200)}`,
    );

    // 6. Core pages render.
    for (const path of ['/', '/discover', '/login']) {
      const page = await probe(path);
      check(`GET ${path} returns 200`, page.status === 200, `status=${page.status}`);
    }

    // 7. Session-gated API routes reject cleanly (401, not a 500 crash).
    const notifications = await probe('/api/me/notifications');
    check(
      'GET /api/me/notifications rejects unauthenticated with 401',
      notifications.status === 401,
      `status=${notifications.status} body=${notifications.text.slice(0, 200)}`,
    );

    // 8. Performance budget. It must run against this workerd instance, not a
    // `next start` Node server, because the production Prisma configuration is
    // only representative inside workerd.
    if (process.env.SKIP_LIGHTHOUSE_BUDGET !== '1') {
      const { anyFailed } = await runLighthouseBudget({ baseUrl: BASE });
      check('Lighthouse performance budget', !anyFailed, 'see per-page output above');
    } else {
      console.log('[workerd-smoke] SKIP_LIGHTHOUSE_BUDGET=1 — skipping performance budget');
    }
  } finally {
    await stopProcessTree(child);
    rmSync(TMP_CONFIG, { force: true });
  }

  if (failures.length) {
    console.error(`[workerd-smoke] ${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log('[workerd-smoke] all checks passed');
}

run().catch((error) => {
  console.error('[workerd-smoke] fatal:', error);
  rmSync(TMP_CONFIG, { force: true });
  process.exit(1);
});
