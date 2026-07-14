-- Set while an Ad campaign's status is PAUSED — on resume, endsAt shifts
-- forward by (now - pausedAt) so a pause never eats into the run length
-- the advertiser actually paid for.
ALTER TABLE "Ad" ADD COLUMN "pausedAt" TIMESTAMP(3);
