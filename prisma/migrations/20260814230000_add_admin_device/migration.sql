-- Admin console device binding, as a table instead of a column.
--
-- `User.adminDeviceTokenHash` is a single column, so it holds exactly one
-- device: registering a phone overwrote the laptop's hash and silently signed
-- the laptop out of the console. Nobody chose that policy — the column just
-- never had room for a second row.
--
-- ADDITIVE ONLY. The legacy column is left in place and is still read as a
-- fallback, so whichever device the operator is holding when this deploys
-- keeps working. Dropping it is separate, gated work.

CREATE TABLE IF NOT EXISTS "AdminDevice" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "tokenHash"  TEXT NOT NULL,
    "label"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminDevice_tokenHash_key" ON "AdminDevice"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminDevice_userId_idx" ON "AdminDevice"("userId");

ALTER TABLE "AdminDevice"
    DROP CONSTRAINT IF EXISTS "AdminDevice_userId_fkey";
ALTER TABLE "AdminDevice"
    ADD CONSTRAINT "AdminDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry the currently-registered device across, so this deploy does not sign
-- the operator out of the console they are reading it from. `gen_random_uuid()`
-- is available without an extension on Postgres 13+; production is 17.
INSERT INTO "AdminDevice" ("id", "userId", "tokenHash", "label", "createdAt", "lastSeenAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "adminDeviceTokenHash",
    'Migrated device',
    COALESCE("adminDeviceSetAt", CURRENT_TIMESTAMP),
    COALESCE("adminDeviceSetAt", CURRENT_TIMESTAMP)
FROM "User"
WHERE "adminDeviceTokenHash" IS NOT NULL
ON CONFLICT ("tokenHash") DO NOTHING;
