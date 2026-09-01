#!/usr/bin/env node

/*
  Self-managed encrypted Postgres backups — the free replacement for Supabase
  point-in-time recovery.

  WHY THIS EXISTS. PITR is a paid Supabase add-on and this project has no
  starting capital, so the platform runs with no vendor backup at all: the free
  plan does not give you downloadable daily backups either. That makes this the
  ONLY copy of the database that exists outside the live cluster. The daily
  `backup-verify` cron proves the live database is up; it proves nothing about
  a copy, because until now there was no copy.

  WHAT IT DOES NOT BUY YOU. PITR restores to an arbitrary second. This restores
  to the last dump, so the RPO is the schedule interval (6 h) rather than
  seconds. That difference is recorded as an accepted risk in
  docs/runbooks/backup-restore-drill.md — it is a worse RPO, not an absent
  capability. The moment where those seconds actually matter is a destructive
  migration, which is why the production deploy takes its own dump immediately
  before `prisma migrate deploy` (slot `premigration`).

  SELF-ARMING. When no passphrase and no Cloudflare token are configured this
  script WARNS and exits 0, so adding it could not break a deploy on the day it
  landed. The moment those secrets exist it becomes a hard gate: a configured
  backup that fails to dump, encrypt, round-trip or upload exits non-zero. There
  is no separate switch to remember to flip — see ci.yml's "Decide the CI depth"
  step for the same reasoning about procedures nobody remembers.

  KEY SLOTS, NOT RETENTION RULES. `wrangler r2 object` has no list or lifecycle
  command, so pruning by age would need S3 credentials — the exact thing the
  2026-08-31 storage refactor removed from this project. Instead every key is a
  fixed rotating SLOT that overwrites itself, which bounds storage with no
  delete call and no credential:

    latest.dump.gpg              always the newest
    week/<dow>-<hh>.dump.gpg     28 slots: a full week at 6-hour granularity
    month/<dom>.dump.gpg         28 slots: ~a month of daily copies
    premigration/<ts>-<sha>      one per schema-changing deploy (see below)

  57 rotating objects plus the pre-migration set. Only `premigration/` grows,
  because uniqueness matters more there than boundedness — you must be able to
  reach the state before a SPECIFIC migration, and a slot that another deploy
  the same day could overwrite would not give you that. Migrations are rare;
  prune those from the dashboard quarterly.

  Usage:  node scripts/backup-database.mjs --slot=schedule|premigration|manual
*/

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ------------------------------------------------- which pg_dump, exactly

   `pg_dump` REFUSES TO DUMP A SERVER NEWER THAN ITSELF, and getting the wrong
   one is silent until the moment you need a backup. Measured 2026-09-01 on the
   first real run: the job aborted with "server version: 17.6; pg_dump version:
   16.15" even though the workflow installs postgresql-client-17. On Debian and
   Ubuntu `/usr/bin/pg_dump` is not a binary at all — it is `pg_wrapper`, which
   picks a version from the default CLUSTER rather than from what is installed,
   so installing 17 alongside 16 does not necessarily change what runs.

   So resolve the real versioned binary rather than trusting PATH: the highest
   major under the versioned /usr/lib/postgresql directories wins. `PG_DUMP`/`PG_RESTORE` override
   it outright for a layout this does not know (RHEL's /usr/pgsql-17/bin, macOS
   Homebrew, a container), and a bare name is the last resort so nothing here
   breaks on a machine without the Debian tree.

   pg_dump and pg_restore are resolved the same way for the same reason: an
   archive written by 17 is not readable by 16's pg_restore, so a mismatched
   pair would pass the dump and fail the round-trip check. */
function resolvePgBinary(name, overrideEnv) {
  const override = process.env[overrideEnv]?.trim();
  if (override) return override;

  const root = '/usr/lib/postgresql';
  const found = [];
  let entries = [];
  try {
    entries = readdirSync(root);
  } catch {
    return name;
  }
  for (const entry of entries) {
    const major = Number.parseInt(entry, 10);
    if (!Number.isInteger(major)) continue;
    const candidate = join(root, entry, 'bin', name);
    if (existsSync(candidate)) found.push({ major, path: candidate });
  }
  found.sort((a, b) => b.major - a.major);
  return found[0]?.path ?? name;
}

const PG_DUMP = resolvePgBinary('pg_dump', 'PG_DUMP');
const PG_RESTORE = resolvePgBinary('pg_restore', 'PG_RESTORE');

const args = process.argv.slice(2);
const slotArg = (args.find((a) => a.startsWith('--slot=')) ?? '--slot=manual').split('=')[1];
const dryRun = args.includes('--dry-run');

