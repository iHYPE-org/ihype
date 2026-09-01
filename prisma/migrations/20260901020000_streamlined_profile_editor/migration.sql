-- Backing for the streamlined profile editor (2026-09-01, owner instruction:
-- "artist page too busy. we need to tone down the customization").
--
-- Entirely ADDITIVE — one enum, one table, three nullable/defaulted columns.
-- Nothing is dropped and nothing is rewritten, so it is NOT gated: the
-- migrations-pending workflow exists for changes that can lose data, and
-- parking a safe additive migration there only delays the feature that needs
-- it. See prisma/migrations-pending/README.md.
--
-- AvailabilityDate.kind defaults to AVAILABLE so every row written before this
-- column existed keeps the only meaning it could have had.

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('AVAILABLE', 'TOUR');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "members" TEXT;

-- AlterTable
ALTER TABLE "ArtistMediaAsset" ADD COLUMN     "albumId" TEXT;

-- AlterTable
ALTER TABLE "AvailabilityDate" ADD COLUMN     "kind" "AvailabilityKind" NOT NULL DEFAULT 'AVAILABLE';

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artworkUrl" TEXT,
    "releasedOn" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Album_profileId_sortOrder_idx" ON "Album"("profileId", "sortOrder");

-- CreateIndex
CREATE INDEX "AvailabilityDate_profileId_kind_date_idx" ON "AvailabilityDate"("profileId", "kind", "date");

-- AddForeignKey
ALTER TABLE "ArtistMediaAsset" ADD CONSTRAINT "ArtistMediaAsset_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

