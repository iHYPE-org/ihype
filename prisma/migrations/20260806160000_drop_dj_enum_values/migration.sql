-- Ungated 2026-08-06. Both counts re-verified 0 against production
-- immediately before the move, which is the condition below. The DO block
-- guard stays regardless -- it costs nothing and refuses cleanly if a row
-- appears between this check and the deploy.
--
-- Step 4 (final) of the DJ role removal — docs/dj-role-removal-scope.md.
-- Drops DJ from both enums. This was parked in prisma/migrations-pending/
-- until the row counts were verified, then moved here deliberately in its own
-- commit -- the workflow described in that directory's README.
--
-- WHY THIS IS GATED RATHER THAN SHIPPED WITH THE CODE
--
-- It is irreversible in the way that matters: PostgreSQL has no DROP VALUE for
-- an enum, so this rebuilds both types. If any row still holds 'DJ' when it
-- runs, the ALTER fails, and a failed migration leaves a finished_at IS NULL
-- row in _prisma_migrations that makes EVERY subsequent production deploy fail
-- with P3009 — see CLAUDE.md: that exact fault shipped nothing for a day and
-- went unnoticed because the deploy's later steps are skipped, not failed.
--
-- BEFORE MOVING THIS ACROSS, confirm both are still zero:
--
--   SELECT count(*) FROM "Profile" WHERE type = 'DJ';   -- expect 0
--   SELECT count(*) FROM "User"    WHERE role = 'DJ';   -- expect 0
--
-- They were 0 when this was written (verified against production after
-- migration 20260806130000_reassign_dj_profiles applied at 15:28Z on
-- 2026-08-06), and nothing can create a new one: the signup door closed in
-- step 1a, DJ is out of schema.prisma as of this commit, and the seed scripts
-- were repointed at ARTIST. Re-check anyway — this is the step where being
-- wrong is expensive.
--
-- The guards below make it safe to be wrong: each ALTER is preceded by a check
-- that raises a clear exception instead of letting the type rebuild fail with
-- a constraint violation halfway through.

DO $$
DECLARE
  stragglers integer;
BEGIN
  SELECT count(*) INTO stragglers FROM "Profile" WHERE type = 'DJ';
  IF stragglers > 0 THEN
    RAISE EXCEPTION 'Refusing to drop DJ: % Profile row(s) still have type = DJ. Reassign them first.', stragglers;
  END IF;

  SELECT count(*) INTO stragglers FROM "User" WHERE role = 'DJ';
  IF stragglers > 0 THEN
    RAISE EXCEPTION 'Refusing to drop DJ: % User row(s) still have role = DJ. Reassign them first.', stragglers;
  END IF;
END $$;

-- Rebuild ProfileType without DJ. The default is dropped and restored around
-- the type swap because a column default is bound to the old type.
ALTER TYPE "ProfileType" RENAME TO "ProfileType_old";
CREATE TYPE "ProfileType" AS ENUM ('ARTIST', 'VENUE', 'LISTENER');
ALTER TABLE "Profile" ALTER COLUMN "type" TYPE "ProfileType" USING ("type"::text::"ProfileType");
DROP TYPE "ProfileType_old";

-- Rebuild Role without DJ. User.role carries DEFAULT 'FAN'.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('FAN', 'ARTIST', 'VENUE', 'ADMIN', 'ADVERTISER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'FAN';
DROP TYPE "Role_old";
