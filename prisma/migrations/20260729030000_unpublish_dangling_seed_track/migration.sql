-- Unpublishes the launch-seed demo track, whose storageUrl has never resolved.
--
-- https://ihype.org/seed/static-bloom-demo.mp3 returns HTTP 404 — the file was
-- never uploaded. That row is currently the ONLY published ArtistMediaAsset in
-- production, so the single track a visitor can press play on is guaranteed to
-- fail. The player now surfaces the failure and skips instead of hanging, but
-- shipping a catalogue that is 100% broken links is worse than shipping an
-- empty one: an empty state is honest, a dead play button is not.
--
-- Deliberately an UPDATE, not a DELETE:
--   * reversible in a single statement, no data lost
--   * keeps the hexId stable, so any existing /tracks/<hexId> or
--     /embed/<hexId> link does not start 404ing
--   * re-running prisma/launch-seed.ts will not re-publish it — that upsert
--     now sets isPublished: false on both create and update
--
-- To publish it later: upload a real audio file to that URL (or repoint
-- storageUrl at R2), then set isPublished = true.

UPDATE "ArtistMediaAsset"
SET "isPublished" = false
WHERE "hexId" = '0xlaunch000000000000000000000000000010';
