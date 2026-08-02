# Runbook — Monthly Backup Restore Drill

**Owner:** admin@ihype.org · **Cadence:** monthly (the daily `backup-verify` cron email reminds you on the 1st) · **Time needed:** ~20 minutes

The daily `backup-verify` cron proves the *live* database is up, populated, and fresh. It does **not** prove a backup can be restored. This drill does. (SOC 2 A1.2 / ISO 27002 8.13 / NIST CSF RC.RP — recovery must be *tested*, not assumed.)

## Prerequisites
- Supabase dashboard access to project `bjkabtzvgfshsrmjhrkx` (Postgres, PITR enabled on the current plan — verify under Database → Backups before starting; if PITR is not enabled, that is itself a P1 finding).
- The most recent `✓ iHYPE daily backup check` email (it contains the expected row counts and latest migration name).

## Drill steps
1. **Pick a restore point** — Supabase Dashboard → Database → Backups → Point in Time. Choose a timestamp ~24 h ago.
2. **Restore to a fork, never in place** — use "Restore to new project" (or a database branch on plans that support it). Do not restore over production.
3. **Verify the fork with the read-only checker:**
   ```bash
   RESTORE_DATABASE_URL='postgresql://...' \
   PRODUCTION_DATABASE_URL='postgresql://...' \
   CONFIRM_RESTORE_DRILL='verify isolated restore' \
   npm run verify:restore
   ```
   The checker refuses to run when the restore and production database identities match. Save its JSON output with the drill evidence.
4. **Independently compare the critical counts:**
   ```sql
   SELECT (SELECT COUNT(*) FROM "User")    AS users,
          (SELECT COUNT(*) FROM "Show")    AS shows,
          (SELECT COUNT(*) FROM "Profile") AS profiles;
   SELECT COUNT(*), MAX(migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL;
   ```
   Compare against the backup-check email from the chosen restore point's day. Counts should match to within a day's organic growth; the migration count/name must match exactly.
5. **Spot-check application-critical data** on the fork: one recent `TicketOrder` (confirmationCode + stripePaymentIntentId present), one `Profile` with `stripeConnectAccountId`, one `AuditLog` row.
6. **Tear down** the fork project immediately (it contains production PII — it must not outlive the drill).
7. **Record the result:** send an email to admin@ihype.org with subject `Restore drill YYYY-MM — PASS/FAIL`, the restore point used, counts observed, and teardown confirmation. Keep these — they are the compliance evidence.
8. **Update the alpha gate:** only after every step passes, set the Worker secret `RESTORE_DRILL_VERIFIED_AT` to the UTC timestamp from the checker output. Never set it from a live-database health check.

## If the drill fails
- Restore fails to start / PITR unavailable → treat as **P1**: open a Supabase support ticket the same day; the platform is running without proven backups.
- Counts or migrations mismatch → check whether the restore point predates a recent migration or seed; retry with a fresh timestamp before escalating.
- Application spot-checks fail on a healthy-looking restore → escalate to incident response (data corruption in backups).
