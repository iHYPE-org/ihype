-- Adds the optional "message to ticket holders" the Event Cancellation Flow
-- design calls for (row 246 of DESIGN_SYNC.md). Nullable, so every existing
-- Show row -- including shows cancelled before this field existed -- stays
-- valid, and a cancellation submitted without a message stores NULL rather
-- than an empty string.
--
-- Additive only. Nothing reads this column until the code that writes it
-- ships in the same commit, so the deploy order is safe either way.

-- AlterTable
ALTER TABLE "Show" ADD COLUMN "cancellationMessage" TEXT;
