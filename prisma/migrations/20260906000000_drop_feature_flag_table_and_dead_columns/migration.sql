-- Drops three tables and four columns that nothing in the application reads.
-- Found by the 2026-09-06 dead-code audit (DESIGN_SYNC row 353); the code half
-- shipped in #835, which took every reference out of schema.prisma, so the
-- Prisma client already ignores all of this and only the storage remains.
--
-- THE GATE WAS CLEARED BEFORE THIS FILE MOVED. It sat in
-- prisma/migrations-pending/ carrying the gate marker until the counts below
-- were read from PRODUCTION on 2026-09-06 (Supabase project bjkabtzvgfshsrmjhrkx),
-- in one query, every one of them zero. (The marker itself cannot be named in
-- this header: check-gated-migrations.mjs matches the header text, so quoting
-- the word would re-gate the file it is recording the clearance of.)
--
--   feature_flags            0   nothing ever wrote FeatureFlag; runtime flags
--                                live in Cloudflare KV under `flags:<key>`, and
--                                the only surviving mention of the name is an
--                                audit-log label
--   collab_posts             0   the musician classifieds board had no link
--                                anywhere in the app (owner: "no collab board"),
--                                so there was no member text to export first
--   promo_codes              0   nothing could create or apply a code; the admin
--                                finance page only listed rows (owner: "no promo
--                                codes")
--   orders_with_promo        0   no TicketOrder carries a promoCodeId, so the
--                                column drop below cannot orphan a paid order
--   shows_odd_plan_version   0   productionPlanVersion defaulted to 1 and was
--                                never read or incremented
--   profiles_with_page_dates 0   pageDraftUpdatedAt/pagePublishedAt belong to
--                                the retired AI page builder
--
-- The counts are recorded rather than the verdict alone, because the next
-- person to read this file cannot re-run a check against the database as it was
-- tonight. Their siblings `pageDraft` and `pagePublished` STAY: the erasure path
-- still nulls them.
--
-- Recoverable if any of that reasoning is wrong: the production deploy takes an
-- encrypted pg_dump to R2 immediately before running `prisma migrate deploy`.

DROP TABLE IF EXISTS "FeatureFlag";
DROP TABLE IF EXISTS "CollabBoardPost";

ALTER TABLE "TicketOrder" DROP COLUMN IF EXISTS "promoCodeId";
DROP TABLE IF EXISTS "PromoCode";

ALTER TABLE "Show" DROP COLUMN IF EXISTS "productionPlanVersion";

ALTER TABLE "Profile" DROP COLUMN IF EXISTS "pageDraftUpdatedAt";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "pagePublishedAt";
