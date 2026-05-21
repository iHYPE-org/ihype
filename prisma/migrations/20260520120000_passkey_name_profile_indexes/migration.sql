ALTER TABLE "Passkey" ADD COLUMN IF NOT EXISTS "name" TEXT;
CREATE INDEX IF NOT EXISTS "Profile_name_idx" ON "Profile"("name");
CREATE INDEX IF NOT EXISTS "Profile_city_type_idx" ON "Profile"("city", "type");
