-- CreateTable
CREATE TABLE "FanPlaylist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanPlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanPlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "artistProfileSlug" TEXT,
    "notes" TEXT,
    "artworkUrl" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanPlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanFavoriteMedia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "artistProfileSlug" TEXT,
    "notes" TEXT,
    "artworkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanFavoriteMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FanPlaylist_userId_createdAt_idx" ON "FanPlaylist"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FanPlaylistItem_playlistId_position_idx" ON "FanPlaylistItem"("playlistId", "position");

-- CreateIndex
CREATE INDEX "FanPlaylistItem_playlistId_mediaId_idx" ON "FanPlaylistItem"("playlistId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "FanFavoriteMedia_userId_mediaId_key" ON "FanFavoriteMedia"("userId", "mediaId");

-- CreateIndex
CREATE INDEX "FanFavoriteMedia_userId_createdAt_idx" ON "FanFavoriteMedia"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "FanPlaylist"
ADD CONSTRAINT "FanPlaylist_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanPlaylistItem"
ADD CONSTRAINT "FanPlaylistItem_playlistId_fkey"
FOREIGN KEY ("playlistId") REFERENCES "FanPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanFavoriteMedia"
ADD CONSTRAINT "FanFavoriteMedia_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
