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
 * against this same instance. WORKERD_SMOKE_MODE can be `all` (default),
 * `security`, or `performance`, allowing CI to report the security and
 * performance gates independently without weakening either one. Set
 * SKIP_LIGHTHOUSE_BUDGET=1 to skip Lighthouse during an `all` run.
 *
 * Prerequisites (CI provides these; see .github/workflows/ci.yml):
 *   - `npm run cf:build` has already produced `.open-next/`
 *   - WORKERD_SMOKE_DATABASE_URL points at a Postgres with the schema
 *     applied (prisma db push) and pg_trgm/citext extensions created
 *
 * Usage: node scripts/workerd-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { encode } from 'next-auth/jwt';
import { runLighthouseBudget } from './lighthouse-budget.mjs';

const PORT = Number(process.env.WORKERD_SMOKE_PORT || 8787);
const BASE = `http://127.0.0.1:${PORT}`;
const DB_URL = process.env.WORKERD_SMOKE_DATABASE_URL;
const HEALTH_CHECK_TOKEN =
  process.env.WORKERD_SMOKE_CRON_SECRET || 'workerd-smoke-health-token-0123456789';
const AUTH_SECRET =
  process.env.AUTH_SECRET || 'workerd-smoke-auth-secret-0123456789';
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || AUTH_SECRET;
const RESEND_WEBHOOK_KEY = Buffer.from('ihype-workerd-resend-smoke-key-32b');
const RESEND_WEBHOOK_SECRET = `whsec_${RESEND_WEBHOOK_KEY.toString('base64')}`;
const BOOT_TIMEOUT_MS = 120_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const TMP_CONFIG = '.wrangler-workerd-smoke.toml';
const WRANGLER_CLI = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const SMOKE_MODE = process.env.WORKERD_SMOKE_MODE || 'all';
const VALID_SMOKE_MODES = new Set(['all', 'security', 'performance']);
const RUN_SECURITY_CHECKS = SMOKE_MODE !== 'performance';
const RUN_LIGHTHOUSE_BUDGET = SMOKE_MODE !== 'security';
const FIXTURE = {
  creatorId: 'workerd-smoke-creator',
  outsiderId: 'workerd-smoke-outsider',
  profileId: 'clx0000000000000000000000',
  showId: 'workerd-smoke-ticketed-show',
  showSlug: 'workerd-smoke-ticketed-show',
  mediaHexId: '0xabc123deadbeef',
  outsiderEmail: 'outsider-private@example.com',
  privateMessage: 'OUTSIDER_PRIVATE_MESSAGE_DO_NOT_EXPORT',
  rawStorageMarker: 'https://storage.invalid/RAW_PRIVATE_MEDIA_MARKER.mp3',
};

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
  return varsSection.replace(/(\r?\n\[vars\]\r?\n)/, (header) => `${header}${assignment}\n`);
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
    stripped = stripped.replace(new RegExp(`\\r?\\n\\[${section}\\][\\s\\S]*?(?=\\r?\\n\\[|$)`), '\n');
    if (stripped === before) {
      console.warn(`[workerd-smoke] no [${section}] section found to strip; continuing`);
    }
  }

  const varsPattern = /\r?\n\[vars\]\r?\n[\s\S]*?(?=\r?\n\[|$)/;
  let varsSection = stripped.match(varsPattern)?.[0];
  if (!varsSection) {
    throw new Error('wrangler.toml must contain a [vars] section for Workerd smoke configuration');
  }

  for (const [name, value] of Object.entries({
    CRON_SECRET: HEALTH_CHECK_TOKEN,
    DATABASE_URL: DB_URL,
    AUTH_SECRET,
    NEXTAUTH_SECRET,
    RESEND_WEBHOOK_SECRET,
  })) {
    varsSection = upsertTomlVariable(varsSection, name, value);
  }
  varsSection = varsSection.replace(/(?:\r?\n){3,}/g, '\n\n');
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

async function seedSecurityFixtures() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  const now = new Date();
  const productionPlan = {
    mediaItems: [{
      mediaId: FIXTURE.mediaHexId,
      title: 'Protected smoke track',
      url: FIXTURE.rawStorageMarker,
      artistProfileId: FIXTURE.profileId,
      artistName: 'Smoke Artist',
      mediaType: 'audio',
    }],
    voiceOvers: [],
    samplePads: [],
    sequence: [{ id: 'track-one', kind: 'MEDIA', refId: FIXTURE.mediaHexId, label: 'Protected track' }],
    advertising: { enabled: false, scope: 'local', frequency: 3, clips: [] },
  };

  try {
    // Security and performance run as separate mandatory CI steps against the
    // same scratch database. Re-seeding must therefore be deterministic. Only
    // remove the fixed smoke records we own, in foreign-key order; never clear
    // or truncate shared tables.
    await client.query('BEGIN');
    await client.query(`DELETE FROM "BookingRequest" WHERE "id" = 'workerd-smoke-booking'`);
    await client.query(`DELETE FROM "Follow" WHERE "id" = 'workerd-smoke-follow'`);
    await client.query(`DELETE FROM "Show" WHERE "id" = $1`, [FIXTURE.showId]);
    await client.query(`DELETE FROM "ArtistMediaAsset" WHERE "id" = 'workerd-smoke-asset'`);
    await client.query(`DELETE FROM "Profile" WHERE "id" = $1`, [FIXTURE.profileId]);
    await client.query(`DELETE FROM "User" WHERE "id" = ANY($1::text[])`, [[FIXTURE.creatorId, FIXTURE.outsiderId]]);

    await client.query(
      `INSERT INTO "User" ("id", "name", "email", "username", "role", "isThirteenOrOlder", "emailVerified", "userSecurityVersion", "createdAt", "updatedAt")
       VALUES ($1, 'Smoke Creator', 'creator-smoke@example.com', 'smokecreator', 'ARTIST'::"Role", true, $3, 0, $3, $3),
              ($2, 'Smoke Outsider', $4, 'smokeoutsider', 'FAN'::"Role", true, $3, 0, $3, $3)`,
      [FIXTURE.creatorId, FIXTURE.outsiderId, now, FIXTURE.outsiderEmail],
    );
    await client.query(
      `INSERT INTO "Profile" ("id", "slug", "hexId", "type", "name", "ownerId", "genres", "createdAt", "updatedAt")
       VALUES ($1, 'smoke-artist', '0xsmokeartist', 'ARTIST'::"ProfileType", 'Smoke Artist', $2, ARRAY['test']::TEXT[], $3, $3)`,
      [FIXTURE.profileId, FIXTURE.creatorId, now],
    );
    await client.query(
      `INSERT INTO "ArtistMediaAsset" ("id", "hexId", "title", "originalFileName", "mimeType", "fileSizeBytes", "fileDataBase64", "storageProvider", "freeUseEnabled", "sortOrder", "profileId", "isPublished", "createdAt", "updatedAt")
       VALUES ('workerd-smoke-asset', $1, 'Protected smoke track', 'smoke.mp3', 'audio/mpeg', 10, $2, 'database', false, 0, $3, true, $4, $4)`,
      [FIXTURE.mediaHexId, Buffer.from('ID3SMOKE').toString('base64'), FIXTURE.profileId, now],
    );
    await client.query(
      `INSERT INTO "Show" ("id", "slug", "title", "status", "startsAt", "creatorId", "isTicketed", "ticketPriceCents", "venuePayoutPercent", "artistPayoutPercent", "ticketsSoldCount", "hypeCount", "tags", "isRadioShow", "promoterPayoutPercent", "productionPlan", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Protected Workerd Smoke Show', 'SCHEDULED'::"ShowStatus", $3, $4, true, 1000, 50, 45, 0, 0, ARRAY['test']::TEXT[], false, 5, $5::jsonb, $6, $6)`,
      [FIXTURE.showId, FIXTURE.showSlug, new Date(now.getTime() + 86_400_000), FIXTURE.creatorId, JSON.stringify(productionPlan), now],
    );
    await client.query(
      `INSERT INTO "Follow" ("id", "followerId", "followeeProfileId", "notifyShows", "createdAt")
       VALUES ('workerd-smoke-follow', $1, $2, true, $3)`,
      [FIXTURE.outsiderId, FIXTURE.profileId, now],
    );
    await client.query(
      `INSERT INTO "BookingRequest" ("id", "fromUserId", "toProfileId", "message", "status", "createdAt", "updatedAt")
       VALUES ('workerd-smoke-booking', $1, $2, $3, 'pending', $4, $4)`,
      [FIXTURE.outsiderId, FIXTURE.profileId, FIXTURE.privateMessage, now],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function buildSmokeSessionCookie({ userId, email, role }) {
  const cookieName = '__Secure-authjs.session-token';
  const now = Math.floor(Date.now() / 1000);
  const value = await encode({
    token: {
      sub: userId,
      name: userId,
      email,
      role,
      emailVerified: new Date().toISOString(),
      securityVersion: 0,
      iat: now,
      exp: now + 3600,
      jti: `workerd-smoke-${userId}`,
    },
    secret: AUTH_SECRET,
    salt: cookieName,
    maxAge: 3600,
  });
  return `${cookieName}=${value}`;
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
  if (!VALID_SMOKE_MODES.has(SMOKE_MODE)) {
    throw new Error(
      `Invalid WORKERD_SMOKE_MODE=${SMOKE_MODE}; expected all, security, or performance`,
    );
  }

  writeStrippedConfig();
  await seedSecurityFixtures();
  const creatorCookie = await buildSmokeSessionCookie({
    userId: FIXTURE.creatorId,
    email: 'creator-smoke@example.com',
    role: 'ARTIST',
  });
  const outsiderCookie = await buildSmokeSessionCookie({
    userId: FIXTURE.outsiderId,
    email: FIXTURE.outsiderEmail,
    role: 'FAN',
  });

  const child = spawn(
    process.execPath,
    [WRANGLER_CLI, 'dev', '--config', TMP_CONFIG, '--port', String(PORT), '--show-interactive-dev-session=false'],
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

    if (RUN_SECURITY_CHECKS) {
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

    // 2b. Exercise the actual bundled Resend route with Svix's key format,
    // then replay the same signed event to prove the database idempotency
    // marker works in Workerd too. This catches both crypto/polyfill drift and
    // accidental regressions back to hashing with the literal `whsec_` value.
    const resendId = `msg_workerd_smoke_${Date.now()}`;
    const resendTimestamp = String(Math.floor(Date.now() / 1000));
    const resendPayload = JSON.stringify({
      type: 'email.delivered',
      data: { to: ['workerd-smoke@example.com'] },
    });
    const resendSignature = createHmac('sha256', RESEND_WEBHOOK_KEY)
      .update(`${resendId}.${resendTimestamp}.${resendPayload}`)
      .digest('base64');
    const resendRequest = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': resendId,
        'svix-timestamp': resendTimestamp,
        'svix-signature': `v1,${resendSignature}`,
      },
      body: resendPayload,
    };
    const resendFirst = await probe('/api/webhooks/resend', resendRequest);
    const resendFirstBody = parseJson(resendFirst.text);
    check(
      'Resend webhook accepts a valid Svix signature in Workerd',
      resendFirst.status === 200 && resendFirstBody?.ok === true && resendFirstBody?.duplicate === false,
      `status=${resendFirst.status} body=${resendFirst.text.slice(0, 200)}`,
    );
    const resendReplay = await probe('/api/webhooks/resend', resendRequest);
    const resendReplayBody = parseJson(resendReplay.text);
    check(
      'Resend webhook deduplicates a replay in Workerd',
      resendReplay.status === 200 && resendReplayBody?.ok === true && resendReplayBody?.duplicate === true,
      `status=${resendReplay.status} body=${resendReplay.text.slice(0, 200)}`,
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

    // 6b. Server-rendered translations must actually resolve INSIDE workerd.
    //
    // The dictionaries are not bundled into the Worker — they are fetched from
    // the ASSETS binding (see src/lib/i18n/server.ts). That is what keeps the
    // script under Cloudflare's size limit, but it means a bundling or asset
    // path regression breaks translation at runtime while every other check
    // still passes. Exactly that nearly shipped: an `await import()` version of
    // this module typechecked, linted and passed all 345 unit tests while
    // silently serving English on every server-rendered page, because the split
    // chunks were never uploaded.
    //
    // /discover is a server component that renders discoverPage.kicker
    // unconditionally, so asking for it with the locale cookie set is a direct
    // test of the asset fetch path.
    const spanishDiscover = await probe('/discover', {
      headers: { cookie: 'ihype_locale=es' },
    });
    check(
      'server-rendered page resolves a real translation from the ASSETS binding',
      spanishDiscover.status === 200 && spanishDiscover.text.includes('DESCUBRIR'),
      `status=${spanishDiscover.status} — expected the Spanish discoverPage.kicker ("DESCUBRIR") in server HTML. ` +
        'Seeing the English "DISCOVER" instead means the dictionary fetch failed and every locale is falling back to English.',
    );

    // 7. Session-gated API routes reject cleanly (401, not a 500 crash).
    const notifications = await probe('/api/me/notifications');
    check(
      'GET /api/me/notifications rejects unauthenticated with 401',
      notifications.status === 401,
      `status=${notifications.status} body=${notifications.text.slice(0, 200)}`,
    );

    // 8. Legacy user-ID bootstrap cookies must not authorize passkey setup.
    const forgedBootstrap = await probe('/api/auth/passkey/register-first', {
      headers: { cookie: `pk_reg_first_uid=${FIXTURE.creatorId}` },
    });
    check(
      'forged legacy passkey bootstrap cookie is rejected',
      forgedBootstrap.status === 400,
      `status=${forgedBootstrap.status} body=${forgedBootstrap.text.slice(0, 200)}`,
    );

    // 9. Ticketed show plans and raw storage URLs stay out of unauthorized RSC/HTML.
    const anonymousShow = await probe(`/shows/${FIXTURE.showSlug}`);
    check(
      'anonymous ticketed show response contains no protected media plan',
      anonymousShow.status === 200 &&
        !anonymousShow.text.includes(FIXTURE.rawStorageMarker) &&
        !anonymousShow.text.includes(`/api/shows/${FIXTURE.showId}/media/${FIXTURE.mediaHexId}`),
      `status=${anonymousShow.status}`,
    );
    const outsiderShow = await probe(`/shows/${FIXTURE.showSlug}`, {
      headers: { cookie: outsiderCookie },
    });
    check(
      'authenticated non-buyer receives no protected media plan',
      outsiderShow.status === 200 &&
        !outsiderShow.text.includes(FIXTURE.rawStorageMarker) &&
        !outsiderShow.text.includes(`/api/shows/${FIXTURE.showId}/media/${FIXTURE.mediaHexId}`),
      `status=${outsiderShow.status}`,
    );
    const creatorShow = await probe(`/shows/${FIXTURE.showSlug}`, {
      headers: { cookie: creatorCookie },
    });
    check(
      'show creator receives only the entitlement-checking media URL',
      creatorShow.status === 200 &&
        creatorShow.text.includes(`/api/shows/${FIXTURE.showId}/media/${FIXTURE.mediaHexId}`) &&
        !creatorShow.text.includes(FIXTURE.rawStorageMarker),
      `status=${creatorShow.status}`,
    );

    // 10. The media endpoint independently enforces entitlement.
    const outsiderMedia = await probe(`/api/shows/${FIXTURE.showId}/media/${FIXTURE.mediaHexId}`, {
      headers: { cookie: outsiderCookie },
    });
    check(
      'ticketed media rejects an authenticated non-buyer',
      outsiderMedia.status === 403,
      `status=${outsiderMedia.status} body=${outsiderMedia.text.slice(0, 200)}`,
    );
    const creatorMedia = await probe(`/api/shows/${FIXTURE.showId}/media/${FIXTURE.mediaHexId}`, {
      headers: { cookie: creatorCookie },
    });
    check(
      'ticketed media streams for the show creator',
      creatorMedia.status === 200 && creatorMedia.text.includes('ID3SMOKE'),
      `status=${creatorMedia.status} body=${creatorMedia.text.slice(0, 100)}`,
    );

    // 11. A user's export must not contain another person's identity or message.
    const privacyExport = await probe('/api/privacy/export', {
      headers: { cookie: creatorCookie, accept: 'application/json' },
    });
    check(
      'privacy export excludes third-party personal data',
      privacyExport.status === 200 &&
        !privacyExport.text.includes(FIXTURE.outsiderEmail) &&
        !privacyExport.text.includes(FIXTURE.outsiderId) &&
        !privacyExport.text.includes(FIXTURE.privateMessage),
      `status=${privacyExport.status} body=${privacyExport.text.slice(0, 200)}`,
    );

    // 12. Embed pages deliberately opt into framing without weakening other pages.
    const embed = await probe('/embed/does-not-exist');
    const embedCsp = embed.headers.get('content-security-policy') ?? '';
    check(
      'embed route permits framing through CSP and omits X-Frame-Options',
      embedCsp.includes('frame-ancestors *') && !embed.headers.has('x-frame-options'),
      `status=${embed.status} csp=${embedCsp}`,
    );
    } else {
      console.log('[workerd-smoke] mode=performance — skipping security checks');
    }

    // 13. Performance budget. It must run against this workerd instance, not a
    // `next start` Node server, because the production Prisma configuration is
    // only representative inside workerd.
    if (RUN_LIGHTHOUSE_BUDGET && process.env.SKIP_LIGHTHOUSE_BUDGET !== '1') {
      const { report, anyFailed, infrastructureError, enforced } = await runLighthouseBudget({
        baseUrl: BASE,
        authenticatedHeaders: { Cookie: creatorCookie },
      });
      // Name the page and the metric in this line. It is the one line that
      // ends up in the smoke summary, and "see per-page output above" meant
      // scrolling a few hundred KB of wrangler request logs to learn that one
      // page missed one budget by one hundredth.
      const over = report
        .flatMap((entry) => entry.failures.map((failure) => `${entry.path}: ${failure.message}`))
        .join('; ');

      if (enforced) {
        check('Lighthouse performance budget', !anyFailed, over || 'see per-page output above');
      } else {
        // Deliberately NOT a check(). Recording a pass here would assert that
        // the budget held, which is exactly what a non-enforcing run does not
        // verify — and a smoke summary that says PASS on an unmeasured or
        // breached budget is worse than one that says nothing. The numbers are
        // in the job summary either way; see the ENFORCE comment in
        // scripts/lighthouse-budget.mjs for why this no longer gates.
        if (infrastructureError) {
          console.log('[workerd-smoke] performance budget NOT MEASURED (reporting only) — ' +
            infrastructureError.message);
        } else if (anyFailed) {
          console.log(`[workerd-smoke] performance budget EXCEEDED (reporting only) — ${over}`);
        } else {
          console.log('[workerd-smoke] performance budget within limits (reporting only)');
        }
        console.log('[workerd-smoke] set LIGHTHOUSE_BUDGET_ENFORCE=1 to make this gate the build');
      }
    } else if (!RUN_LIGHTHOUSE_BUDGET) {
      console.log('[workerd-smoke] mode=security — skipping performance budget');
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
