/**
 * Runs the authenticated Playwright e2e suite (auth.spec.ts, passkey.spec.ts,
 * etc.) against the REAL Workers runtime (workerd) instead of `next dev`.
 *
 * Why this exists: src/lib/db.ts intentionally imports the wasm/workerd-only
 * Prisma query engine (see the comment at the top of that file — plain
 * '@prisma/client' silently picks the wrong engine in a real Workers build,
 * which caused a documented production outage). That engine cannot load
 * under plain `next dev`. auth()'s jwt callback does a DB read on every
 * request (not just sign-in), so under `next dev` every authenticated
 * request 401s — no authenticated e2e test can ever pass there, regardless
 * of secrets. playwright.config.ts's default webServer (`npm run dev`) is
 * fine for the always-on public-smoke suite (no auth, no DB reads on the
 * paths it hits) but cannot support this suite.
 *
 * Boot/teardown here deliberately mirrors scripts/workerd-smoke.mjs's
 * proven approach (stripped wrangler config, WRANGLER_HYPERDRIVE_LOCAL_
 * CONNECTION_STRING_HYPERDRIVE for local Postgres, boot-then-poll,
 * SIGTERM-then-SIGKILL process-tree teardown) rather than reinventing it,
 * since that script already solves the same "boot a real workerd instance
 * in CI" problem for a different purpose.
 *
 * Prerequisites (CI provides these; see .github/workflows/ci.yml):
 *   - `npm run cf:build` has already produced `.open-next/`, built with
 *     NEXT_PUBLIC_BASE_URL/NEXT_PUBLIC_APP_URL matching E2E_WORKERD_PORT
 *     below — NEXT_PUBLIC_* values are inlined into the bundle at build
 *     time, so a mismatch here breaks anything origin-sensitive (WebAuthn
 *     registration/auth checks the request origin against this value).
 *   - E2E_WORKERD_DATABASE_URL points at a Postgres with the schema applied
 *     (prisma db push) and pg_trgm/citext extensions created.
 *
 * Usage: node scripts/e2e-workerd.mjs [optional Playwright test files]
 * Example: node scripts/e2e-workerd.mjs e2e/auth.spec.ts
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.E2E_WORKERD_PORT || 8787);
// Must be 'localhost', not '127.0.0.1': WebAuthn RP IDs (derived from this
// URL's hostname in src/lib/passkey.ts's getRpInfo()) cannot be raw IP
// addresses — browsers reject registration with "invalid domain". 'localhost'
// is the one hostname browsers specifically carve out an exception for.
const BASE = `http://localhost:${PORT}`;
const DB_URL = process.env.E2E_WORKERD_DATABASE_URL;
const AUTH_SECRET = process.env.AUTH_SECRET || 'e2e-workerd-auth-secret-0123456789';
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || AUTH_SECRET;
const BOOT_TIMEOUT_MS = 120_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const TMP_CONFIG = '.wrangler-e2e-workerd.toml';
const WRANGLER_CLI = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const PLAYWRIGHT_CLI = join(process.cwd(), 'node_modules', 'playwright', 'cli.js');
const REQUESTED_TESTS = process.argv.slice(2);
// /ui-preview intentionally 404s in production builds, so its responsive
// suite belongs to CI's mandatory `next dev` responsive stage. Keep it out of
// the default Workerd pass while still allowing an explicit file argument for
// local preview debugging. Each default shard gets a fresh workerd process:
// the production bundle is intentionally large and a single long-lived local
// isolate can retain compiled route modules until it reaches workerd's V8 heap
// ceiling. Fresh isolates mirror separate production requests more closely
// and keep a real runtime failure from being hidden behind a larger heap.
// The app-shell, app-shell-a11y, mobile-shell and module-deck specs were
// removed here along with the surfaces they tested (operator decision,
// 2026-08-05 — the 82px-header shell, the phone swipe shell and the six-module
// deck are all retired). Their assertions were about chrome that no longer
// exists; leaving them would have turned CI red for describing the past
// correctly. The accessibility coverage they carried is the gap that matters —
// see HANDOFF-mmm-cutover.md.
// NOTE: this list is an ALLOWLIST, not a glob — a new spec file added to e2e/
// does not run in CI until its name appears here. A contract suite that never
// executes protects nothing while looking green, so add the file in the same
// commit that adds the spec.
const DEFAULT_TEST_SHARDS = [
  ['e2e/accessibility.spec.ts'],
  ['e2e/auth.spec.ts', 'e2e/passkey.spec.ts'],
  ['e2e/mmm-shell.spec.ts'],
  ['e2e/public-smoke.spec.ts'],
];
const TEST_SHARDS = REQUESTED_TESTS.length > 0
  ? [REQUESTED_TESTS]
  : DEFAULT_TEST_SHARDS;

if (!DB_URL) {
  console.error('[e2e-workerd] E2E_WORKERD_DATABASE_URL is required');
  process.exit(1);
}

function tomlString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function upsertTomlVariable(varsSection, name, value) {
  const assignment = `${name} = "${tomlString(value)}"`;
  const pattern = new RegExp(`^${name}\\s*=.*$`, 'm');
  if (pattern.test(varsSection)) return varsSection.replace(pattern, assignment);
  return varsSection.replace(/\[vars\]\r?\n/, (m) => `${m}${assignment}\n`);
}

// Derived from the real wrangler.toml at runtime, same rationale as
// workerd-smoke.mjs's writeStrippedConfig(): bindings can't drift between
// two hand-maintained files, minus [build] (would redundantly rerun cf:build
// on `wrangler dev` startup) and [ai] (remote-only, refuses to start
// without CLOUDFLARE_API_TOKEN; app call sites already degrade without it).
function writeStrippedConfig() {
  const source = readFileSync('wrangler.toml', 'utf8');
  let stripped = source;
  for (const section of ['build', 'ai']) {
    stripped = stripped.replace(new RegExp(`\\r?\\n\\[${section}\\][\\s\\S]*?(?=\\r?\\n\\[|$)`), '\n');
  }

  const varsPattern = /\r?\n\[vars\]\r?\n[\s\S]*?(?=\r?\n\[|$)/;
  let varsSection = stripped.match(varsPattern)?.[0];
  if (!varsSection) {
    throw new Error('wrangler.toml must contain a [vars] section for e2e-workerd configuration');
  }

  for (const [name, value] of Object.entries({
    DATABASE_URL: DB_URL,
    AUTH_SECRET,
    NEXTAUTH_SECRET,
    AUTH_URL: BASE,
    NEXT_PUBLIC_APP_URL: BASE,
    NEXT_PUBLIC_BASE_URL: BASE,
  })) {
    varsSection = upsertTomlVariable(varsSection, name, value);
  }
  stripped = stripped.replace(varsPattern, varsSection);

  writeFileSync(TMP_CONFIG, stripped);
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
    if (process.platform !== 'win32') {
      process.kill(-child.pid, signal);
      return;
    }

    // Node's child.kill() only signals the immediate Wrangler process on
    // Windows; the workerd grandchild can keep the port and heap alive. CI is
    // Linux, but local Windows verification must be truthful too, so terminate
    // the exact spawned process tree. /F is required because Windows has no
    // portable SIGTERM equivalent for console process trees.
    const result = spawnSync(
      'taskkill.exe',
      ['/pid', String(child.pid), '/t', '/f'],
      { stdio: 'ignore', windowsHide: true },
    );
    if (result.error) throw result.error;
  } catch (error) {
    if (error?.code !== 'ESRCH' && error?.code !== 'ENOENT') throw error;
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

function runPlaywright(tests) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [PLAYWRIGHT_CLI, 'test', '--project=chromium', '--workers=1', ...tests],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: BASE,
          PLAYWRIGHT_EXTERNAL_SERVER: 'true',
          // The built worker always runs with production semantics
          // (useSecureAuthCookies() in src/lib/auth-cookie.ts checks
          // NODE_ENV === 'production'), so the session cookie NextAuth
          // reads/writes is __Secure-authjs.session-token here, unlike the
          // plain authjs.session-token that `next dev` uses.
          PLAYWRIGHT_AUTH_COOKIE_SECURE: 'true',
        },
      },
    );
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function runShard(tests, index) {
  const child = spawn(
    // Launch the pinned local CLIs through the current Node executable. This
    // avoids platform-specific npx/.cmd process handling and guarantees the
    // runtime suite exercises the dependency versions in package-lock.json.
    process.execPath,
    [WRANGLER_CLI, 'dev', '--config', TMP_CONFIG, '--port', String(PORT), '--show-interactive-dev-session=false'],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        // See workerd-smoke.mjs for why this specific (deprecated-but-working)
        // variable name is used instead of the documented CLOUDFLARE_ prefix.
        WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: DB_URL,
        CI: 'true',
      },
    },
  );

  let exitCode = 1;
  try {
    await waitForBoot(child);
    console.log(`[e2e-workerd] Ready on ${BASE}; shard ${index + 1}/${TEST_SHARDS.length}: ${tests.join(', ')}`);
    exitCode = await runPlaywright(tests);
  } catch (error) {
    console.error('[e2e-workerd]', error);
    exitCode = 1;
  } finally {
    await stopProcessTree(child);
  }

  return exitCode;
}

async function run() {
  writeStrippedConfig();

  let exitCode = 0;
  try {
    for (const [index, tests] of TEST_SHARDS.entries()) {
      exitCode = await runShard(tests, index);
      if (exitCode !== 0) break;
      // Give the operating system a moment to release the listening socket
      // before the next fresh workerd process binds the same port.
      await delay(500);
    }
  } finally {
    rmSync(TMP_CONFIG, { force: true });
  }

  process.exit(exitCode);
}

run();
