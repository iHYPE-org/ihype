-- 18+ attestation: required to buy tickets or share referral links.
-- Existing accounts default to false and attest from Settings; the 13+
-- attestation at signup is unchanged.
ALTER TABLE "User" ADD COLUMN "isEighteenOrOlder" BOOLEAN NOT NULL DEFAULT false;

-- Artist/DJ press kit content (JSON: tagline, quotes, achievements,
-- contactEmail) rendered on /artists/[slug]/epk and /artists/[slug]/presskit.
ALTER TABLE "Profile" ADD COLUMN "pressKitContent" TEXT;
