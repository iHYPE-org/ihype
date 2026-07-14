-- Server-computed at upload time (src/lib/audio-duration.ts) — lets the
-- radio ad-interjection module (RadioShowCreator's ad breaks) size a real
-- spot into a timeline the same way it already does for placeholder clips.
ALTER TABLE "Ad" ADD COLUMN "audioDurationSecs" INTEGER;
