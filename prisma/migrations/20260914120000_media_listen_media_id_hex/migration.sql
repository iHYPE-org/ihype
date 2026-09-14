-- MediaListen.mediaId is the track's hexId, and the rows the listen route
-- wrote under the ROW id are moved onto it (DESIGN_SYNC row 436).
--
-- Every reader of this table has always filtered `mediaId IN (hexIds)`:
-- profile-insights (the public artist card's Listens and Listeners counters),
-- profile-stat-board (the Listens and Completed listens tiles), the artist
-- analytics page, the track page's play count, and prisma/seed.ts writes the
-- hexId too. Only POST /api/media-listens disagreed — it stored `media.id`,
-- the cuid — so no listen it ever recorded was counted by any surface a
-- member reads. The route stores the hexId as of this deploy; this moves what
-- it stored before, so history is counted rather than abandoned.
--
-- DATA migration, no DDL. Idempotent by construction: once a row carries a
-- hexId it matches no ArtistMediaAsset.id and both statements match nothing.
--
-- Two statements, in this order, because (userId, mediaId) is UNIQUE:
--   1. drop a row-id row whose hexId twin already exists for the same member —
--      a duplicate UPDATE would otherwise fail, and a failed migration blocks
--      every later production deploy (CLAUDE.md's P3009 incident). The twin is
--      the newer record: the route only ever wrote hexId rows from this deploy
--      on, so in practice this matches nothing and is here as the guard.
--   2. rewrite the rest onto the asset's hexId.
-- An orphan (a listen whose asset was deleted) matches neither join and is
-- left as it is; it was uncounted before and stays uncounted.

DELETE FROM "MediaListen" ml
USING "ArtistMediaAsset" a, "MediaListen" twin
WHERE ml."mediaId" = a."id"
  AND twin."userId" = ml."userId"
  AND twin."mediaId" = a."hexId";

UPDATE "MediaListen" ml
SET "mediaId" = a."hexId"
FROM "ArtistMediaAsset" a
WHERE ml."mediaId" = a."id";
