-- AlterTable
ALTER TABLE "ArtistMediaAsset" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ShowComment" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShowComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowComment_showId_createdAt_idx" ON "ShowComment"("showId", "createdAt");
CREATE INDEX "ShowComment_userId_createdAt_idx" ON "ShowComment"("userId", "createdAt");

-- CreateTable
CREATE TABLE "ShowRsvp" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowRsvp_showId_userId_key" ON "ShowRsvp"("showId", "userId");

-- CreateTable
CREATE TABLE "ArtistJournalPost" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ArtistJournalPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtistJournalPost_profileId_createdAt_idx" ON "ArtistJournalPost"("profileId", "createdAt");

-- CreateTable
CREATE TABLE "ArtistTip" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistTip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtistTip_stripePaymentIntentId_key" ON "ArtistTip"("stripePaymentIntentId");
CREATE INDEX "ArtistTip_profileId_createdAt_idx" ON "ArtistTip"("profileId", "createdAt");
CREATE INDEX "ArtistTip_fromUserId_createdAt_idx" ON "ArtistTip"("fromUserId", "createdAt");

-- CreateTable
CREATE TABLE "PremiumInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiumInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PremiumInterest_createdAt_idx" ON "PremiumInterest"("createdAt");

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newShows" BOOLEAN NOT NULL DEFAULT true,
    "journalPosts" BOOLEAN NOT NULL DEFAULT true,
    "milestones" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "ShowComment" ADD CONSTRAINT "ShowComment_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShowComment" ADD CONSTRAINT "ShowComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShowRsvp" ADD CONSTRAINT "ShowRsvp_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShowRsvp" ADD CONSTRAINT "ShowRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtistJournalPost" ADD CONSTRAINT "ArtistJournalPost_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtistTip" ADD CONSTRAINT "ArtistTip_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtistTip" ADD CONSTRAINT "ArtistTip_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PremiumInterest" ADD CONSTRAINT "PremiumInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
