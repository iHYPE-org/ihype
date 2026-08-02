#!/usr/bin/env node

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const restoreUrl = process.env.RESTORE_DATABASE_URL?.trim();
const productionUrl = process.env.PRODUCTION_DATABASE_URL?.trim();
const confirmation = process.env.CONFIRM_RESTORE_DRILL?.trim();

function databaseIdentity(raw) {
  const url = new URL(raw);
  return `${url.hostname.toLowerCase()}:${url.port || '5432'}/${url.pathname.replace(/^\//, '')}`;
}

function fail(message) {
  console.error(`\nFAILED: ${message}\n`);
  process.exit(1);
}

if (!restoreUrl || !productionUrl) {
  fail('Set RESTORE_DATABASE_URL and PRODUCTION_DATABASE_URL. The restore must be an isolated fork.');
}

if (confirmation !== 'verify isolated restore') {
  fail('Set CONFIRM_RESTORE_DRILL="verify isolated restore" after confirming the target is disposable.');
}

let restoreIdentity;
let productionIdentity;
try {
  restoreIdentity = databaseIdentity(restoreUrl);
  productionIdentity = databaseIdentity(productionUrl);
} catch {
  fail('RESTORE_DATABASE_URL and PRODUCTION_DATABASE_URL must be valid Postgres URLs.');
}

if (restoreIdentity === productionIdentity) {
  fail('Refusing to run against the production database identity. Restore to a separate project or branch first.');
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: restoreUrl }) });

try {
  const [users, profiles, shows, ticketOrders, tickets, notificationJobs, auditLogs, migrations] = await Promise.all([
    db.user.count(),
    db.profile.count(),
    db.show.count(),
    db.ticketOrder.count(),
    db.ticket.count(),
    db.notificationJob.count(),
    db.auditLog.count(),
    db.$queryRaw`SELECT COUNT(*)::int AS count, MAX(migration_name) AS latest FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
  ]);

  const migration = migrations[0] ?? { count: 0, latest: null };
  if (users < 1 || profiles < 1 || Number(migration.count) < 1 || !migration.latest) {
    fail('The restored database is missing core rows or completed migrations. Do not mark the drill as passed.');
  }

  console.log(JSON.stringify({
    result: 'PASS',
    verifiedAt: new Date().toISOString(),
    restoreTarget: restoreIdentity,
    counts: { users, profiles, shows, ticketOrders, tickets, notificationJobs, auditLogs },
    migrations: { count: Number(migration.count), latest: migration.latest },
    next: 'Compare these counts with the backup-check evidence, spot-check critical records, destroy the restore, then set RESTORE_DRILL_VERIFIED_AT.',
  }, null, 2));
} catch (error) {
  fail(error instanceof Error ? `Restore verification query failed: ${error.message}` : 'Restore verification query failed.');
} finally {
  await db.$disconnect();
}
