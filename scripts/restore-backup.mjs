#!/usr/bin/env node

/*
  Fetch an encrypted backup, decrypt it, and restore it into a scratch database.

  This is the other half of scripts/backup-database.mjs and it exists because a
  drill nobody can run in one command is a drill that stops being run. The
  monthly restore drill used to be "Supabase Dashboard → Point in Time →
  Restore to new project"; without a paid plan there is no such button, so the
  procedure is this script plus the verifier that already exists
  (npm run verify:restore).

  IT WRITES TO A DATABASE, so it is deliberately hard to point at the wrong
  one. Three independent guards, none of which can be satisfied by accident:
    1. the target's host/port/database must not match DIRECT_URL,
       DATABASE_URL or PRODUCTION_DATABASE_URL, whichever are set;
    2. the target must be empty — an existing `User` table stops it dead,
       because "restore over the top" is how a drill becomes an incident;
    3. CONFIRM_RESTORE must be set to the exact confirmation string.

  Usage:
    RESTORE_TARGET_URL='postgresql://…/ihype_drill' \
    BACKUP_PASSPHRASE='…' \
    CONFIRM_RESTORE='restore into scratch' \
    node scripts/restore-backup.mjs --key=latest.dump.gpg

  --file=<path> restores a backup you already have on disk and skips the
  download, which is also how you test this script without a bucket.
*/

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);

function flag(name, fallback = undefined) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const key = flag('key', 'latest.dump.gpg');
const localFile = flag('file');
const bucket = process.env.BACKUP_R2_BUCKET?.trim() || 'ihype-backups';
const targetUrl = process.env.RESTORE_TARGET_URL?.trim();
const passphrase = process.env.BACKUP_PASSPHRASE ?? '';
const confirmation = process.env.CONFIRM_RESTORE?.trim();
/* Same fallback as backup-database.mjs: a dedicated backup token if one exists,
   otherwise the deploy's. */
const cloudflareToken = process.env.BACKUP_R2_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();
const cloudflareAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

function fail(message) {
  console.error(`\nFAILED: ${message}\n`);
  process.exit(1);
}

function identity(raw) {
  const url = new URL(raw);
  return `${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname}`;
}

if (!targetUrl) fail('Set RESTORE_TARGET_URL to an empty, disposable database.');
if (!passphrase) fail('Set BACKUP_PASSPHRASE — the same secret the backup workflow uses.');
if (confirmation !== 'restore into scratch') {
  fail('Set CONFIRM_RESTORE="restore into scratch" after confirming the target is disposable.');
}

let targetIdentity;
try {
  targetIdentity = identity(targetUrl);
} catch {
  fail('RESTORE_TARGET_URL is not a valid Postgres URL.');
}

/* Guard 1 — never the live database, under whichever name it is configured. */
for (const name of ['DIRECT_URL', 'DATABASE_URL', 'PRODUCTION_DATABASE_URL']) {
  const value = process.env[name]?.trim();
  if (!value) continue;
  let candidate;
  try {
    candidate = identity(value);
  } catch {
    continue;
  }
  if (candidate === targetIdentity) {
    fail(`RESTORE_TARGET_URL points at the same database as ${name}. Restore to a scratch database, never over the top of a live one.`);
  }
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error) return { ok: false, output: String(result.error.message) };
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function redact(text) {
  let out = String(text ?? '');
  for (const secret of [passphrase, targetUrl]) {
    if (secret) out = out.split(secret).join('<redacted>');
  }
  return out;
}

/* Guard 2 — the target must be empty. A restore into a database that already
   has rows silently merges two states and produces something that is neither
   the backup nor what was there before, which is the worst possible thing to
   then verify and sign off. */
