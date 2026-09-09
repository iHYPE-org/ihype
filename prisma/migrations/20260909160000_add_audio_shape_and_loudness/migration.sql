-- Audio shape and loudness on uploaded tracks.
--
-- Purely additive: six nullable columns, no default, no backfill, no rewrite of
-- existing rows. Every existing track keeps NULL in all six, which is the
-- correct reading — nothing measured them, and a null here means "unmeasured",
-- never zero. An unmeasured track plays at 0 dB of gain, exactly as today.
--
-- The shape columns come from the file's own header, which the upload path
-- already parsed to compute duration and then discarded. The loudness columns
-- are measured in the browser from decoded PCM and are clamped server-side.

ALTER TABLE "ArtistMediaAsset" ADD COLUMN "audioCodec" TEXT;
ALTER TABLE "ArtistMediaAsset" ADD COLUMN "sampleRateHz" INTEGER;
ALTER TABLE "ArtistMediaAsset" ADD COLUMN "channels" INTEGER;
ALTER TABLE "ArtistMediaAsset" ADD COLUMN "bitDepth" INTEGER;
ALTER TABLE "ArtistMediaAsset" ADD COLUMN "loudnessLufs" DOUBLE PRECISION;
ALTER TABLE "ArtistMediaAsset" ADD COLUMN "peakDbfs" DOUBLE PRECISION;
