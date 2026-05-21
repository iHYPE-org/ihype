-- Add note field to ContentReport
ALTER TABLE "ContentReport" ADD COLUMN "note" TEXT;

-- Add missing indexes to Show
CREATE INDEX "Show_creatorId_idx" ON "Show"("creatorId");
CREATE INDEX "Show_status_startsAt_idx" ON "Show"("status", "startsAt");
CREATE INDEX "Show_venueProfileId_status_idx" ON "Show"("venueProfileId", "status");
CREATE INDEX "Show_headlinerProfileId_status_idx" ON "Show"("headlinerProfileId", "status");

-- Add missing indexes to TicketOrder
CREATE INDEX "TicketOrder_showId_createdAt_idx" ON "TicketOrder"("showId", "createdAt");
CREATE INDEX "TicketOrder_buyerUserId_createdAt_idx" ON "TicketOrder"("buyerUserId", "createdAt");

-- Add missing index to HypeEvent
CREATE INDEX "HypeEvent_showId_idx" ON "HypeEvent"("showId");
