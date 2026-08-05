-- @gated
--
-- Drop the DJ role. Operator decision, 2026-08-05: "delete DJ role, it's too
-- complicated. we're going to use radio as a premade thing, based on
-- recommendations genres hype and friend suggestion instead."
--
-- This is the sign-off BACKEND_REWRITE.md §1 was waiting for.
--
-- ============================================================================
-- DO NOT `git mv` THIS INTO prisma/migrations/ UNTIL THE AUDIT BELOW IS DONE.
-- Everything in prisma/migrations/ applies to production automatically on push
-- to main. A failure here leaves a `finished_at IS NULL` row in
-- _prisma_migrations and every subsequent deploy fails with P3009 — that has
-- happened before and production shipped nothing for a day.
-- ============================================================================
--
-- REQUIRED AUDIT, before moving this across:
--
--   SELECT type, count(*) FROM "Profile" GROUP BY type;
--   SELECT role, count(*) FROM "User" GROUP BY role;
--   -- Which DJs actually published anything?
--   SELECT p.id, p.slug, p."isVerified",
--          (SELECT count(*) FROM "ArtistMediaAsset" m WHERE m."profileId" = p.id) AS tracks,
--          (SELECT count(*) FROM "Show" s WHERE s."headlinerProfileId" = p.id) AS shows
--     FROM "Profile" p WHERE p.type = 'DJ';
--
-- If that returns zero DJ rows, this migration is pure schema cleanup and is
-- safe. If it returns rows, read the verification note in step 2 first.
--
-- Postgres cannot remove a value from an enum in place, so each enum is
-- rebuilt. Both enums are done in ONE migration because a half-migrated state
-- (Role without DJ, ProfileType with it) would break every profile query.
--
-- SEQUENCING: prisma/schema.prisma still contains DJ in both enums, on purpose.
-- Drop it from the schema in the SAME commit that moves this file into
-- prisma/migrations/ — not before. If the schema loses DJ while the database
-- still has DJ rows, the generated client's types stop admitting a value the
-- database still returns.

-- ---------------------------------------------------------------------------
-- 1. Reassign, never delete.
-- ---------------------------------------------------------------------------
-- Profile rows cascade to media, shows, payable entries and tickets. Deleting a
-- DJ profile would take an artist's uploads and a venue's settlement history
-- with it. ARTIST is the destination because that is where uploads and shows
-- already live; the promoter mechanic needs no role at all.
UPDATE "Profile" SET type = 'ARTIST' WHERE type = 'DJ';
UPDATE "User" SET role = 'ARTIST' WHERE role = 'DJ';

-- ---------------------------------------------------------------------------
-- 2. Verification standing does NOT carry over.
-- ---------------------------------------------------------------------------
-- BACKEND_REWRITE.md §1: "a DJ who never uploaded a track shouldn't silently
-- gain artist verification standing." A verified DJ was verified as a DJ. This
-- resets only rows that were verified AND have no uploads, so a working DJ who
-- was really publishing music keeps their standing and an empty account has to
-- re-verify.
--
-- NOTE: this drops those accounts below the upload gate until they re-verify.
-- That is intentional, and it is the one user-visible consequence of this
-- migration. If the audit above shows this affecting real accounts, tell them
-- before running it.
UPDATE "Profile" p
   SET "isVerified" = false,
       verified = false,
       "verificationStatus" = 'UNVERIFIED',
       "verificationRequested" = false
 WHERE p.type = 'ARTIST'
   AND (p."isVerified" OR p.verified)
   AND NOT EXISTS (SELECT 1 FROM "ArtistMediaAsset" m WHERE m."profileId" = p.id)
   -- Only rows this migration just converted. Without this clause the statement
   -- would un-verify every empty artist profile on the platform.
   AND p."updatedAt" >= now() - interval '1 minute';

-- ---------------------------------------------------------------------------
-- 3. Rebuild ProfileType without DJ.
-- ---------------------------------------------------------------------------
ALTER TYPE "ProfileType" RENAME TO "ProfileType_old";
CREATE TYPE "ProfileType" AS ENUM ('ARTIST', 'VENUE', 'LISTENER');
ALTER TABLE "Profile"
  ALTER COLUMN type TYPE "ProfileType" USING type::text::"ProfileType";
DROP TYPE "ProfileType_old";

-- ---------------------------------------------------------------------------
-- 4. Rebuild Role without DJ.
-- ---------------------------------------------------------------------------
-- Values and ORDER must match prisma/schema.prisma's Role enum exactly, minus
-- DJ. Order is not cosmetic: Postgres orders enum values by definition order, so
-- a reordered enum silently changes the result of any ORDER BY on this column.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('FAN', 'ARTIST', 'VENUE', 'ADMIN', 'ADVERTISER');
ALTER TABLE "User"
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE "Role" USING role::text::"Role",
  ALTER COLUMN role SET DEFAULT 'FAN';
DROP TYPE "Role_old";
