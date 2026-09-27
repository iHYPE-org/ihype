-- Split Agreement version 2026-09-27.2, Section 7.4: the act whose
-- cancellation or no-show cancelled a show reimburses the venue for the fees
-- Stripe kept on the refunds. Additive and nullable; existing cancelled shows
-- read as venue-cancelled (7.3), which is what they were recorded as.
ALTER TABLE "Show" ADD COLUMN "cancelledByActProfileId" TEXT;
