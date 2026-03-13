-- CreateTable
CREATE TABLE "MediaListen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistProfileSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaListen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaListen_userId_mediaId_key" ON "MediaListen"("userId", "mediaId");

-- AddForeignKey
ALTER TABLE "MediaListen" ADD CONSTRAINT "MediaListen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
