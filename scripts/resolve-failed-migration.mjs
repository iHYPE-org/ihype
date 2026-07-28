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
import pg from 'pg';

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
 * The failed set comes from `_prisma_migrations` directly, not from parsing
 * `migrate status`.
 *
 * The first version of this script did parse that output, and it was wrong in
 * exactly the situation it exists for. `migrate status` prints a
 * "Following migration have failed:" block only when nothing else is
 * outstanding — when unapplied migrations ALSO exist (the normal case while a
 * failed row is blocking deploys, since work keeps merging behind it) it
 * reports just "Following migrations have not yet been applied" and never
 * mentions the failure at all. The guard therefore refused a legitimate
 * recovery on the first real run.
 *
 * The table is unambiguous and version-independent: a migration is failed
 * exactly when it has a row with finished_at IS NULL and no rolled_back_at.
 * That is the same condition Prisma itself uses to raise P3009.
 */
async function collectFailedMigrations() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT migration_name
         FROM _prisma_migrations
        WHERE finished_at IS NULL
          AND rolled_back_at IS NULL`
    );
    return new Set(rows.map((r) => r.migration_name));
  } finally {
    await client.end();
  }
}

const failedMigrations = await collectFailedMigrations();
const failedHere = failedMigrations.has(migrationName);

if (!failedHere) {
  console.error(`\nRefusing to resolve: "${migrationName}" is not reported as failed above.`);
  console.error(
    failedMigrations.size > 0
      ? `_prisma_migrations reports these as failed: ${[...failedMigrations].join(', ')}`
      : '_prisma_migrations holds no failed rows at all — there is nothing to recover.'
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
