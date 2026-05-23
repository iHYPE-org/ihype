-- Add performance indexes for userId lookups and show scheduling queries

-- MediaListen: index on userId for faster user-scoped queries
CREATE INDEX "MediaListen_userId_idx" ON "MediaListen"("userId");

-- ShowListen: index on userId for faster user-scoped queries
CREATE INDEX "ShowListen_userId_idx" ON "ShowListen"("userId");

-- HypeEvent: index on userId for faster user-scoped queries
CREATE INDEX "HypeEvent_userId_idx" ON "HypeEvent"("userId");

-- Show: composite index on startsAt + status for scheduling/listing queries
CREATE INDEX "Show_startsAt_status_idx" ON "Show"("startsAt", "status");
