-- Add coverage-tier pricing to the self-serve Ad/AdSlot campaign pipeline
-- (the "newest" ad system per the Advertise.dc.html design) and seed the
-- four tier placements the campaign builder sells against.
ALTER TABLE "Ad" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'REGIONAL';

INSERT INTO "AdSlot" (id, name, description, active, "createdAt")
VALUES
  (gen_random_uuid()::text, 'Local', 'City-level ad placement — coverage tier: LOCAL', true, now()),
  (gen_random_uuid()::text, 'Regional', 'State/metro-level ad placement — coverage tier: REGIONAL', true, now()),
  (gen_random_uuid()::text, 'National', 'US-wide ad placement — coverage tier: NATIONAL', true, now()),
  (gen_random_uuid()::text, 'Global', 'Worldwide ad placement — coverage tier: GLOBAL', true, now())
ON CONFLICT DO NOTHING;
