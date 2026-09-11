-- @gated — do not move this into prisma/migrations/ until the checks below
-- have been RUN and their counts written into this header.
--
-- Drops what is left of the radio-show feature, retired by owner instruction
-- on 2026-09-11 ("remove all references to radio shows — this was the old
-- feature that we've deleted").
--
-- The CODE half is already deployed: nothing reads `Show.isRadioShow`,
-- `RadioShowTrack` or `NotificationPreference.radioLive` any more, and they
-- are out of schema.prisma. This file is only the column drop, and it is
-- parked rather than applied because this session cannot read production —
-- the Supabase connector is unauthorized here, so the counts below are
-- UNVERIFIED and must not be taken on trust.
--
-- WHY IT IS PROBABLY SAFE, AND WHY THAT IS NOT ENOUGH. Nothing in the product
-- has ever written `isRadioShow = true`: the two authoring paths (the Radio
-- Show Creator's production-plan flow and the older flat radioTracks flow)
-- went with the DJ role on 2026-08-06. `radioLive` was written by Settings
-- but read by no sender, so dropping it loses a preference nobody could act
-- on. None of that is a row count.
--
-- RUN THIS FIRST, AND WRITE THE THREE NUMBERS INTO THIS HEADER:
--
--   SELECT
--     (SELECT count(*) FROM "Show" WHERE "isRadioShow" = true)  AS radio_shows,
--     (SELECT count(*) FROM "RadioShowTrack")                   AS radio_tracks,
--     (SELECT count(*) FROM "NotificationPreference"
--        WHERE "radioLive" = false)                             AS muted_radio;
--
--   radio_shows  = ___   (must be 0 — a non-zero means a show would lose its
--                         format flag and its tracklist; stop and ask)
--   radio_tracks = ___   (must be 0)
--   muted_radio  = ___   (may be any number: these are members who turned OFF
--                         a notification that never had a sender, so the
--                         preference is not losing them anything)
--
-- Recording a verdict ("checked, all zero") is not the same as recording the
-- counts: a week later nobody can re-run the check against the database as it
-- was tonight, and only the numbers survive that.

DROP TABLE IF EXISTS "RadioShowTrack";

DROP INDEX IF EXISTS "Show_isRadioShow_status_idx";

ALTER TABLE "Show" DROP COLUMN IF EXISTS "isRadioShow";

ALTER TABLE "NotificationPreference" DROP COLUMN IF EXISTS "radioLive";
