CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationJob_dedupeKey_key" ON "NotificationJob"("dedupeKey");
CREATE INDEX "NotificationJob_status_nextAttemptAt_idx" ON "NotificationJob"("status", "nextAttemptAt");
CREATE INDEX "NotificationJob_lockedAt_idx" ON "NotificationJob"("lockedAt");
