-- Per-followed-artist notification muting: followers can turn off
-- show/activity notifications for an individual profile they follow.

ALTER TABLE "Follow" ADD COLUMN "notifyShows" BOOLEAN NOT NULL DEFAULT true;
