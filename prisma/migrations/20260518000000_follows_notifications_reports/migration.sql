-- AddColumn genre to Profile
ALTER TABLE "Profile" ADD COLUMN "genre" TEXT;

-- AddColumn links to Profile
ALTER TABLE "Profile" ADD COLUMN "links" TEXT;

-- AddColumn isVerified to Profile
ALTER TABLE "Profile" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn verificationRequested to Profile
ALTER TABLE "Profile" ADD COLUMN "verificationRequested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable Follow
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followeeProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Follow_followerId_followeeProfileId_key" ON "Follow"("followerId", "followeeProfileId");
CREATE INDEX "Follow_followeeProfileId_createdAt_idx" ON "Follow"("followeeProfileId", "createdAt");
CREATE INDEX "Follow_followerId_createdAt_idx" ON "Follow"("followerId", "createdAt");

ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followeeProfileId_fkey" FOREIGN KEY ("followeeProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable CommentReaction
CREATE TABLE "CommentReaction" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommentReaction_commentId_userId_emoji_key" ON "CommentReaction"("commentId", "userId", "emoji");
CREATE INDEX "CommentReaction_commentId_idx" ON "CommentReaction"("commentId");

ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ShowComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Report
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_entityType_entityId_idx" ON "Report"("entityType", "entityId");
