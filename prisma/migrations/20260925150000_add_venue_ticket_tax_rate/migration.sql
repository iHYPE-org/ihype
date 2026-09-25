-- A venue may state its own combined admissions tax rate (parts per million).
-- Additive and nullable: every existing profile keeps null, which means the
-- published state estimate applies exactly as before this migration.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "ticketTaxRatePpm" INTEGER;

ALTER TABLE "Profile" DROP CONSTRAINT IF EXISTS "Profile_ticketTaxRatePpm_range";
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_ticketTaxRatePpm_range"
  CHECK ("ticketTaxRatePpm" IS NULL OR ("ticketTaxRatePpm" >= 0 AND "ticketTaxRatePpm" <= 250000));
