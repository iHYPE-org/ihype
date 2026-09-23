-- Two changes, both additive and both safe to re-run.
--
-- (1) Seventeen foreign keys had no covering index (Supabase performance
-- advisor, 2026-09-23). The ones on the money path matter most: orders by
-- show, tickets by order, shows by venue and by headliner. None of these
-- names existed in production when this was written (checked against
-- pg_indexes the same day). IF NOT EXISTS keeps a re-run from leaving a
-- failed row in _prisma_migrations, which would block every later deploy.
--
-- (2) Show."timeZone" was added after the eight preview shows were created,
-- so they render on the runtime's clock. Every one is at a venue in Portland,
-- Maine, and all of Maine is on Eastern time, so the zone is a fact about
-- the venue rather than a guess. Only rows that are still null and whose
-- venue is in Maine are touched; any other show keeps its null.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketTransferCode_createdById_idx" ON "TicketTransferCode"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketTransferCode_claimedById_idx" ON "TicketTransferCode"("claimedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ArtistMediaAsset_albumId_idx" ON "ArtistMediaAsset"("albumId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Show_venueProfileId_idx" ON "Show"("venueProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Show_headlinerProfileId_idx" ON "Show"("headlinerProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Show_promoterProfileId_idx" ON "Show"("promoterProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketOrder_showId_idx" ON "TicketOrder"("showId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketOrder_affiliatePromoterProfileId_idx" ON "TicketOrder"("affiliatePromoterProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Ticket_ticketOrderId_idx" ON "Ticket"("ticketOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Ticket_scannedByUserId_idx" ON "Ticket"("scannedByUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Ticket_reassignedByUserId_idx" ON "Ticket"("reassignedByUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShowListen_showId_idx" ON "ShowListen"("showId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SetlistVote_userId_idx" ON "SetlistVote"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProfileHypeEvent_profileId_idx" ON "ProfileHypeEvent"("profileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShowRsvp_userId_idx" ON "ShowRsvp"("userId");


-- Backfill
UPDATE "Show" AS s
SET "timeZone" = 'America/New_York'
FROM "Profile" AS v
WHERE v."id" = s."venueProfileId"
  AND s."timeZone" IS NULL
  AND v."country" = 'US'
  AND v."stateRegion" = 'ME';
