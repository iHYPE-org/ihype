-- Add missing index for promoterProfileId on Show
CREATE INDEX "Show_promoterProfileId_status_idx" ON "Show"("promoterProfileId", "status");
