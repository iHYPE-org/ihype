-- @gated
-- Before applying:
--   1. Confirm `SELECT count(*) FROM "FeatureFlag"` is 0 (or that nothing in it
--      matters). Nothing in the application has ever read or written this table:
--      runtime flags live in Cloudflare KV under `flags:<key>`, and the only
--      reference to the name is an audit-log label. Found by the 2026-09-06
--      dead-code audit (DESIGN_SYNC row 353).
--   2. Confirm `SELECT count(*) FROM "Show" WHERE "productionPlanVersion" <> 1`
--      is 0. The column defaulted to 1 and was never read or incremented.
--   3. `Profile.pageDraftUpdatedAt` and `Profile.pagePublishedAt` belong to the
--      retired AI page builder; nothing reads them. Their siblings `pageDraft`
--      and `pagePublished` stay, because the erasure path still nulls them.
--   4. `CollabBoardPost` (owner, 2026-09-06: "no collab board") — the musician
--      classifieds page had no link anywhere in the app; its page, form, button
--      and route are deleted. Check `SELECT count(*) FROM "CollabBoardPost"`
--      and export anything a member wrote before dropping it.
--   5. `PromoCode` and `TicketOrder.promoCodeId` (owner, same day: "no promo
--      codes") — nothing could create or apply a code; the admin finance page
--      only listed rows. Check `SELECT count(*) FROM "PromoCode"` is 0 and
--      `SELECT count(*) FROM "TicketOrder" WHERE "promoCodeId" IS NOT NULL` is 0.
--   6. The Prisma schema no longer declares any of these, so the client already
--      ignores them; this migration only reclaims the storage.

DROP TABLE IF EXISTS "FeatureFlag";
DROP TABLE IF EXISTS "CollabBoardPost";

ALTER TABLE "TicketOrder" DROP COLUMN IF EXISTS "promoCodeId";
DROP TABLE IF EXISTS "PromoCode";

ALTER TABLE "Show" DROP COLUMN IF EXISTS "productionPlanVersion";

ALTER TABLE "Profile" DROP COLUMN IF EXISTS "pageDraftUpdatedAt";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "pagePublishedAt";
