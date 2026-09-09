-- True peak on uploaded tracks.
--
-- Additive and nullable, like the six columns the previous migration added.
-- A null means the track was never measured with oversampling, and the
-- playback rule reads that as "do not boost this" rather than guessing at
-- headroom — see src/lib/track-gain.ts's resolvePlaybackGain.
--
-- Deliberately a second column rather than a re-use of peakDbfs: a sample
-- peak says whether the file itself clipped, a true peak says what a
-- converter will produce from it, and only the second one bounds a boost.

ALTER TABLE "ArtistMediaAsset" ADD COLUMN "truePeakDbtp" DOUBLE PRECISION;
