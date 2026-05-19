-- CreateTable
CREATE TABLE "RadioShowTrack" (
    "id"           TEXT NOT NULL,
    "showId"       TEXT NOT NULL,
    "position"     INTEGER NOT NULL,
    "title"        TEXT NOT NULL,
    "artistName"   TEXT,
    "mediaAssetId" TEXT,
    "externalUrl"  TEXT,
    "durationSecs" INTEGER,
    "blockLabel"   TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioShowTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RadioShowTrack_showId_position_key" ON "RadioShowTrack"("showId", "position");

-- CreateIndex
CREATE INDEX "RadioShowTrack_showId_idx" ON "RadioShowTrack"("showId");

-- AddForeignKey
ALTER TABLE "RadioShowTrack" ADD CONSTRAINT "RadioShowTrack_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadioShowTrack" ADD CONSTRAINT "RadioShowTrack_mediaAssetId_fkey"
    FOREIGN KEY ("mediaAssetId") REFERENCES "ArtistMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
