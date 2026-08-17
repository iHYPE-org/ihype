-- Activated 2026-08-17 after the audio-only schema and runtime had been
-- validated without selecting any legacy video or stream columns.
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "featureVideoUrl";
ALTER TABLE "Show" DROP COLUMN IF EXISTS "streamProvider";
ALTER TABLE "Show" DROP COLUMN IF EXISTS "streamPlaybackId";
ALTER TABLE "Show" DROP COLUMN IF EXISTS "streamKeyMasked";
