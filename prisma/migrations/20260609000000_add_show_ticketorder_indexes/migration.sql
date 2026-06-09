-- Add index on Show.creatorId for artist/venue dashboard queries
CREATE INDEX IF NOT EXISTS "Show_creatorId_idx" ON "Show"("creatorId");

-- Add index on TicketOrder.buyerUserId for buyer order history queries
CREATE INDEX IF NOT EXISTS "TicketOrder_buyerUserId_idx" ON "TicketOrder"("buyerUserId");
