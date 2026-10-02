-- Three additive columns (2026-10-02, DESIGN_SYNC row 534):
--   User.locale        the language the member chose, null until they choose
--   FanPlaylist.isPublic  whether anyone holding the id may open it; TRUE keeps
--                      every existing playlist as shareable as it was
--   Ad.city            the place a LOCAL or REGIONAL sponsorship is bought for
-- Nothing is dropped and no existing row changes meaning.
ALTER TABLE "User" ADD COLUMN "locale" TEXT;
ALTER TABLE "FanPlaylist" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Ad" ADD COLUMN "city" TEXT;