const VALID_SLOTS = new Set(['schedule', 'premigration', 'manual']);
if (!VALID_SLOTS.has(slotArg)) {
  console.error(`Unknown --slot=${slotArg}. Expected one of: ${[...VALID_SLOTS].join(', ')}`);
  process.exit(2);
}

/* DIRECT_URL, never the pooled DATABASE_URL. pg_dump holds one long
   transaction and needs a real session; a transaction-mode pooler will either
   refuse it or hand back an inconsistent snapshot. Same reason the migrate
   step in deploy-production.yml uses the direct secret. */
const databaseUrl = process.env.BACKUP_DATABASE_URL?.trim();
const passphrase = process.env.BACKUP_PASSPHRASE ?? '';
const bucket = process.env.BACKUP_R2_BUCKET?.trim() || 'ihype-backups';
/* BACKUP_R2_API_TOKEN first so the backups CAN be given their own credential
   later without a code change, falling back to the token the deploy already
   holds. Note what a separate token does and does not buy here: `wrangler r2
   object put` goes through the Cloudflare REST API, and R2's bucket-scoped
   "Object Read & Write" permission is documented as S3-API only — so any token
   wrangler can use carries account-wide **Workers R2 Storage Write**, whichever
   token it is. The gain is revocability and keeping the deploy token unchanged,
   not a narrower blast radius. */
const cloudflareToken = process.env.BACKUP_R2_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();
const cloudflareAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const heartbeatUrl = process.env.BACKUP_HEARTBEAT_URL?.trim();
const label = process.env.BACKUP_LABEL?.trim() || '';
const warnOverMb = Number(process.env.BACKUP_WARN_OVER_MB || '500');

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const summaryLines = [];

function note(line) {
  console.log(line);
  summaryLines.push(line);
}

function flushSummary() {
  if (!summaryPath || summaryLines.length === 0) return;
  try {
    appendFileSync(summaryPath, `${summaryLines.join('\n')}\n`);
  } catch {
    /* a summary that cannot be written must not fail a backup that worked */
  }
}

function fail(message) {
  console.error(`::error::${message}`);
  summaryLines.push(`\n**FAILED** — ${message}`);
  flushSummary();
  process.exit(1);
}

/* ---------------------------------------------------------------- configured?

   Both halves are needed for a backup to EXIST somewhere durable, so both
   decide whether this is armed. A passphrase with no bucket would produce an
   encrypted file that dies with the runner; a bucket with no passphrase would
   put production PII, `stripePaymentIntentId` and `stripeConnectAccountId`
   into object storage in the clear. Neither is a backup. */
const configured = Boolean(passphrase && cloudflareToken && cloudflareAccount);

if (!databaseUrl) {
  fail('BACKUP_DATABASE_URL is not set. Point it at the direct (non-pooled) connection string.');
}

if (!configured) {
  const missing = [
    !passphrase && 'BACKUP_PASSPHRASE',
    !cloudflareToken && 'CLOUDFLARE_API_TOKEN (or BACKUP_R2_API_TOKEN)',
    !cloudflareAccount && 'CLOUDFLARE_ACCOUNT_ID',
  ].filter(Boolean);
  console.log(`::warning::No database backup was taken — ${missing.join(', ')} not configured. The platform is running with NO backup outside the live cluster. See docs/runbooks/backup-restore-drill.md.`);
  summaryLines.push(`### Database backup — SKIPPED\n\nNot configured (${missing.join(', ')}). **There is no backup of production outside the live database.**`);
  flushSummary();
  process.exit(0);
}

if (passphrase.length < 24) {
  fail('BACKUP_PASSPHRASE is shorter than 24 characters. This is the only thing standing between an object store and every member\'s data; generate a long random one.');
}

/* ------------------------------------------------------------------- keys */

function pad(n) {
  return String(n).padStart(2, '0');
}

function resolveKeys(now) {
  const dow = now.getUTCDay(); // 0-6
  const hourBucket = pad(Math.floor(now.getUTCHours() / 6) * 6); // 00/06/12/18
  const dom = pad(now.getUTCDate());
  const stamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${dom}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;

  if (slotArg === 'premigration') {
    const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7);
    return [`premigration/${stamp}-${sha}.dump.gpg`];
  }

  if (slotArg === 'manual') {
    return [`manual/${stamp}.dump.gpg`, 'latest.dump.gpg'];
  }

  const keys = ['latest.dump.gpg', `week/${dow}-${hourBucket}.dump.gpg`];
  /* One daily copy per month slot, written by the 00:00 UTC run only. Writing
     it on every run would make all four of a day's runs collapse onto the same
     key, which is what `week/` is already for. */
  if (hourBucket === '00') keys.push(`month/${dom}.dump.gpg`);
  return keys;
}

const startedAt = new Date();
const keys = resolveKeys(startedAt);

