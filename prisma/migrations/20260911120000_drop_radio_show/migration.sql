-- Drops what is left of the radio-show feature, retired by owner instruction
-- on 2026-09-11 ("remove all references to radio shows — this was the old
-- feature that we've deleted").
--
-- The CODE half is already deployed: nothing reads `Show.isRadioShow`,
-- `RadioShowTrack` or `NotificationPreference.radioLive` any more, and they
-- are out of schema.prisma. This file is only the column drop.
--
-- THE CHECKS THIS FILE WAS PARKED FOR, RUN AGAINST PRODUCTION
-- (project bjkabtzvgfshsrmjhrkx) ON 2026-09-12 AT 00:0X UTC:
--
--   SELECT
--     (SELECT count(*) FROM "Show" WHERE "isRadioShow" = true)  AS radio_shows,
--     (SELECT count(*) FROM "RadioShowTrack")                   AS radio_tracks,
--     (SELECT count(*) FROM "NotificationPreference"
--        WHERE "radioLive" = false)                             AS muted_radio;
--
--   radio_shows  = 0
--   radio_tracks = 0
--   muted_radio  = 0
--
-- Two CONTROL counts were taken in the same query, because a zero from an
-- empty table proves nothing and this file's whole purpose is not taking that
-- on trust:
--
--   Show                   total = 8   (so `isRadioShow = true` is 0 of 8 real
--                                       rows, not 0 of 0)
--   NotificationPreference total = 1   (only one member has ever written a
--                                       preference row at all, so read the
--                                       muted_radio zero as thin rather than
--                                       strong — it costs nothing either way,
--                                       since `radioLive` had no sender to
--                                       mute)
--
-- Recording a verdict ("checked, all zero") is not the same as recording the
-- counts: a week from now nobody can re-run the check against the database as
-- it was tonight, and only the numbers survive that. This header is why the
-- file moved out of prisma/migrations-pending/.

DROP TABLE IF EXISTS "RadioShowTrack";

DROP INDEX IF EXISTS "Show_isRadioShow_status_idx";

ALTER TABLE "Show" DROP COLUMN IF EXISTS "isRadioShow";

ALTER TABLE "NotificationPreference" DROP COLUMN IF EXISTS "radioLive";
