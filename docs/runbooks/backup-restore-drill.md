# Runbook — Monthly Backup Restore Drill

**Owner:** admin@ihype.org · **Cadence:** monthly (the daily `backup-verify` cron email reminds you on the 1st) · **Time needed:** ~20 minutes

The daily `backup-verify` cron proves the *live* database is up, populated, and fresh. It does **not** prove a backup can be restored. This drill does. (SOC 2 A1.2 / ISO 27002 8.13 / NIST CSF RC.RP — recovery must be *tested*, not assumed.)

## The drill runs itself every night (2026-09-10)

`.github/workflows/restore-drill.yml` does steps 1–4 of this runbook by machine at 03:37 UTC: it downloads `latest.dump.gpg` from R2, decrypts it, restores it into an empty Postgres 17 service container with `--exit-on-error`, runs `npm run verify:restore` (rows, completed migrations, and the four critical-column checks), and compares the restored migration count with `prisma/migrations/` on `main` through `scripts/assert-restore-schema.mjs` — a dump may trail the code by at most three migrations and may never lead it. **On a pass it writes `cron-alive:restore-drill` into the runtime KV** with a two-day TTL. Three things read that key: `checkCronHealth()` in the six-hourly health check alerts when it is absent (so a drill that never ran is reported, which a workflow that only turns red when it runs cannot do for itself); the admin routine board shows when the drill last passed; and `evaluateRestoreDrill()` counts it as restore evidence beside `RESTORE_DRILL_VERIFIED_AT`, so the alpha-readiness gate and the monthly duty read clear from the automated pass. The `backup-verify` email names the last automated pass and only calls the hand drill due when none is recorded.

**The hand drill below is still worth knowing**, for three reasons: it is what to do when the automated one fails and its report artifact says why; it is the only version that restores a `week/` or `month/` slot rather than `latest`; and it is the only one that reads counts against the live database, which the workflow deliberately never connects to (`PRODUCTION_DATABASE_URL` is passed to it only so the same-identity guard has something to refuse). Set `RESTORE_DRILL_VERIFIED_AT` after a hand drill as before; the newer of the two sources is the evidence.

## What backs this platform up, and what it does not

**There is no Supabase point-in-time recovery, on purpose.** PITR is a paid add-on and this project has no starting capital. The free plan does not include downloadable daily backups either, so the encrypted dumps written by `.github/workflows/backup-database.yml` are the **only** copy of the database that exists outside the live cluster. That workflow is not a convenience; it is the backup.

**Accepted RPO: 8 hours — measured, not scheduled.** The workflow *asks* for 00:00, 06:00, 12:00 and 18:00 UTC, and this file said "6 hours" on the strength of that cron expression for as long as it existed. A scheduled GitHub workflow is a request with no SLA behind it: measured over 24 successful runs (2026-09-01 → 09-06) **not one fired on time** — 2.21 to 5.48 h late, median 4.14 — and because the delay varies, the gap between consecutive dumps swung **4.47 to 7.93 h**, with 48% of gaps past the 6 h then promised. Eight hours is what the platform actually delivers, so eight hours is what this promises. A total loss of the cluster loses at most the transactions since the last dump.

**`npm run check:backup-cadence` is what keeps this number honest**, and it runs nightly. It measures the delivered gaps rather than reading the cron, warns past the 8 h target (GitHub's queue is nobody here's to clear) and fails past 12 h or if the workflow stops firing at all. The schedule moved off `:00` to `:37` on 2026-09-07 because the top of the hour is GitHub's most congested minute — **that is a hypothesis about the queue, not a measurement.** Re-run the probe after a week and lower this number only if it earns it. PITR would make that seconds. This is a recorded, accepted risk of running without capital — it is a worse RPO, not an absent recovery capability, and it is reviewed when the platform starts holding real money.

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
2. **Give an API token R2 write.** Cloudflare → profile menu → **My Profile** → **API Tokens** (an account-owned token lives under Manage Account → API Tokens instead). Find the token behind the `CLOUDFLARE_API_TOKEN` Actions secret → ⋯ → **Edit** → **+ Add more** → Account · **Workers R2 Storage** · **Edit** → Continue to summary → Save. **Editing a token does not change its value**, so the GitHub secret needs no update.

   No S3 access key is needed — `wrangler r2 object put` authenticates with the API token. **Do not use R2 → "Manage R2 API tokens"** for this: that page's **Object Read & Write** permission is documented as S3-API only, and wrangler goes through the Cloudflare REST API, so a bucket-scoped token from there fails. The REST path needs account-wide **Workers R2 Storage Write** (shown as "Edit" in the token editor, "Admin Read & Write" on the R2 page).

   That means a per-bucket backup credential is not available, and the separation this runbook asks for is bucket separation, not credential separation. If you would rather the deploy token stay untouched and independently revocable, mint a second token with the same permission and store it as the Actions secret **`BACKUP_R2_API_TOKEN`** — both scripts prefer it and fall back to `CLOUDFLARE_API_TOKEN`. Be clear-eyed about what that buys: a compromised deploy token carrying R2 write can delete the backups, and a separate token only helps if the deploy token is *not* also given the permission.
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

   It prints a line naming the **platform extensions it skipped, each with its reason**, and that line is expected. "Cannot host" has two halves: the target may not PROVIDE the extension (`pg_cron`, `pg_net`, `pgmq`, `supabase_vault` — a stock Postgres has never heard of them), or the extension may live in a SCHEMA the archive does not restore (`btree_gist WITH SCHEMA stripe`: available everywhere, but `stripe` is excluded from the dump by name). The script reads the target's own `pg_available_extensions`, reads each extension's schema out of the archive's own SQL (a TOC entry says `-` where an extension's schema would go), drops both table-of-contents entries each unhostable one occupies — the `CREATE` and the `COMMENT ON`; dropping only the first moves the failure one line down — and restores the rest. This is the same judgement as the `stripe` schema in step 4: the platform's furniture, not the product's. **`pg_trgm` is the exception and is never skipped** — this repository's own migrations create it, so a target that cannot host it fails the drill by name. That distinction is the whole safety property; a filter that skipped an application extension would turn a broken restore into a green one.

   This is why the drill FAILED on each of the first three times it ran — twice on `extension "pg_cron" is not available`, then, with those skipped, on `schema "stripe" does not exist`. The dumps were fine throughout; nothing had ever restored one.

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
