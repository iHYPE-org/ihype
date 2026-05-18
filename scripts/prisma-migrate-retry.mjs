import { spawn } from 'node:child_process';
import path from 'node:path';

const DATABASE_URL_CANDIDATES = [
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'DATABASE_DIRECT_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL_NO_SSL',
  'DATABASE_URL_POSTGRES_URL',
  'DATABASE_URL_POSTGRES_PRISMA_URL',
  'DATABASE_URL_POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_POSTGRES_URL_NO_SSL'
];

function isPostgresUrl(value) {
  return value.startsWith('postgresql://') || value.startsWith('postgres://');
}

function resolveMigrationDatabaseUrl() {
  for (const key of DATABASE_URL_CANDIDATES) {
    const value = process.env[key]?.trim();
    if (value && isPostgresUrl(value)) {
      return { key, value };
    }
  }

  return null;
}

const migrationDatabaseUrl = resolveMigrationDatabaseUrl();

if (!migrationDatabaseUrl) {
  console.warn('No direct Postgres DATABASE_URL is configured; skipping prisma migrate deploy. Prisma generate/next build may still use a validation placeholder.');
  process.exit(0);
}

process.env.DATABASE_URL = migrationDatabaseUrl.value;

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
  console.log(`Running prisma migrate deploy with ${migrationDatabaseUrl.key} (attempt ${attempt}/${maxAttempts})...`);
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
