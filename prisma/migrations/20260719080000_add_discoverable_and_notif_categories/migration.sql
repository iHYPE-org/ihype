-- Per-role Settings.dc.html templates (DESIGN_SYNC row 223) add a real
-- "Show me in discovery" / "Show me in demand radar" toggle and a few
-- notification categories that had no honest match among the existing 4
-- NotificationPreference fields. Both additive, both default to the current
-- always-on/always-discoverable behavior so no existing user/profile
-- changes visibility or notification behavior on migrate.

ALTER TABLE "Profile" ADD COLUMN "discoverable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "NotificationPreference" ADD COLUMN "radioLive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "crateUploads" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "bookingRequests" BOOLEAN NOT NULL DEFAULT true;
