-- Step 3 of the DJ role removal (docs/dj-role-removal-scope.md).
--
-- Reassigns the DJ rows to ARTIST. This is a DATA migration only: both enums
-- keep their DJ value here on purpose, so this is reversible and does not
-- depend on any code being deployed first. The enum rewrite is step 4 and must
-- be a SEPARATE deploy -- a failed migration blocks every production deploy
-- (CLAUDE.md's P3009 incident: production shipped nothing for a day).
--
-- Counts were re-taken against production immediately before writing this, as
-- the scope doc requires, and are unchanged from the 2026-08-05 audit:
--   Profile.type = 'DJ'   3   (south-loop-signal, suzike, buruka)
--   User.role    = 'DJ'   2   (the third profile is owned by an ADMIN)
--   verified 0 / uploads 0 / Connect accounts 0 / lineup slots 0 /
--   payable entries 0 / shows headlined 0 / followers 0 / hypes 0 / listens 0
-- So this is a cleanup, not a migration: no money, no audience and no content
-- moves. That window stayed open only because step 1a closed the signup door --
-- `role: 'DJ'` has been rejected at /api/register since.
--
-- ARTIST rather than LISTENER: all three are music acts with public pages, and
-- ARTIST keeps those pages resolving (at /artists/[slug], with /promoters/[slug]
-- and /djs/[slug] redirecting there in this same deploy). LISTENER would have
-- orphaned three live URLs for no benefit.
--
-- Idempotent by construction: the WHERE clauses match nothing on a re-run.

UPDATE "Profile" SET type = 'ARTIST' WHERE type = 'DJ';

-- Only accounts whose role is literally DJ. The admin-owned profile's owner
-- keeps ADMIN: the role describes the account, not a page it happens to hold.
UPDATE "User" SET role = 'ARTIST' WHERE role = 'DJ';
