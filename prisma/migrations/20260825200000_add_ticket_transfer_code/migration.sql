-- One-time codes that hand a ticket order to another ACCOUNT.
--
-- Purely additive: one new table and its indexes. No column is altered or
-- dropped and no existing row is touched, so this is safe to apply on a live
-- database and needs no gating in prisma/migrations-pending/.
--
-- The email transfer that already existed rewrites Ticket.holderEmail and
-- leaves TicketOrder.buyerUserId alone, while every ticket list in the app is
-- scoped by buyerUserId — so an emailed transfer never put the order in the
-- recipient's account. Claiming one of these codes moves buyerUserId.

CREATE TABLE "TicketTransferCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ticketOrderId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimedById" TEXT,

    CONSTRAINT "TicketTransferCode_pkey" PRIMARY KEY ("id")
);

-- Unique so a claim is a single lookup, and so two live codes can never
-- collide however many are minted.
CREATE UNIQUE INDEX "TicketTransferCode_code_key" ON "TicketTransferCode"("code");

-- Read when a new code is minted, to retire the order's previous live one.
CREATE INDEX "TicketTransferCode_ticketOrderId_claimedAt_idx"
    ON "TicketTransferCode"("ticketOrderId", "claimedAt");

ALTER TABLE "TicketTransferCode"
    ADD CONSTRAINT "TicketTransferCode_ticketOrderId_fkey"
    FOREIGN KEY ("ticketOrderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketTransferCode"
    ADD CONSTRAINT "TicketTransferCode_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL rather than CASCADE: if the claiming account is later deleted the
-- transfer still happened, and deleting the record of it would leave the order
-- looking as though it had never moved.
ALTER TABLE "TicketTransferCode"
    ADD CONSTRAINT "TicketTransferCode_claimedById_fkey"
    FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
