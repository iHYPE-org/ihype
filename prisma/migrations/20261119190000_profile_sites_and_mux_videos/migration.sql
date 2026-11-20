-- A per-profile page configuration. Null means not published, with no change
-- to existing profile visibility or editing flows.
ALTER TABLE "Profile" ADD COLUMN "siteConfig" JSONB;

CREATE TABLE "ProfileVideo" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "muxUploadId" TEXT NOT NULL,
  "muxAssetId" TEXT,
  "muxPlaybackId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'WAITING',
  "quality" TEXT NOT NULL DEFAULT '1080p',
  "durationSecs" DOUBLE PRECISION,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileVideo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfileVideo_muxUploadId_key" ON "ProfileVideo"("muxUploadId");
CREATE UNIQUE INDEX "ProfileVideo_muxAssetId_key" ON "ProfileVideo"("muxAssetId");
CREATE INDEX "ProfileVideo_profileId_createdAt_idx" ON "ProfileVideo"("profileId", "createdAt");
CREATE INDEX "ProfileVideo_profileId_isPublished_status_idx" ON "ProfileVideo"("profileId", "isPublished", "status");
ALTER TABLE "ProfileVideo" ADD CONSTRAINT "ProfileVideo_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- iHYPE's Prisma server connection owns access; anonymous Supabase Data API
-- clients must never read the unpublished originals or upload identifiers.
ALTER TABLE "ProfileVideo" ENABLE ROW LEVEL SECURITY;