/* ------------------------------------------------------------------- dump */

const workDir = mkdtempSync(join(tmpdir(), 'ihype-backup-'));
const dumpPath = join(workDir, 'db.dump');
const encryptedPath = join(workDir, 'db.dump.gpg');
const passPath = join(workDir, 'pass');

function cleanup() {
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

process.on('exit', cleanup);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.error) return { ok: false, output: String(result.error.message) };
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { ok: result.status === 0, output, status: result.status };
}

/* Redact anything that could carry the connection string or the passphrase out
   of this process. pg_dump prints the URL back at you on a connection error,
   and that URL contains the production database password. */
function redact(text) {
  let out = String(text ?? '');
  if (databaseUrl) {
    out = out.split(databaseUrl).join('<database-url>');
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.password) out = out.split(parsed.password).join('<redacted>');
    } catch {
      /* an unparseable URL still had its literal form replaced above */
    }
  }
  if (passphrase) out = out.split(passphrase).join('<redacted>');
  return out;
}

note(`### Database backup — slot \`${slotArg}\`${label ? ` (${label})` : ''}`);

/* Name the binary and its version in the summary. The 2026-09-01 failure was
   invisible until pg_dump aborted mid-job; a line saying which pg_dump is about
   to run turns "why did the backup stop working" into a glance. */
const dumpVersion = run(PG_DUMP, ['--version']);
note(`- pg_dump: ${PG_DUMP}${dumpVersion.ok ? ` (${dumpVersion.output.trim()})` : ' — could not report its version'}`);

/* --exclude-schema=stripe, NOT --schema=public, and the difference is not
   cosmetic. The `stripe` schema is the Supabase Stripe Sync Engine's:
   installed outside this repo, referenced by no application code, and
   re-derivable from Stripe itself, which is the source of truth for it —
   dumping it would inflate every copy with data we can always re-sync, and
   restoring it would collide with the sync engine's own migrations. But
   `--schema=public` ALSO drops the `CREATE EXTENSION` statements, because
   extensions are database-level rather than schema-level objects, and it emits
   a bare `CREATE SCHEMA public` that fails against any freshly created
   database. Measured 2026-08-31: that combination restores with an ignored
   error and no pg_trgm/citext, so the drill can never use --exit-on-error and
   a genuinely broken restore looks like the normal one. Excluding by name
   instead restores clean, extensions included, exit code 0.

   --no-owner/--no-acl so the dump restores into a scratch database owned by
   whatever local role the operator happens to have. */
const dump = run(PG_DUMP, [
  databaseUrl,
  '--format=custom',
  '--compress=9',
  '--exclude-schema=stripe',
  '--no-owner',
  '--no-acl',
  '--file',
  dumpPath,
]);

if (!dump.ok) {
  fail(`pg_dump failed: ${redact(dump.output).trim().slice(0, 800)}`);
}

let dumpBytes = 0;
try {
  dumpBytes = statSync(dumpPath).size;
} catch {
  fail('pg_dump reported success but produced no file.');
}

/* A dump small enough to be an error page or an empty schema is not a backup.
   The real database carries 100+ migrations and seeded content; anything under
   64 KB compressed means the dump did not capture the data. */
if (dumpBytes < 64 * 1024) {
  fail(`The dump is only ${dumpBytes} bytes — too small to be this database. Refusing to store it as a backup.`);
}

/* Parse the archive back. A truncated or corrupt custom-format dump reads as a
   perfectly ordinary file and only reveals itself at restore time, which is the
   worst possible moment to find out. `pg_restore --list` walks the table of
   contents without touching a database. */
const toc = run(PG_RESTORE, ['--list', dumpPath]);
if (!toc.ok) {
  fail(`The dump does not parse as a Postgres archive: ${redact(toc.output).trim().slice(0, 400)}`);
}
const tocEntries = toc.output.split('\n').filter((line) => line && !line.startsWith(';')).length;
if (tocEntries < 20) {
  fail(`The dump's table of contents has only ${tocEntries} entries. Expected the full public schema.`);
}

const dumpMb = dumpBytes / (1024 * 1024);
note(`- dump: ${dumpMb.toFixed(1)} MB, ${tocEntries} archive entries`);
if (dumpMb > warnOverMb) {
  console.log(`::warning::The dump is ${dumpMb.toFixed(0)} MB. Media written before the R2 refactor is still base64 in Postgres — run the media-backfill cron (docs: src/lib/media-backfill.ts) to shrink every future backup and every restore.`);
  note(`- **note:** over ${warnOverMb} MB. Run the media backfill; base64 media in Postgres inflates every copy.`);
}

/* ---------------------------------------------------------------- encrypt */

