-- Adds the "category" + "pitch" fields the real advertiser signup flow was
-- missing (row 244 of DESIGN_SYNC.md) — both nullable so every existing
-- AdvertiserAccount row (created before this field existed) stays valid.

-- CreateEnum
CREATE TYPE "AdvertiserCategory" AS ENUM ('LABEL', 'VENUE_PROMOTER', 'GEAR', 'TICKETING', 'MERCH', 'TOUR');

-- AlterTable
ALTER TABLE "AdvertiserAccount" ADD COLUMN "category" "AdvertiserCategory",
ADD COLUMN "pitch" TEXT;
