# Runbook — Monthly Backup Restore Drill

**Owner:** admin@ihype.org · **Cadence:** monthly (the daily `backup-verify` cron email reminds you on the 1st) · **Time needed:** ~20 minutes

The daily `backup-verify` cron proves the *live* database is up, populated, and fresh. It does **not** prove a backup can be restored. This drill does. (SOC 2 A1.2 / ISO 27002 8.13 / NIST CSF RC.RP — recovery must be *tested*, not assumed.)

## What backs this platform up, and what it does not

**There is no Supabase point-in-time recovery, on purpose.** PITR is a paid add-on and this project has no starting capital. The free plan does not include downloadable daily backups either, so the encrypted dumps written by `.github/workflows/backup-database.yml` are the **only** copy of the database that exists outside the live cluster. That workflow is not a convenience; it is the backup.

**Accepted RPO: 6 hours.** Backups run at 00:00, 06:00, 12:00 and 18:00 UTC, so a total loss of the cluster loses at most the transactions since the last dump. PITR would make that seconds. This is a recorded, accepted risk of running without capital — it is a worse RPO, not an absent recovery capability, and it is reviewed when the platform starts holding real money.

**The one moment where 6 hours is not good enough** is a destructive migration, which is exactly what PITR is usually bought for. `deploy-production.yml` therefore takes its own dump immediately before `prisma migrate deploy`, and only when Prisma reports migrations actually pending. Those land under `premigration/`.

**The backup is self-arming.** With no `BACKUP_PASSPHRASE` configured, `scripts/backup-database.mjs` warns and exits 0. Once the secret exists it is a hard gate: a dump that fails, will not decrypt, or will not upload fails the job — and in the deploy, fails it *before* the schema changes. There is no separate switch to remember.

### Where the copies live

Keys are fixed rotating slots that overwrite themselves, so storage is bounded with no lifecycle rule and no S3 credential (`wrangler r2 object` has neither a list nor a delete-by-age command, and minting S3 keys is the thing the 2026-08-31 storage refactor removed from this project).

| Key | Meaning |
|---|---|
| `latest.dump.gpg` | the newest dump, whatever slot it also wrote |
| `week/<dow>-<hh>.dump.gpg` | 28 slots — a full week at 6-hour granularity |
| `month/<dom>.dump.gpg` | 28 slots — ~a month of daily copies (written by the 00:00 UTC run) |
| `premigration/<ts>-<sha>.dump.gpg` | one per schema-changing deploy |

Only `premigration/` grows: you must be able to reach the state before a *specific* migration, so a slot another deploy could overwrite the same day would not do. Prune those from the Cloudflare dashboard quarterly.

## One-time setup

Do this once; it is the only part that needs the Cloudflare dashboard.

1. **Create the bucket.** Cloudflare → R2 → Create bucket → `ihype-backups`. Keep it separate from `ihype-media`: a credential that can reach the backups must not also be able to reach (or overwrite) member media.
2. **Give the deploy token R2 write.** The Actions secret `CLOUDFLARE_API_TOKEN` already exists. Either add **Workers R2 Storage: Edit** to it, or mint a second token and store it as `CLOUDFLARE_API_TOKEN` on the backup workflow. No S3 access key is needed — `wrangler r2 object put` authenticates with the API token.
3. **Generate the passphrase** and store it as the Actions secret `BACKUP_PASSPHRASE`:
   ```bash
   openssl rand -base64 48
   ```
   **Store a copy somewhere that survives losing GitHub** — a password manager, on paper in a drawer. A backup whose passphrase only exists in the same account as the repository is not an off-site backup. The script refuses anything under 24 characters.
4. **Optional but recommended — a dead-man's switch.** Create a free healthchecks.io check on a 6-hour period and store its ping URL as `BACKUP_HEARTBEAT_URL`. A backup job that silently *stops* looks identical to one that is working: GitHub disables scheduled workflows after 60 days of repository inactivity, and an exhausted Actions allowance produces no run at all rather than a failed one. This repository has already lost a production deploy that way. Only a monitor that alerts on **silence** catches either.
5. **Confirm it works** — Actions → Database backup → Run workflow, with **dry run** ticked. It dumps, encrypts, proves the encrypted file decrypts with the configured secret, and uploads nothing. Then run it again unticked and check the job summary names the keys it wrote.

## Prerequisites for the drill

- The most recent successful **Database backup** run (Actions tab), and the most recent `✓ iHYPE daily backup check` email — it carries the expected row counts and latest migration name.
- `BACKUP_PASSPHRASE`, and a Cloudflare API token with R2 read, in your local environment.
- A local PostgreSQL **17** client (`pg_restore`, `psql`) and `gpg`.

## Drill steps

