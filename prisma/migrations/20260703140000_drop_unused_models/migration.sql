-- Drop tables with zero rows and zero application-code usage, confirmed via
-- repo-wide grep (src/, mobile/, e2e/) before this migration was written.
-- CollabResponse and CollabPost are dropped in FK-dependency order.
DROP TABLE "CollabResponse";
DROP TABLE "CollabPost";
DROP TABLE "ArtistTip";
DROP TABLE "ProfileBlock";
DROP TABLE "RateLimitBucket";
DROP TABLE "Report";
