-- Every fan profile created before 2026-09-15 is TITLED WITH ITS HEX ID.
--
-- `POST /api/register` read `profileName = profileType === 'LISTENER' ? hexId
-- : trimmedName` and wrote that 34-character `0x…` string into Profile.name —
-- the value the fan pane's <title>, the Pages card and every avatar monogram
-- render, because no display-name resolver exists and every consumer renders
-- Profile.name raw. The code half is fixed; this repairs the rows it wrote.
--
-- DATA ONLY. No schema change, nothing dropped, and therefore not gated:
-- leaving it unrun means every existing fan keeps a title nobody can read.
--
-- THE PREDICATE IS DELIBERATELY EXACT. `^0x[0-9a-f]{32}$` is the shape
-- createHexId() emits and nothing a member could plausibly have typed, so a
-- fan who has since renamed their page through the profile editor is not
-- touched. The replacement is User.username, which is what User.name already
-- holds for a FAN (register line ~332) and what the handle under the title
-- already displays — so the card stops disagreeing with itself.
--
-- User.username is `String @unique` (schema.prisma:96) so it is never null;
-- the length guard is against an empty or whitespace-only value, which would
-- trade an unreadable title for no title at all. Such a row keeps its hex.
UPDATE "Profile" AS p
SET "name" = u."username"
FROM "User" AS u
WHERE p."ownerId" = u."id"
  AND p."type" = 'LISTENER'
  AND p."name" ~ '^0x[0-9a-f]{32}$'
  AND length(btrim(u."username")) > 0;
