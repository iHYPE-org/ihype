import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const baseUrl = (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://ihype.org').replace(/\/$/, '');

const checks = [
  { path: '/', expect: [200], head: true },
  { path: '/login', expect: [200], head: true },
  { path: '/shows', expect: [200], head: true },
  { path: '/status', expect: [200], head: true },
  { path: '/api/health', expect: [200], json: true }
];

async function curl(url, head = false) {
  const args = ['-sS', '-L', '--max-time', '20', '-w', '\n%{http_code}'];
  if (head) args.push('-I');
  args.push(url);
  const { stdout } = await execFileAsync('curl', args, {
    maxBuffer: 1024 * 1024
  });
  const marker = stdout.lastIndexOf('\n');
  return {
    body: stdout.slice(0, marker),
    status: Number(stdout.slice(marker + 1))
  };
}

let failed = false;

for (const check of checks) {
  const started = Date.now();
  try {
    const response = await curl(`${baseUrl}${check.path}`, check.head);
    const elapsed = Date.now() - started;

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
  process.exit(1);
}
