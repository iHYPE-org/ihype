import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const baseUrl = (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://ihype.org').replace(/\/$/, '');
const smokeBypassToken = process.env.SMOKE_BYPASS_TOKEN?.trim();
const smokeRelayUrl = process.env.SMOKE_RELAY_URL?.trim();
const requireLaunchReady = process.env.SMOKE_REQUIRE_LAUNCH_READY === '1';

const checks = [
  { path: '/', expect: [200] },
  { path: '/login', expect: [200] },
  { path: '/info', expect: [200] },
  { path: '/listen', expect: [200] },
  { path: '/pages', expect: [200] },
  { path: '/status', expect: [200] },
  { path: '/api/health', expect: [200], json: true },
  // The legacy legal aliases, which ship inside signup consent copy, the
  // cookie banner, sent email and the app-store listings — so they are the
  // URLs least likely to be clicked by anyone working on the app, and the most
  // expensive to have broken. Bare `/legal` returned a hard 500 on production
  // for weeks: a `has` regex that matched the empty string, which OpenNext
  // accepts and `next start` does not, so it reproduced nowhere but here.
  // Followed with -L, so a broken redirect surfaces as the alias failing
  // rather than as its target.
  { path: '/legal', expect: [200] },
  { path: '/legal?tab=privacy', expect: [200] },
  { path: '/privacy', expect: [200] },
  { path: '/terms', expect: [200] },
  { path: '/charter', expect: [200] }
];

async function curl(url, json = false) {
  const args = [
    '-sS',
    '-L',
    '--compressed',
    '--max-time',
    '20',
    '-A',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    '-H',
    json
      ? 'Accept: application/json'
      : 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H',
    'Accept-Language: en-US,en;q=0.9',
    '-w',
    '\n%{http_code}'
  ];
  if (smokeBypassToken) {
    args.push('-H', `x-ihype-smoke-test: ${smokeBypassToken}`);
  }
  // With a CRON_SECRET bearer, /api/health returns the full snapshot (real DB
  // counts + integration readiness) instead of the minimal public probe.
  if (json && process.env.SMOKE_HEALTH_BEARER?.trim()) {
    args.push('-H', `Authorization: Bearer ${process.env.SMOKE_HEALTH_BEARER.trim()}`);
  }
  args.push(url);
  const { stdout } = await execFileAsync('curl', args, {
    maxBuffer: 5 * 1024 * 1024
  });
  const marker = stdout.lastIndexOf('\n');
  return {
    body: stdout.slice(0, marker),
    status: Number(stdout.slice(marker + 1))
  };
}

async function relaySmoke() {
  if (!smokeRelayUrl || !process.env.SMOKE_HEALTH_BEARER?.trim()) return false;
  const { stdout } = await execFileAsync('curl', [
    '-sS',
    '--compressed',
    '--max-time',
    '45',
    '-X',
    'POST',
    '-H',
    'Accept: application/json',
    '-H',
    `Authorization: Bearer ${process.env.SMOKE_HEALTH_BEARER.trim()}`,
    '-w',
    '\n%{http_code}',
    smokeRelayUrl,
  ], { maxBuffer: 5 * 1024 * 1024 });
  const marker = stdout.lastIndexOf('\n');
  const body = stdout.slice(0, marker);
  const status = Number(stdout.slice(marker + 1));
  const payload = JSON.parse(body);
  if (status !== 200 || payload.ok !== true) {
    console.error(`[smoke] Cloudflare relay failed (${status}): ${body}`);
    return false;
  }
  console.log(`[smoke] Cloudflare relay passed ${payload.checks?.length ?? 0} live checks`);
  return true;
}

let failed = false;
const statuses = [];

for (const check of checks) {
  const started = Date.now();
  try {
    const response = await curl(`${baseUrl}${check.path}`, check.json);
    const elapsed = Date.now() - started;
    statuses.push(response.status);

    if (!check.expect.includes(response.status)) {
      failed = true;
      console.error(`[smoke] ${check.path} returned ${response.status}, expected ${check.expect.join('/')}`);
      continue;
    }

    if (check.json) {
      const payload = JSON.parse(response.body);
      if (payload.status !== 'ok' || payload.database?.ok !== true) {
        failed = true;
        console.error(`[smoke] ${check.path} health failed: ${JSON.stringify(payload)}`);
        continue;
      }
      if (requireLaunchReady && payload.launchReadiness?.ready !== true) {
        failed = true;
        console.error(
          `[smoke] ${check.path} launch readiness failed: ${JSON.stringify(payload.launchReadiness?.blockers ?? [])}`,
        );
        continue;
      }
    }

    console.log(`[smoke] ${check.path} ${response.status} ${elapsed}ms`);
  } catch (error) {
    failed = true;
    console.error(`[smoke] ${check.path} failed:`, error);
  }
}

if (failed) {
  const allEdgeBlocked = statuses.length === checks.length && statuses.every((status) => status === 403);
  if (allEdgeBlocked) {
    try {
      if (await relaySmoke()) {
        console.warn('[smoke] GitHub runner was edge-blocked; authenticated Cloudflare relay verified production.');
        process.exit(0);
      }
    } catch (error) {
      console.error('[smoke] Cloudflare relay request failed:', error);
    }
  }
  if (process.env.SMOKE_ALLOW_EDGE_BLOCK === '1' && allEdgeBlocked) {
    const message =
      '[smoke] PRODUCTION WAS NOT VALIDATED. Every check returned 403 — Cloudflare edge security blocks this runner, ' +
      'so this deploy shipped without any post-deploy verification. To fix: create a Cloudflare WAF skip rule matching ' +
      'the x-ihype-smoke-test header and set the same value as the SMOKE_BYPASS_TOKEN repo secret. ' +
      'Until then, the pre-deploy workerd smoke stage in CI is the only real gate.';
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.warn(`::warning::${message}`);
    } else {
      console.warn(message);
    }
    process.exit(1);
  }

  process.exit(1);
}
