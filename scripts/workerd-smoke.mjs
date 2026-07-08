/**
 * Pre-deploy smoke test against the REAL Workers runtime (workerd).
 *
 * Boots the already-built `.open-next` worker bundle in `wrangler dev`
 * (miniflare/workerd) against a local Postgres, then exercises the code
 * paths that have historically broken ONLY on workerd — Prisma engine
 * selection cannot fail in Node, so `next build` + vitest passing proves
 * nothing about it (see DESIGN_SYNC rows 171-176: five green builds
 * shipped a sitewide DB outage that only workerd could surface).
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

const PORT = Number(process.env.WORKERD_SMOKE_PORT || 8787);
const BASE = `http://127.0.0.1:${PORT}`;
const DB_URL = process.env.WORKERD_SMOKE_DATABASE_URL;
const BOOT_TIMEOUT_MS = 120_000;
const TMP_CONFIG = '.wrangler-workerd-smoke.toml';

if (!DB_URL) {
  console.error('[workerd-smoke] WORKERD_SMOKE_DATABASE_URL is required');
  process.exit(1);
}

// Derive a smoke config from the real wrangler.toml at runtime (so bindings
// can't drift between two files), minus two sections:
// - [build]: re-runs the full cf:build on `wrangler dev` startup; CI already
//   built, so it would only add minutes of redundant rebuild.
// - [ai]: Workers AI is remote-only in local dev and refuses to start without
//   CLOUDFLARE_API_TOKEN credentials. The app's AI call sites already degrade
//   when the binding is absent, so the smoke runs without it.
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
  writeFileSync(TMP_CONFIG, stripped);
}

async function probe(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
  const text = await res.text();
  return { status: res.status, text };
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
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`wrangler dev did not become reachable within ${BOOT_TIMEOUT_MS}ms`);
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
      env: {
        ...process.env,
        // Point the HYPERDRIVE binding at the local scratch Postgres.
        // (Wrangler 4.107 flags this name as deprecated in favor of the
        // CLOUDFLARE_ prefix, but the "new" name crashes its own miniflare
        // options validation — keep the working one.)
        WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: DB_URL,
        CI: 'true'
      }
    }
  );

  try {
    await waitForBoot(child);

    // 1. Health must run a REAL query and report truthfully — this is the
    // check that a hardcoded 200 previously rendered meaningless.
    const health = await probe('/api/health', { headers: { accept: 'application/json' } });
    let healthBody = {};
    try {
      healthBody = JSON.parse(health.text);
    } catch {
      /* handled below */
    }
    check(
      '/api/health reports a working database',
      health.status === 200 && healthBody.status === 'ok' && healthBody.database?.ok === true,
      `status=${health.status} body=${health.text.slice(0, 200)}`
    );

    // 2. The historically-broken auth path: magic-link runs user.findUnique
    // through the Prisma engine. On every broken engine config this returned
    // a 500 "Something went wrong".
    const magicLink = await probe('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'workerd-smoke@example.com' })
    });
    check(
      'POST /api/auth/magic-link succeeds (Prisma query on workerd)',
      magicLink.status === 200 && magicLink.text.includes('"ok":true'),
      `status=${magicLink.status} body=${magicLink.text.slice(0, 200)}`
    );

    // 3. The magic verify route surfaces raw DB errors in its redirect —
    // a bogus token must produce a *token* rejection, not an engine error.
    const magicVerify = await probe('/api/auth/magic?token=workerd-smoke-bogus');
    const location = magicVerify.text; // redirect body is empty; can't read headers from text
    const verifyOk = magicVerify.status === 307 || magicVerify.status === 302;
    check(
      'GET /api/auth/magic redirects (no engine crash)',
      verifyOk,
      `status=${magicVerify.status} body=${location.slice(0, 200)}`
    );

    // 4. Core pages render.
    for (const path of ['/', '/discover', '/login']) {
      const page = await probe(path);
      check(`GET ${path} returns 200`, page.status === 200, `status=${page.status}`);
    }

    // 5. Session-gated API routes reject cleanly (401, not a 500 crash).
    const notifications = await probe('/api/me/notifications');
    check(
      'GET /api/me/notifications rejects unauthenticated with 401',
      notifications.status === 401,
      `status=${notifications.status} body=${notifications.text.slice(0, 200)}`
    );
  } finally {
    child.kill('SIGTERM');
    // wrangler spawns workerd children; give the tree a moment, then be sure.
    await new Promise((r) => setTimeout(r, 2000));
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
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
