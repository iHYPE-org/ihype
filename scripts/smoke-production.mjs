import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const baseUrl = (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://ihype.org').replace(/\/$/, '');
const smokeBypassToken = process.env.SMOKE_BYPASS_TOKEN?.trim();

const checks = [
  { path: '/', expect: [200] },
  { path: '/login', expect: [200] },
  { path: '/shows', expect: [200] },
  { path: '/status', expect: [200] },
  { path: '/api/health', expect: [200], json: true }
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
    }

    console.log(`[smoke] ${check.path} ${response.status} ${elapsed}ms`);
  } catch (error) {
    failed = true;
    console.error(`[smoke] ${check.path} failed:`, error);
  }
}

if (failed) {
  const allEdgeBlocked = statuses.length === checks.length && statuses.every((status) => status === 403);
  if (process.env.SMOKE_ALLOW_EDGE_BLOCK === '1' && allEdgeBlocked) {
    const message = '[smoke] GitHub Actions appears blocked by Cloudflare edge security; app smoke was not reachable.';
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.warn(`::warning::${message}`);
    } else {
      console.warn(message);
    }
    process.exit(0);
  }

  process.exit(1);
}
