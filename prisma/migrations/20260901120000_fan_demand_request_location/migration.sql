-- AlterTable
ALTER TABLE "VenueConnectionRequest" ADD COLUMN     "requesterCity" TEXT,
ADD COLUMN     "requesterLatitude" DOUBLE PRECISION,
ADD COLUMN     "requesterLongitude" DOUBLE PRECISION,
ADD COLUMN     "requesterStateRegion" TEXT;

-- CreateIndex
CREATE INDEX "VenueConnectionRequest_venueProfileId_status_createdAt_idx" ON "VenueConnectionRequest"("venueProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "VenueConnectionRequest_artistProfileId_status_idx" ON "VenueConnectionRequest"("artistProfileId", "status");

