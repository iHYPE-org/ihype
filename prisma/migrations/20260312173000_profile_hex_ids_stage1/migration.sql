ALTER TABLE "Profile"
ADD COLUMN "hexId" TEXT;

UPDATE "Profile"
SET "hexId" = lower('0x' || md5("id" || clock_timestamp()::text || random()::text))
WHERE "hexId" IS NULL;

CREATE UNIQUE INDEX "Profile_hexId_key" ON "Profile"("hexId");
