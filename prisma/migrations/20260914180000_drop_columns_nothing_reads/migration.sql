--
-- Drops eight columns that no product code reads or writes.
--
-- Each was found by asking, for every scalar column in schema.prisma, whether
-- its name appears anywhere in src/ or workers/ OUTSIDE the erasure path, the
-- privacy export and the tests (DESIGN_SYNC row 445; `column-readers.test.ts`
-- now asks it on every push):
--
--   "User"."pageLayout"             the retired workbench dashboard's tile
--                                   order (20260516); erasure reset it to []
--   "Profile"."recommendContent"    a profile section from 20260311 that no
--                                   editor or page has drawn since the fixed
--                                   per-type section sets (row 326)
--   "Profile"."pageDraft"           the AI page builder's draft and publish
--   "Profile"."pagePublished"       bodies (20260611); the builder and both of
--                                   its routes went 2026-09-01. The 2026-09-06
--                                   drop KEPT these two because "the erasure
--                                   path still nulls them" — a null write is
--                                   not a use, which is the point of this file
--   "Profile"."companionSpriteSheet" the fan sprite companion (20260316); no
--                                   surface has read it since the shell cutover
--   "Show"."setlistProgress"        added 20260520, written by nothing; named
--                                   only in GET /api/shows' list of columns to
--                                   keep OUT of the public payload
--   "TicketOrder"."paymentTokenRef" written `null` on every order for a
--                                   stored-token charge model that was never
--                                   built (row 22b: nothing charges later)
--   "SocialPost"."postedAt"         the weekly digest creates a caption; no
--                                   posting step has ever set when it went out
--
-- The CODE half is deployed: all eight are out of schema.prisma, and the four
-- lines that nulled or redacted them are gone. This file is only the drop.
--
-- Before applying, run against production and RECORD THE NUMBERS HERE, not a
-- verdict (a verdict cannot be re-checked a week later; the counts can):
--
--   SELECT
--     (SELECT count(*) FROM "User"        WHERE "pageLayout" <> '{}')                 AS users_with_layout,
--     (SELECT count(*) FROM "Profile"     WHERE "recommendContent" IS NOT NULL)      AS with_recommend,
--     (SELECT count(*) FROM "Profile"     WHERE "pageDraft" IS NOT NULL)             AS with_page_draft,
--     (SELECT count(*) FROM "Profile"     WHERE "pagePublished" IS NOT NULL)         AS with_page_published,
--     (SELECT count(*) FROM "Profile"     WHERE "companionSpriteSheet" IS NOT NULL)  AS with_companion,
--     (SELECT count(*) FROM "Show"        WHERE "setlistProgress" IS NOT NULL)       AS with_setlist_progress,
--     (SELECT count(*) FROM "TicketOrder" WHERE "paymentTokenRef" IS NOT NULL)       AS with_payment_token,
--     (SELECT count(*) FROM "SocialPost"  WHERE "postedAt" IS NOT NULL)              AS with_posted_at;
--
-- A non-zero `with_page_draft` or `with_page_published` is a page body written
-- through the builder before 2026-09-01 that no surface has rendered since;
-- the live profile is the fixed per-type sections in `Profile.*Content`, so
-- there is nothing to carry it onto. Any other non-zero is a value written
-- before its feature left. Record the counts, then `git mv` this directory
-- into prisma/migrations/ in its own commit.
--
-- Rehearsed against a scratch Postgres in a rolled-back transaction: all
-- eight columns present, the drop applied, a second pass a no-op (IF EXISTS).

--
-- RUN 2026-09-15 against production (bjkabtzvgfshsrmjhrkx), read through the
-- Supabase connector, which is pinned read-only. All EIGHT counts the query
-- above asks for, none omitted:
--
--   User.pageLayout 0 | Profile.recommendContent 0 | Profile.pageDraft 0
--   Profile.pagePublished 0 | Profile.companionSpriteSheet 0
--   Show.setlistProgress 0 | TicketOrder.paymentTokenRef 0
--   SocialPost.postedAt 0
--
-- The eight are listed in full deliberately. The first pass at this check ran
-- a hand-rewritten query that dropped `with_posted_at`, and a seven-of-eight
-- answer reads exactly like an eight-of-eight one. Run the query the header
-- states; do not paraphrase it.

ALTER TABLE "User"        DROP COLUMN IF EXISTS "pageLayout";
ALTER TABLE "Profile"     DROP COLUMN IF EXISTS "recommendContent";
ALTER TABLE "Profile"     DROP COLUMN IF EXISTS "pageDraft";
ALTER TABLE "Profile"     DROP COLUMN IF EXISTS "pagePublished";
ALTER TABLE "Profile"     DROP COLUMN IF EXISTS "companionSpriteSheet";
ALTER TABLE "Show"        DROP COLUMN IF EXISTS "setlistProgress";
ALTER TABLE "TicketOrder" DROP COLUMN IF EXISTS "paymentTokenRef";
ALTER TABLE "SocialPost"  DROP COLUMN IF EXISTS "postedAt";