const occupied = run('psql', [targetUrl, '-tAc', "SELECT to_regclass('public.\"User\"') IS NOT NULL"]);
if (!occupied.ok) {
  fail(`Could not reach RESTORE_TARGET_URL: ${redact(occupied.output).trim().slice(0, 300)}`);
}
if (occupied.output.trim() === 't') {
  fail('The target database already contains a "User" table. Create a fresh empty database for the drill.');
}

const workDir = mkdtempSync(join(tmpdir(), 'ihype-restore-'));
process.on('exit', () => {
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

const encryptedPath = localFile || join(workDir, 'backup.dump.gpg');
const dumpPath = join(workDir, 'backup.dump');
const passPath = join(workDir, 'pass');

if (!localFile) {
  if (!cloudflareToken || !cloudflareAccount) {
    fail('Set CLOUDFLARE_API_TOKEN (or BACKUP_R2_API_TOKEN) and CLOUDFLARE_ACCOUNT_ID to download from R2, or pass --file=<path> for a backup you already hold.');
  }
  console.log(`Downloading ${bucket}/${key} …`);
  /* --remote is explicit: without it wrangler reads local persistence and
     reports success on an object that is not the backup. */
  const download = run('npx', [
    'wrangler', 'r2', 'object', 'get', `${bucket}/${key}`,
    '--file', encryptedPath,
    '--remote',
  ], {
    env: { ...process.env, CLOUDFLARE_API_TOKEN: cloudflareToken, CLOUDFLARE_ACCOUNT_ID: cloudflareAccount, WRANGLER_SEND_METRICS: 'false' },
  });
  if (!download.ok) fail(`Download failed: ${redact(download.output).trim().slice(0, 600)}`);
}

let encryptedBytes = 0;
try {
  encryptedBytes = statSync(encryptedPath).size;
} catch {
  fail(`No backup file at ${encryptedPath}.`);
}
console.log(`Backup: ${encryptedBytes < 1024 * 1024 ? `${(encryptedBytes / 1024).toFixed(0)} KB` : `${(encryptedBytes / (1024 * 1024)).toFixed(1)} MB`}`);

writeFileSync(passPath, passphrase, { mode: 0o600 });
const decrypt = run('gpg', ['--batch', '--yes', '--quiet', '--decrypt', '--passphrase-file', passPath, '--output', dumpPath, encryptedPath]);
if (!decrypt.ok) fail(`Decryption failed — wrong passphrase, or a corrupt object: ${redact(decrypt.output).trim().slice(0, 300)}`);

const toc = run('pg_restore', ['--list', dumpPath]);
if (!toc.ok) fail('The decrypted file is not a Postgres archive.');
console.log(`Archive parses: ${toc.output.split('\n').filter((l) => l && !l.startsWith(';')).length} entries`);

/* --exit-on-error, which is only usable because the dump excludes the `stripe`
   schema by NAME rather than selecting public (see backup-database.mjs): the
   selecting form emits a `CREATE SCHEMA public` that always fails, and one
   expected error means nobody can tell an unexpected one from the noise. */
console.log('Restoring …');
const restore = run('pg_restore', ['--dbname', targetUrl, '--no-owner', '--no-acl', '--exit-on-error', dumpPath]);
if (!restore.ok) {
  fail(`pg_restore failed: ${redact(restore.output).trim().slice(0, 1200)}`);
}

const counts = run('psql', [targetUrl, '-tAc',
  'SELECT (SELECT COUNT(*) FROM "User") || \' users, \' || (SELECT COUNT(*) FROM "Profile") || \' profiles, \' || (SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) || \' migrations\'',
]);

console.log(`\nRestored: ${counts.ok ? counts.output.trim() : 'counts unavailable'}`);
console.log('\nNext: verify it, then tear the database down.');
console.log('  RESTORE_DATABASE_URL="$RESTORE_TARGET_URL" \\');
console.log('  PRODUCTION_DATABASE_URL="<the live URL>" \\');
console.log("  CONFIRM_RESTORE_DRILL='verify isolated restore' \\");
console.log('  npm run verify:restore');
