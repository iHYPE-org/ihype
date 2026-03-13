-- CreateTable
CREATE TABLE "ArtistMediaAsset" (
    "id" TEXT NOT NULL,
    "hexId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtistMediaAsset_hexId_key" ON "ArtistMediaAsset"("hexId");

-- CreateIndex
CREATE INDEX "ArtistMediaAsset_profileId_createdAt_idx" ON "ArtistMediaAsset"("profileId", "createdAt");

-- AddForeignKey
ALTER TABLE "ArtistMediaAsset" ADD CONSTRAINT "ArtistMediaAsset_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
