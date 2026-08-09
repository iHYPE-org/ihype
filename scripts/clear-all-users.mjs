/**
 * Deletes every account on the platform, for a clean start before real alpha.
 *
 *   node scripts/clear-all-users.mjs                                   # dry run
 *   CONFIRM_CLEAR_ALL_USERS="clear all users" node scripts/clear-all-users.mjs
 *
 * DRY RUN BY DEFAULT. Without the confirmation phrase it counts and prints and
 * changes nothing. The phrase matches the house pattern in
 * `reset-test-logins.mjs`, which refuses a production run without one.
 *
 * ## What "clear all users" actually destroys
 *
 * Thirty of the foreign keys pointing at `User` are ON DELETE CASCADE, and two
 * of those are the whole platform: `Profile.ownerId` and `Show.creatorId`. So
 * this is not an account purge with content left behind — it takes profiles,
 * shows, tracks, playlists, tickets, follows, hypes and listens with it. That
 * is the intent here, but it should be read once before it is run.
 *
 * Six FKs are ON DELETE SET NULL, and `AuditLog.actorUserId` is one of them.
 * That is deliberate and useful: the audit trail survives the wipe, so the
 * `beta_access_request` rows behind the admin workbench's access-request queue
 * are still there afterwards. Clearing accounts does not clear the waiting list.
 *
 * ## Two things that would make a plain DELETE fail halfway
 *
 * 1. **ON DELETE RESTRICT.** `Ad.advertiserId` is RESTRICT, and at least one
 *    more (`CollabResponse`) exists in the migration history for a model that
 *    is no longer in `schema.prisma` — meaning the table may still be in the
 *    database. So the blockers are DISCOVERED from `pg_constraint` at runtime
 *    rather than hand-listed: a list written today is wrong the first time
 *    someone adds a model, and this script is most likely to be run by someone
 *    who has not read it.
 *
 * 2. **Your own admin account is a User.** Deleting it locks you out of
 *    `/admin`, which is where the `invite_only_signup` flag lives — the gate
 *    that has to go on before real alpha. Recovering means re-registering and
 *    promoting the row by hand in SQL. ADMIN accounts are therefore KEPT by
 *    default; pass `KEEP_ADMINS=0` to take them too, deliberately.
 *
 * ## It refuses to destroy money
 *
 * If any `TicketOrder` has been CAPTURED, real money moved through Stripe and
 * the buyer records are financial records. The script stops rather than
 * deleting them. `ALLOW_PAID=1` overrides, and should not be needed: iHYPE has
 * never sold a ticket in live mode.
 *
 * Everything runs in ONE transaction. A partial wipe is worse than no wipe.
 *
 * ## Verified, not assumed
 *
 * Exercised end to end against a local Postgres 16 with all 109 migrations
 * applied and a production-shaped seed. All four paths:
 *   - dry run: counted, previewed the cascade, changed nothing
 *   - default run: 3 users deleted, 3 profiles cascaded away, ADMIN kept
 *   - KEEP_ADMINS=0: 0 users remaining
 *   - a CAPTURED TicketOrder: refused, exit 1
 * The FK discovery found `Ad.advertiserId` and did NOT find `CollabResponse`,
 * whose constraint is in the migration history but whose table is not in the
 * current schema — which is the case a hand-written list would have got wrong
 * in one direction or the other.
 *
 * `AuditLog.actorUserId` being SET NULL was confirmed in that run: the audit
 * row survived the wipe. The access-request waiting list outlives the reset.
 */
import pg from 'pg';

const { Client } = pg;

const CONFIRM = 'clear all users';
const armed = process.env.CONFIRM_CLEAR_ALL_USERS === CONFIRM;
const keepAdmins = process.env.KEEP_ADMINS !== '0';
const allowPaid = process.env.ALLOW_PAID === '1';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is required.');

// The predicate is written once and reused for the count, the preview and the
// delete, so what gets reported cannot drift from what gets removed.
const WHERE = keepAdmins ? `WHERE "role" <> 'ADMIN'` : '';

const client = new Client({ connectionString });
await client.connect();

