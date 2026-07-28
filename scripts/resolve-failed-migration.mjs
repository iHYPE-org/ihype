#!/usr/bin/env node
/**
 * Recover from Prisma error P3009 — "migrate found failed migrations in the
 * target database, new migrations will not be applied".
 *
 * What P3009 actually means
 * ------------------------
 * `_prisma_migrations` holds a row with finished_at = NULL for some migration.
 * Prisma then refuses to apply ANY further migration, which in this repo means
 * `.github/workflows/deploy-production.yml` fails at the migrate step and
 * skips every step after it — including the Cloudflare deploy. One bad
 * bookkeeping row stops all production deploys, not just schema changes.
 *
 * The usual cause here is DDL applied out of band (a Supabase MCP
 * `apply_migration` call, or a hand-run statement in the SQL editor) that
 * later re-ran through `prisma migrate deploy` and collided with itself —
 * typically SQLSTATE 42710 (duplicate_object) from a CREATE TYPE, or 42701
 * (duplicate_column) from an ADD COLUMN. The schema is already in the intended
 * state; only Prisma's record of it is wrong.
 *
 * What this script does
 * ---------------------
 * Marks the named migration as applied, which is correct ONLY when the
 * migration's DDL is genuinely already in the database. It refuses to run
 * unless `prisma migrate status` currently reports that exact migration as
 * failed, so it cannot be pointed at an arbitrary migration to skip it.
 *
 * It does NOT verify that the migration's objects exist — that is a judgement
 * call about SQL this script cannot read semantically. Confirm it yourself
 * first (the failed migration's own SQL tells you what to look for). If the
 * DDL did NOT land, you want `prisma migrate resolve --rolled-back <name>`
 * instead, so the migration re-runs on the next deploy.
 *
 * Usage
 * -----
 *   DATABASE_URL=<direct, non-pooled URL> \
 *     node scripts/resolve-failed-migration.mjs <migration_name>
 *
 * In CI, the "Resolve a failed migration" workflow runs this with the repo's
 * own DIRECT_URL secret, so nobody needs the credential locally.
 */

import { spawnSync } from 'node:child_process';

const migrationName = process.argv[2]?.trim();

if (!migrationName) {
  console.error('Usage: node scripts/resolve-failed-migration.mjs <migration_name>');
  console.error('Example: node scripts/resolve-failed-migration.mjs 20260726120000_add_advertiser_category_pitch');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Supply the DIRECT (non-pooled) connection string —');
  console.error('migrate commands must not go through the connection pooler.');
  process.exit(1);
}

function prisma(args) {
  return spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    env: process.env,
  });
}

console.log(`Checking migration state before touching anything…\n`);
const status = prisma(['migrate', 'status']);
const statusText = `${status.stdout ?? ''}${status.stderr ?? ''}`;
console.log(statusText.trim());

/**
 * `migrate status` exits non-zero whenever anything is off — including the
 * ordinary "migrations not yet applied" case — so the exit code is not the
 * signal. Parse the names instead. Prisma states this two different ways
 * depending on the command, and both were confirmed against a real Postgres
 * reproducing this exact failure:
 *
 *   migrate status:  Following migration have failed:
 *                    <name>
 *                    <name>
 *
 *   migrate deploy:  The `<name>` migration started at <ts> failed
 *
 * (The "migration have" grammar is Prisma's, and it varies by version — hence
 * the tolerant `migrations?` match.)
 */
function collectFailedMigrations(text) {
  const failed = new Set();

  const block = text.match(/Following migrations? have failed:\s*\n([\s\S]*?)\n\s*\n/i);
  if (block) {
    for (const line of block[1].split('\n')) {
      const name = line.trim();
      if (name) failed.add(name);
    }
  }

  for (const m of text.matchAll(/The `([^`]+)` migration started at [^\n]*failed/g)) {
    failed.add(m[1]);
  }

  return failed;
}

const failedMigrations = collectFailedMigrations(statusText);
const failedHere = failedMigrations.has(migrationName);

if (!failedHere) {
  console.error(`\nRefusing to resolve: "${migrationName}" is not reported as failed above.`);
  console.error(
    failedMigrations.size > 0
      ? `Prisma reports these as failed: ${[...failedMigrations].join(', ')}`
      : 'Prisma reports no failed migrations at all — there is nothing to recover.'
  );
  console.error('This script only recovers a migration that Prisma itself says is stuck.');
  console.error('Marking a migration applied when it is not would silently skip its DDL forever.');
  process.exit(1);
}

console.log(`\n"${migrationName}" is in a failed state. Marking it as applied.`);
console.log('This is correct ONLY if its DDL is already present in the database.\n');

const resolve = prisma(['migrate', 'resolve', '--applied', migrationName]);
process.stdout.write(resolve.stdout ?? '');
process.stderr.write(resolve.stderr ?? '');

if (resolve.status !== 0) {
  console.error('\nResolve failed. The database is unchanged; deploys stay blocked.');
  process.exit(resolve.status ?? 1);
}

console.log('\nRe-checking migration state…\n');
const after = prisma(['migrate', 'status']);
console.log(`${after.stdout ?? ''}${after.stderr ?? ''}`.trim());

console.log('\nDone. Re-run the production deploy — `prisma migrate deploy` should now');
console.log('apply everything that was queued behind the failed migration.');