1. **Create an empty scratch database.** Local, or any disposable Postgres. Never restore over anything live.
   ```bash
   createdb ihype_drill
   ```

2. **Restore the backup into it.** One command — it downloads, decrypts, checks the archive parses, and restores with `--exit-on-error`:
   ```bash
   RESTORE_TARGET_URL='postgresql://localhost:5432/ihype_drill' \
   BACKUP_PASSPHRASE='...' \
   CLOUDFLARE_API_TOKEN='...' CLOUDFLARE_ACCOUNT_ID='...' \
   CONFIRM_RESTORE='restore into scratch' \
   npm run backup:restore -- --key=latest.dump.gpg
   ```
   Use a `week/` or `month/` key to drill an older copy — drilling only `latest` proves the newest object and nothing about the rotation.

   It refuses three ways, and each is deliberate: the target must not share an identity with `DIRECT_URL`/`DATABASE_URL`/`PRODUCTION_DATABASE_URL`; the target must be **empty** (restoring over existing rows produces a state that is neither the backup nor what was there, and signing that off is worse than a failed drill); and `CONFIRM_RESTORE` must be exact.

   A clean restore reports **zero** errors. It can, because the dump excludes the `stripe` schema by name rather than selecting `public` — selecting emits a `CREATE SCHEMA public` that always fails and drops the `CREATE EXTENSION` lines, and one expected error is one too many for `--exit-on-error` to mean anything. Any error here is a real one.

3. **Verify the restore with the read-only checker:**
   ```bash
   RESTORE_DATABASE_URL='postgresql://localhost:5432/ihype_drill' \
   PRODUCTION_DATABASE_URL='postgresql://...' \
   CONFIRM_RESTORE_DRILL='verify isolated restore' \
   npm run verify:restore
   ```
   The checker refuses to run when the restore and production database identities match, and **exits non-zero on every failure** — so it is safe to script. Save its JSON output with the drill evidence.

   `PRODUCTION_DATABASE_URL` is a **guard only**: the checker never connects to it. It exists so the drill cannot be run against production by mistake. The count comparison in step 4 stays manual and stays yours.

   It fails a restore that carries its rows but not their critical fields — a captured `TicketOrder` with no `stripePaymentIntentId` (unrefundable), an onboarded `Profile` with no `stripeConnectAccountId` (unpayable), a ticket with no serialized id, a vanished audit trail. Verified 2026-08-31 by corrupting each in a scratch restore: before this, all of them reported PASS.

4. **Independently compare the critical counts:**
   ```sql
   SELECT (SELECT COUNT(*) FROM "User")    AS users,
          (SELECT COUNT(*) FROM "Show")    AS shows,
          (SELECT COUNT(*) FROM "Profile") AS profiles;
   SELECT COUNT(*), MAX(migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL;
   ```
   Compare against the backup-check email from the day the dump was taken. Counts should match to within a day's organic growth; the migration count/name must match exactly.

   The `stripe` schema is **deliberately absent** from the restore. It is the Supabase Stripe Sync Engine's, installed outside this repo, read by no application code, and re-derivable — Stripe is the source of truth. Its absence is correct, not a finding.

5. **Spot-check application-critical data** on the restore. Step 3 asserts the machine-checkable half — payment linkage, payout linkage, serialized ids, the audit trail — so what is left for a human is judgement: does the most recent show look like a real show, does an order's amount match what the charter's split would produce, is the newest row roughly as recent as the dump.

6. **Tear down** the scratch database immediately (`dropdb ihype_drill`) — it contains production PII and it must not outlive the drill. Delete any decrypted `.dump` file too; the scripts work in a temp directory they clean up, but a manual download will not.

7. **Record the result:** send an email to admin@ihype.org with subject `Restore drill YYYY-MM — PASS/FAIL`, the key restored, counts observed, and teardown confirmation. Keep these — they are the compliance evidence.

8. **Update the alpha gate:** only after every step passes, set the Worker secret `RESTORE_DRILL_VERIFIED_AT` to the UTC timestamp from the checker output. Never set it from a live-database health check.

## If the drill fails

- **No recent backup exists at all** (the workflow has not run, or every run warns "not configured") → **P1**. The platform is holding member data with no copy outside the live cluster. Complete the one-time setup the same day.
- **Download or decryption fails** → **P1**, and worse than it looks: the stored objects may all be unopenable. Check the passphrase against the copy kept outside GitHub. The backup script verifies a decrypt round-trip on every run, so a failure here means the *secret* changed, not the object.
- **Restore fails** → **P1**. Re-run against an older `week/`/`month/` key to find out whether it is one bad object or the whole rotation.
- **Counts or migrations mismatch** → check whether the dump predates a recent migration or seed; retry with a fresher key before escalating.
- **Application spot-checks fail on a healthy-looking restore** → escalate to incident response (data corruption in backups).
