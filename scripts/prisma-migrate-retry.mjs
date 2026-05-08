import { spawn } from 'node:child_process';
import path from 'node:path';

const maxAttempts = Number.parseInt(process.env.PRISMA_MIGRATE_ATTEMPTS ?? '5', 10);
const retryDelayMs = Number.parseInt(process.env.PRISMA_MIGRATE_RETRY_DELAY_MS ?? '15000', 10);
const prismaBin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runMigrateDeploy() {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(prismaBin, ['migrate', 'deploy'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
}

function isRetryableMigrationLock(output) {
  return output.includes('P1002') || output.includes('pg_advisory_lock');
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`Running prisma migrate deploy (attempt ${attempt}/${maxAttempts})...`);
  const result = await runMigrateDeploy();

  if (result.code === 0) {
    process.exit(0);
  }

  if (attempt === maxAttempts || !isRetryableMigrationLock(result.output)) {
    process.exit(result.code);
  }

  console.log(`Prisma migration lock was busy; retrying in ${Math.round(retryDelayMs / 1000)}s...`);
  await wait(retryDelayMs);
}