/* The passphrase goes to gpg through a file in a 0700 temp dir rather than
   --passphrase (visible in the process command line to anything on the box) or an env
   var (inherited by every child). s2k settings are stated explicitly rather
   than left to gpg's defaults so the KDF cost cannot silently weaken. */
writeFileSync(passPath, passphrase, { mode: 0o600 });

const encrypt = run('gpg', [
  '--batch',
  '--yes',
  '--quiet',
  '--symmetric',
  '--cipher-algo', 'AES256',
  '--s2k-mode', '3',
  '--s2k-digest-algo', 'SHA512',
  '--s2k-count', '65011712',
  '--passphrase-file', passPath,
  '--output', encryptedPath,
  dumpPath,
]);

if (!encrypt.ok) {
  fail(`gpg encryption failed: ${redact(encrypt.output).trim().slice(0, 400)}`);
}

/* --------------------------------------------------- prove it decrypts BACK

   An encrypted backup you cannot open is indistinguishable from no backup, and
   you find out in the middle of an incident. Decrypting here with the same
   secret CI will hand a future operator, then parsing the result as an archive,
   is the only thing that proves the stored object is recoverable rather than
   merely present. It costs a few seconds against a backup you would otherwise
   trust blind for a month. */
const roundTripPath = join(workDir, 'roundtrip.dump');
const decrypt = run('gpg', [
  '--batch',
  '--yes',
  '--quiet',
  '--decrypt',
  '--passphrase-file', passPath,
  '--output', roundTripPath,
  encryptedPath,
]);

if (!decrypt.ok) {
  fail(`The encrypted backup did not decrypt with the configured passphrase: ${redact(decrypt.output).trim().slice(0, 400)}`);
}

const roundTripToc = run(PG_RESTORE, ['--list', roundTripPath]);
if (!roundTripToc.ok) {
  fail('The decrypted backup does not parse as a Postgres archive. Do not treat this object as a backup.');
}

const encryptedBytes = statSync(encryptedPath).size;
const sha256 = createHash('sha256').update(readFileSync(encryptedPath)).digest('hex');
note(`- encrypted: ${(encryptedBytes / (1024 * 1024)).toFixed(1)} MB · sha256 \`${sha256.slice(0, 16)}…\``);
note('- decrypt round-trip: verified (the stored object opens with the configured passphrase)');

if (dryRun) {
  note(`- dry run: would upload to \`${bucket}/${keys.join('`, `')}\``);
  flushSummary();
  process.exit(0);
}

/* ----------------------------------------------------------------- upload

   `wrangler r2 object put` authenticates with CLOUDFLARE_API_TOKEN, so this
   needs no S3 access key. That matters: the 2026-08-31 storage refactor
   deleted the SigV4 path precisely because this project has no R2 credentials
   and does not want any. --remote is explicit; without it wrangler writes to
   local persistence and reports success. */
for (const key of keys) {
  const upload = run('npx', [
    'wrangler',
    'r2',
    'object',
    'put',
    `${bucket}/${key}`,
    '--file', encryptedPath,
    '--remote',
    '--content-type', 'application/octet-stream',
  ], {
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: cloudflareToken,
      CLOUDFLARE_ACCOUNT_ID: cloudflareAccount,
      WRANGLER_SEND_METRICS: 'false',
    },
  });

  if (!upload.ok) {
    fail(`Upload to ${bucket}/${key} failed: ${redact(upload.output).trim().slice(0, 600)}`);
  }
  note(`- stored: \`${bucket}/${key}\``);
}

/* ------------------------------------------------------- dead-man's switch

   A backup job that silently stops running looks exactly like one that is
   working. GitHub disables scheduled workflows after 60 days of repository
   inactivity, and an exhausted Actions allowance produces no run at all rather
   than a failed one — this repository has already lost a production deploy
   that way (see deploy-production.yml's workflow_dispatch note). An external
   monitor that alerts on SILENCE is the only thing that catches either. */
if (heartbeatUrl) {
  try {
    const response = await fetch(heartbeatUrl, { method: 'POST' });
    note(`- heartbeat: ${response.ok ? 'sent' : `rejected (HTTP ${response.status})`}`);
  } catch (error) {
    /* Never fail a good backup because a monitor was unreachable. */
    console.log(`::warning::Backup heartbeat ping failed: ${redact(error instanceof Error ? error.message : String(error))}`);
  }
}

const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(0);
note(`- completed in ${elapsed}s at ${startedAt.toISOString()}`);
flushSummary();

/* Machine-readable line for anything scraping the log. */
console.log(JSON.stringify({
  ok: true,
  slot: slotArg,
  keys,
  bucket,
  dumpBytes,
  encryptedBytes,
  sha256,
  takenAt: startedAt.toISOString(),
}));
