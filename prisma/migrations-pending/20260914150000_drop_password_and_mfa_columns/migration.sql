-- @gated
--
-- Drops the four columns of a credential model this product does not have.
--
-- iHYPE signs members in with a passkey or a magic link and nothing else:
-- there is no password field on any form, no login path reads
-- `User.passwordHash`, and no code path has ever written or read
-- `mfaSecret`, `mfaEnabledAt` or `mfaBackupCodes` except to null them. The
-- columns date from migration 20260311200433_mandatory_mfa_logins, a design
-- the product left before alpha. What kept them alive was a workflow
-- (`reset-test-logins.yml`, deleted 2026-09-14) that set a shared password
-- hash on EVERY user row and deleted EVERY passkey, session and magic-link
-- token in production in one transaction — permanent lockout for a
-- passkey-only account — in the name of resetting five demo logins.
--
-- The CODE half is deployed: the columns are out of schema.prisma, register
-- no longer accepts a `password`, both seeds and the erasure path no longer
-- name them. This file is only the column drop.
--
-- Before applying, run against production and RECORD THE NUMBERS HERE, not a
-- verdict (a verdict cannot be re-checked a week later; the counts can):
--
--   SELECT
--     (SELECT count(*) FROM "User")                                 AS users,
--     (SELECT count(*) FROM "User" WHERE "passwordHash" IS NOT NULL) AS with_password_hash,
--     (SELECT count(*) FROM "User" WHERE "mfaSecret" IS NOT NULL)    AS with_mfa_secret,
--     (SELECT count(*) FROM "User" WHERE "mfaEnabledAt" IS NOT NULL) AS with_mfa_enabled,
--     (SELECT count(*) FROM "User" WHERE "mfaBackupCodes" IS NOT NULL) AS with_backup_codes;
--
-- A non-zero `with_password_hash` is EXPECTED (registrations before
-- 2026-08-05 could send a password, and the deleted workflow set one) and is
-- not a reason to keep the column: nothing verifies it. A non-zero MFA count
-- would be surprising and worth reading before the drop, because no code has
-- ever written those columns.

ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "mfaSecret";
ALTER TABLE "User" DROP COLUMN IF EXISTS "mfaEnabledAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "mfaBackupCodes";
