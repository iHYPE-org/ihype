-- Show Revenue Split Agreement (DESIGN_SYNC row 528): signed per-act offers,
-- the signed agreement record, the settlement statement and the act's payment.
-- Additive only: new nullable columns and three new tables.

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "paymentReportHoldAt" TIMESTAMP(3),
ADD COLUMN     "payoutMethodDetails" TEXT,
ADD COLUMN     "payoutMethodKind" TEXT,
ADD COLUMN     "payoutMethodUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ShowLineupSlot" ADD COLUMN     "agreementHash" TEXT,
ADD COLUMN     "agreementVersion" TEXT,
ADD COLUMN     "approvedDeductions" JSONB,
ADD COLUMN     "guaranteeCents" INTEGER,
ADD COLUMN     "guarantorName" TEXT,
ADD COLUMN     "juryWaiver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "venueSignedAt" TIMESTAMP(3),
ADD COLUMN     "venueSignerDevice" TEXT,
ADD COLUMN     "venueSignerIp" TEXT,
ADD COLUMN     "venueSignerName" TEXT,
ADD COLUMN     "venueSignerUserId" TEXT;

-- CreateTable
CREATE TABLE "ShowSplitAgreement" (
    "id" TEXT NOT NULL,
    "lineupSlotId" TEXT,
    "showId" TEXT NOT NULL,
    "venueProfileId" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "splitPercent" INTEGER NOT NULL,
    "guaranteeCents" INTEGER,
    "approvedDeductions" JSONB,
    "guarantorName" TEXT,
    "juryWaiver" BOOLEAN NOT NULL DEFAULT false,
    "venueSignerUserId" TEXT NOT NULL,
    "venueSignerName" TEXT NOT NULL,
    "venueSignedAt" TIMESTAMP(3) NOT NULL,
    "venueSignerIp" TEXT,
    "venueSignerDevice" TEXT,
    "artistSignerUserId" TEXT NOT NULL,
    "artistSignerName" TEXT NOT NULL,
    "artistSignedAt" TIMESTAMP(3) NOT NULL,
    "artistSignerIp" TEXT,
    "artistSignerDevice" TEXT,
    "artistPaymentMethod" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowSplitAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowSettlementStatement" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "offPlatformCents" INTEGER NOT NULL DEFAULT 0,
    "offPlatformNote" TEXT,
    "chargebacksLostCents" INTEGER NOT NULL DEFAULT 0,
    "chargebacksNote" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowSettlementStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistSharePayment" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "deductionsAppliedCents" INTEGER NOT NULL DEFAULT 0,
    "deductionsNote" TEXT,
    "paidMarkedAt" TIMESTAMP(3),
    "paidAmountCents" INTEGER,
    "paidOn" TIMESTAMP(3),
    "paidMethod" TEXT,
    "paidReference" TEXT,
    "artistConfirmedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "reportNote" TEXT,
    "reportResolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistSharePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowSplitAgreement_lineupSlotId_key" ON "ShowSplitAgreement"("lineupSlotId");

-- CreateIndex
CREATE INDEX "ShowSplitAgreement_showId_idx" ON "ShowSplitAgreement"("showId");

-- CreateIndex
CREATE INDEX "ShowSplitAgreement_venueProfileId_idx" ON "ShowSplitAgreement"("venueProfileId");

-- CreateIndex
CREATE INDEX "ShowSplitAgreement_artistProfileId_idx" ON "ShowSplitAgreement"("artistProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowSettlementStatement_showId_key" ON "ShowSettlementStatement"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistSharePayment_agreementId_key" ON "ArtistSharePayment"("agreementId");

-- AddForeignKey
ALTER TABLE "ShowSplitAgreement" ADD CONSTRAINT "ShowSplitAgreement_lineupSlotId_fkey" FOREIGN KEY ("lineupSlotId") REFERENCES "ShowLineupSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSplitAgreement" ADD CONSTRAINT "ShowSplitAgreement_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSplitAgreement" ADD CONSTRAINT "ShowSplitAgreement_venueProfileId_fkey" FOREIGN KEY ("venueProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSplitAgreement" ADD CONSTRAINT "ShowSplitAgreement_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSettlementStatement" ADD CONSTRAINT "ShowSettlementStatement_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistSharePayment" ADD CONSTRAINT "ArtistSharePayment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "ShowSplitAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

