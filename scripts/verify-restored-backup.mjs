#!/usr/bin/env node

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const restoreUrl = process.env.RESTORE_DATABASE_URL?.trim();
/* USED ONLY AS A GUARD — this script never connects to it. It exists so the
   checker can refuse to run when the "restore" turns out to be production
   itself. The count comparison in the runbook's step 4 is deliberately
   manual, against the backup-check email; nothing here reads production, and
   the name should not be taken to promise otherwise. */
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

  /* ROW COUNTS ARE NOT ENOUGH, and this is the half that was missing.
     A restore can carry every row and still have lost the columns that make
     them useful: measured 2026-08-31 by nulling `stripePaymentIntentId` on
     every order and `stripeConnectAccountId` on every profile, after which
     this script still reported PASS. Those two fields are what let you refund
     a fan and pay an artist — losing them silently is the exact disaster a
     restore drill exists to catch, and they were left to a human to spot-check
     by eye at step 5 of the runbook.

     Each check is CONDITIONAL on the class being non-empty, so a young
     production with no sales yet passes honestly rather than failing on
     absence. */
  const integrity = [];

  if (ticketOrders > 0) {
    const captured = await db.ticketOrder.count({ where: { status: 'CAPTURED' } });
    if (captured > 0) {
      const unlinked = await db.ticketOrder.count({
        where: { status: 'CAPTURED', stripePaymentIntentId: null },
      });
      if (unlinked > 0) {
        integrity.push(`${unlinked} of ${captured} captured ticket orders have no stripePaymentIntentId — those cannot be refunded`);
      }
    }
  }

  if (tickets > 0) {
    const unusable = await db.ticket.count({ where: { OR: [{ serializedId: '' }] } });
    if (unusable > 0) integrity.push(`${unusable} tickets have no serializedId — those are not admissible at a door`);
  }

  const onboarded = await db.profile.count({ where: { stripeConnectOnboarded: true } });
  if (onboarded > 0) {
    const unpayable = await db.profile.count({
      where: { stripeConnectOnboarded: true, stripeConnectAccountId: null },
    });
    if (unpayable > 0) {
      integrity.push(`${unpayable} of ${onboarded} onboarded profiles have no stripeConnectAccountId — those cannot be paid out`);
    }
  }

  if (users > 0 && auditLogs < 1) {
    integrity.push('no AuditLog rows survived — the audit trail is the compliance evidence this drill is run for');
  }

  if (integrity.length > 0) {
    fail(`The restore carries its rows but not their critical fields:\n  - ${integrity.join('\n  - ')}`);
  }

  console.log(JSON.stringify({
    result: 'PASS',
    verifiedAt: new Date().toISOString(),
    restoreTarget: restoreIdentity,
    counts: { users, profiles, shows, ticketOrders, tickets, notificationJobs, auditLogs },
    migrations: { count: Number(migration.count), latest: migration.latest },
    integrity: 'checked: captured orders keep their PaymentIntent, onboarded profiles keep their Connect account, tickets keep their serialized id, the audit trail survived',
    next: 'Compare these counts with the backup-check evidence (this script never reads production), destroy the restore, then set RESTORE_DRILL_VERIFIED_AT.',
  }, null, 2));
} catch (error) {
  fail(error instanceof Error ? `Restore verification query failed: ${error.message}` : 'Restore verification query failed.');
} finally {
  await db.$disconnect();
}
