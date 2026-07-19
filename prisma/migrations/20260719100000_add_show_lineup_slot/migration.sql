-- Lineup & Split Agreement (DESIGN_SYNC row 226) — venue-proposed, per-act
-- payout split for shows with more than one billed act. A show with no rows
-- here is unaffected (100% of its artistPayoutPercent still goes to
-- Show.headlinerProfileId, exactly as before).

-- CreateEnum
CREATE TYPE "LineupSlotStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "ShowLineupSlot" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "isHeadliner" BOOLEAN NOT NULL DEFAULT false,
    "splitPercent" INTEGER NOT NULL,
    "status" "LineupSlotStatus" NOT NULL DEFAULT 'PENDING',
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ShowLineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowLineupSlot_showId_profileId_key" ON "ShowLineupSlot"("showId", "profileId");

-- CreateIndex
CREATE INDEX "ShowLineupSlot_profileId_status_idx" ON "ShowLineupSlot"("profileId", "status");

-- AddForeignKey
ALTER TABLE "ShowLineupSlot" ADD CONSTRAINT "ShowLineupSlot_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowLineupSlot" ADD CONSTRAINT "ShowLineupSlot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
