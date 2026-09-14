-- FanPlaylistItem.mediaId and FanFavoriteMedia.mediaId name the track by its
-- hexId, and the rows written under any other name are moved onto it
-- (DESIGN_SYNC row 437).
--
-- Five writers had filled these two columns with three different names for
-- one track: the hexId (the free-use crate, the station and chart rows through
-- the player's heart), the asset's ROW id (a card saved from the discover deck,
-- and the heart while a deck card played), and `radio-<hexId>` (the heart
-- while an autoplay row played — the player prefixed those queue entries).
-- The shared playlist page links every row to /app/tracks/<mediaId>, the
-- media backfill cascades a moved file by mediaId, and the heart reads back
-- by mediaId, so a track liked under one name never lit under another and a
-- row-id item linked to a 404. Every writer stores the hexId as of this deploy;
-- this moves what they stored before.
--
-- DATA migration, no DDL. Idempotent by construction: a hexId matches no
-- ArtistMediaAsset.id and carries no `radio-` prefix, so a re-run matches
-- nothing. A row whose asset is gone matches neither join and is left alone.
--
-- FanFavoriteMedia is UNIQUE on (userId, mediaId), so a row that would land on
-- a twin already stored under the hexId is dropped first — a duplicate UPDATE
-- would otherwise fail the migration and block every later production deploy
-- (CLAUDE.md's P3009 incident). FanPlaylistItem has no such key: a playlist
-- may legitimately hold the same track twice, so its rows are only rewritten.

-- 1. Favourites stored under `radio-<hexId>`.
DELETE FROM "FanFavoriteMedia" f
USING "FanFavoriteMedia" twin
WHERE f."mediaId" LIKE 'radio-0x%'
  AND twin."userId" = f."userId"
  AND twin."mediaId" = substring(f."mediaId" from 7);

UPDATE "FanFavoriteMedia"
SET "mediaId" = substring("mediaId" from 7)
WHERE "mediaId" LIKE 'radio-0x%';

-- 2. Favourites stored under the asset's row id.
DELETE FROM "FanFavoriteMedia" f
USING "ArtistMediaAsset" a, "FanFavoriteMedia" twin
WHERE f."mediaId" = a."id"
  AND twin."userId" = f."userId"
  AND twin."mediaId" = a."hexId";

UPDATE "FanFavoriteMedia" f
SET "mediaId" = a."hexId"
FROM "ArtistMediaAsset" a
WHERE f."mediaId" = a."id";

-- 3. Playlist items, both shapes, no unique key to guard.
UPDATE "FanPlaylistItem"
SET "mediaId" = substring("mediaId" from 7)
WHERE "mediaId" LIKE 'radio-0x%';

UPDATE "FanPlaylistItem" i
SET "mediaId" = a."hexId"
FROM "ArtistMediaAsset" a
WHERE i."mediaId" = a."id";
