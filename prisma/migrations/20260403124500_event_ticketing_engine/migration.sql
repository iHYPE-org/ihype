-- CreateEnum
CREATE TYPE "TicketOrderStatus" AS ENUM ('RESERVED', 'CAPTURED', 'VOID');

-- CreateEnum
CREATE TYPE "AccountsPayableCategory" AS ENUM (
    'TAX_LOCAL',
    'TAX_STATE',
    'TAX_COUNTRY',
    'TAX_INTERNATIONAL',
    'VENUE_PAYOUT',
    'ARTIST_PAYOUT',
    'PROMOTER_AFFILIATE'
);

-- CreateEnum
CREATE TYPE "AccountsPayableStatus" AS ENUM ('PENDING', 'RELEASED', 'VOID');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "storedPaymentTokenRef" TEXT,
ADD COLUMN "storedPaymentTokenBrand" TEXT,
ADD COLUMN "storedPaymentTokenLast4" TEXT;

-- AlterTable
ALTER TABLE "Show"
ADD COLUMN "ticketingOpensAt" TIMESTAMP(3),
ADD COLUMN "bookingLegalNotes" TEXT;

-- AlterTable
ALTER TABLE "TicketOrder"
ADD COLUMN "buyerUserId" TEXT,
ADD COLUMN "status" "TicketOrderStatus" NOT NULL DEFAULT 'RESERVED',
ADD COLUMN "paymentTokenRef" TEXT,
ADD COLUMN "affiliatePromoterProfileId" TEXT,
ADD COLUMN "taxLocalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "taxStateCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "taxCountryCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "taxInternationalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalTaxCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalChargeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locationCity" TEXT,
ADD COLUMN "locationStateRegion" TEXT,
ADD COLUMN "locationCountry" TEXT,
ADD COLUMN "locationPostalCode" TEXT,
ADD COLUMN "chargedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ticket"
ADD COLUMN "reassignedAt" TIMESTAMP(3),
ADD COLUMN "reassignedByUserId" TEXT;

-- CreateTable
CREATE TABLE "AccountsPayableEntry" (
    "id" TEXT NOT NULL,
    "ticketOrderId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "profileId" TEXT,
    "category" "AccountsPayableCategory" NOT NULL,
    "status" "AccountsPayableStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "payeeLabel" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPayableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountsPayableEntry_ticketOrderId_category_idx" ON "AccountsPayableEntry"("ticketOrderId", "category");

-- CreateIndex
CREATE INDEX "AccountsPayableEntry_showId_category_idx" ON "AccountsPayableEntry"("showId", "category");

-- CreateIndex
CREATE INDEX "AccountsPayableEntry_profileId_category_idx" ON "AccountsPayableEntry"("profileId", "category");

-- AddForeignKey
ALTER TABLE "TicketOrder"
ADD CONSTRAINT "TicketOrder_buyerUserId_fkey"
FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrder"
ADD CONSTRAINT "TicketOrder_affiliatePromoterProfileId_fkey"
FOREIGN KEY ("affiliatePromoterProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_reassignedByUserId_fkey"
FOREIGN KEY ("reassignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayableEntry"
ADD CONSTRAINT "AccountsPayableEntry_ticketOrderId_fkey"
FOREIGN KEY ("ticketOrderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayableEntry"
ADD CONSTRAINT "AccountsPayableEntry_showId_fkey"
FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayableEntry"
ADD CONSTRAINT "AccountsPayableEntry_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
