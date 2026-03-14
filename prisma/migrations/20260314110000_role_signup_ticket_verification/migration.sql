-- CreateEnum
CREATE TYPE "OwnershipVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'SCANNED', 'VOID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill usernames safely for any existing users before enforcing NOT NULL + UNIQUE.
UPDATE "User"
SET "username" = CONCAT(
    COALESCE(
        NULLIF(
            lower(regexp_replace(split_part("email", '@', 1), '[^a-z0-9]+', '-', 'g')),
            ''
        ),
        'user'
    ),
    '-',
    substring("id" FROM 1 FOR 6)
)
WHERE "username" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- AlterTable
ALTER TABLE "Profile"
    ADD COLUMN "contactInfo" TEXT,
    ADD COLUMN "hometown" TEXT,
    ADD COLUMN "verificationStatus" "OwnershipVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3),
    ADD COLUMN "verificationReviewedAt" TIMESTAMP(3),
    ADD COLUMN "verificationNotes" TEXT;

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "serializedId" TEXT NOT NULL,
    "ticketOrderId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "venueProfileId" TEXT,
    "holderName" TEXT NOT NULL,
    "holderEmail" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "scannedAt" TIMESTAMP(3),
    "scannedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_serializedId_key" ON "Ticket"("serializedId");

-- CreateIndex
CREATE INDEX "Ticket_showId_status_idx" ON "Ticket"("showId", "status");

-- CreateIndex
CREATE INDEX "Ticket_venueProfileId_status_idx" ON "Ticket"("venueProfileId", "status");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketOrderId_fkey" FOREIGN KEY ("ticketOrderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_venueProfileId_fkey" FOREIGN KEY ("venueProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_scannedByUserId_fkey" FOREIGN KEY ("scannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
