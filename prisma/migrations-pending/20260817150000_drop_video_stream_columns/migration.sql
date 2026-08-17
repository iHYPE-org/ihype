-- GATED DESTRUCTIVE MIGRATION
-- iHYPE is audio-only. Apply only after the schema/code release that stops
-- selecting these legacy columns has been running successfully.
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "featureVideoUrl";
ALTER TABLE "Show" DROP COLUMN IF EXISTS "streamProvider";
ALTER TABLE "Show" DROP COLUMN IF EXISTS "streamPlaybackId";
ALTER TABLE "Show" DROP COLUMN IF EXISTS "streamKeyMasked";
