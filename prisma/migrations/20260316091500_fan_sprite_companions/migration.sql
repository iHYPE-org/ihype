ALTER TABLE "User"
ADD COLUMN "isThirteenOrOlder" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Profile"
ADD COLUMN "companionSpriteSheet" TEXT;
