-- The Artist Performance Agreement (agreement version 2026-09-28.1): Part A's
-- performance terms on each Lineup Offer and on each signed agreement. Additive
-- and nullable; agreements signed before this version keep null.
ALTER TABLE "ShowLineupSlot" ADD COLUMN "performanceTerms" JSONB;
ALTER TABLE "ShowSplitAgreement" ADD COLUMN "performanceTerms" JSONB;