try {
  const q = async (sql, params) => (await client.query(sql, params)).rows;
  const n = async (sql) => Number((await q(sql))[0]?.count ?? 0);

  const total = await n('SELECT count(*) FROM "User"');
  const targeted = await n(`SELECT count(*) FROM "User" ${WHERE}`);
  const admins = await n(`SELECT count(*) FROM "User" WHERE "role" = 'ADMIN'`);

  console.log(`\nUsers in database: ${total}`);
  console.log(`Targeted for deletion: ${targeted}`);
  console.log(
    keepAdmins
      ? `Kept: ${admins} ADMIN account(s) — pass KEEP_ADMINS=0 to include them.`
      : `Including ${admins} ADMIN account(s). You will lose access to /admin.`,
  );

  // What goes with them. Only the tables worth naming out loud; the rest
  // follow by cascade and are not a surprise once these are understood.
  const collateral = [
    ['Profile', 'SELECT count(*) FROM "Profile"'],
    ['Show', 'SELECT count(*) FROM "Show"'],
    ['ArtistMediaAsset', 'SELECT count(*) FROM "ArtistMediaAsset"'],
    ['Ticket', 'SELECT count(*) FROM "Ticket"'],
    ['TicketOrder', 'SELECT count(*) FROM "TicketOrder"'],
  ];
  console.log('\nRows that cascade away with them:');
  for (const [label, sql] of collateral) {
    try {
      console.log(`  ${label.padEnd(18)} ${await n(sql)}`);
    } catch {
      console.log(`  ${label.padEnd(18)} (table not present)`);
    }
  }

  // Money check. A CAPTURED order means a real Stripe charge settled.
  let captured = 0;
  try {
    captured = await n(`SELECT count(*) FROM "TicketOrder" WHERE "status" = 'CAPTURED'`);
  } catch {
    // Table absent on an older schema — nothing sold, nothing to protect.
  }
  if (captured > 0 && !allowPaid) {
    console.error(
      `\nREFUSING: ${captured} ticket order(s) are CAPTURED — real money moved through` +
      `\nStripe and these are financial records. Deleting the buyers deletes them too.` +
      `\nIf that is genuinely intended, re-run with ALLOW_PAID=1.`,
    );
    process.exitCode = 1;
    throw new Error('captured orders present');
  }

  // Blocking foreign keys, discovered rather than assumed. 'r' is RESTRICT and
  // 'a' is NO ACTION; both raise on delete. Anything CASCADE or SET NULL takes
  // care of itself and is not listed.
  const blockers = await q(`
    SELECT c.conname, rel.relname AS child_table, att.attname AS child_column
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
    JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = k.attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'public."User"'::regclass
      AND c.confdeltype IN ('r', 'a')
    ORDER BY rel.relname
  `);

  if (blockers.length) {
    console.log('\nForeign keys that would block the delete (cleared first):');
    for (const b of blockers) console.log(`  ${b.child_table}.${b.child_column}  [${b.conname}]`);
  } else {
    console.log('\nNo blocking foreign keys — every reference to User cascades or nulls.');
  }

  if (!armed) {
    console.log(
      `\nDRY RUN — nothing was changed.` +
      `\nTo actually delete, re-run with:` +
      `\n  CONFIRM_CLEAR_ALL_USERS="${CONFIRM}" node scripts/clear-all-users.mjs\n`,
    );
    process.exit(0);
  }

  console.log('\nDeleting…');
  await client.query('BEGIN');

  // Clear the blockers for the targeted users only, so KEEP_ADMINS actually
  // keeps an admin's rows rather than stripping them and leaving the account.
  for (const b of blockers) {
    const sql = keepAdmins
      ? `DELETE FROM "${b.child_table}" WHERE "${b.child_column}" IN (SELECT "id" FROM "User" WHERE "role" <> 'ADMIN')`
      : `DELETE FROM "${b.child_table}"`;
    const res = await client.query(sql);
    console.log(`  ${b.child_table}: ${res.rowCount} row(s)`);
  }

  const deleted = await client.query(`DELETE FROM "User" ${WHERE}`);
  await client.query('COMMIT');

  console.log(`\nDeleted ${deleted.rowCount} user(s).`);
  console.log(`Users remaining: ${await n('SELECT count(*) FROM "User"')}`);
  console.log(
    '\nNext: the public counters read every Profile row, so the landing page and' +
    '\n/info?tab=transparency will now show the real (empty) numbers. The landing' +
    "\nstats strip hides itself entirely when every counter is zero.\n",
  );
} catch (error) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Not in a transaction — the failure happened before BEGIN.
  }
  if (!process.exitCode) {
    console.error('\nFailed, and nothing was committed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
