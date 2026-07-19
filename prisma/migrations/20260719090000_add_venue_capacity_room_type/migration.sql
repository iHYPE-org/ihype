-- Venue Onboarding's "Room details" step (DESIGN_SYNC row 225) asks for the
-- venue's own capacity/room type — a venue-level fact distinct from
-- Show.ticketCapacity (which caps one specific event's ticket sales).
-- Additive, nullable — no existing row needs a value.

ALTER TABLE "Profile" ADD COLUMN "capacity" INTEGER;
ALTER TABLE "Profile" ADD COLUMN "roomType" TEXT;
