-- Persistent likes (owner, 2026-08-24): one like per user per
-- album/artist/venue/advertisement, held until unliked. TRACK likes already
-- exist as FanFavoriteMedia and stay there — they carry playable metadata.
--
-- ADDITIVE ONLY: a new enum and a new empty table.

CREATE TYPE "LikeTargetType" AS ENUM ('ALBUM', 'ARTIST', 'VENUE', 'ADVERTISEMENT');

CREATE TABLE IF NOT EXISTS "Like" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "targetType" "LikeTargetType" NOT NULL,
    "targetId"   TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Like_userId_targetType_targetId_key"
    ON "Like"("userId", "targetType", "targetId");

CREATE INDEX IF NOT EXISTS "Like_targetType_targetId_idx"
    ON "Like"("targetType", "targetId");

ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
