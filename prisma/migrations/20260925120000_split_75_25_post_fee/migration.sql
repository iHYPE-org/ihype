-- THE SPLIT IS 75% ARTIST / 25% VENUE OF THE NET FACE VALUE, AND THERE IS NO
-- PROMOTER SHARE (owner, 2026-09-25; DESIGN_SYNC row 520).
--
-- Every ticketed show carries the percentages it was created with, and every
-- show created before this date carries 70 / 20 / 10. The purchase route and
-- the ticket card now compute a sale from the charter constants, not the row,
-- so these columns are read only for display and for the lineup split's total.
-- Leaving them at 70/20/10 would draw the retired split on every existing
-- show page, so the rows move to the new terms here.
--
-- Captured orders are NOT touched: an order records the split it was sold
-- under, and its payables were written from those amounts.
--
-- Lineup slots are rescaled FIRST, while the show still carries its old
-- artist percentage. `splitArtistPayoutAcrossLineup` pays each act
-- splitPercent / Show.artistPayoutPercent of the artist share and leaves the
-- rest unallocated on purpose (never overpay a real person), so slots summing
-- to 70 against a show total of 75 would under-pay every act by a fifteenth.
-- Each slot is scaled by 75 / old total and rounded by largest remainder, so
-- every show's slots sum to exactly 75 and each act stays as close to its
-- agreed proportion as whole percentages allow.
-- Acceptance is untouched: the proportions between acts do not change.

WITH old AS (
  SELECT l."id", l."showId", l."splitPercent" * 75.0 / s."artistPayoutPercent" AS exact
  FROM "ShowLineupSlot" l
  JOIN "Show" s ON s."id" = l."showId"
  WHERE s."artistPayoutPercent" IS NOT NULL
    AND s."artistPayoutPercent" > 0
    AND s."artistPayoutPercent" <> 75
),
floored AS (
  SELECT "id", "showId", FLOOR(exact)::int AS p,
         ROW_NUMBER() OVER (PARTITION BY "showId" ORDER BY exact - FLOOR(exact) DESC, "id") AS rn
  FROM old
),
remainder AS (
  SELECT "showId", 75 - SUM(p) AS r FROM floored GROUP BY "showId"
)
UPDATE "ShowLineupSlot" l
SET "splitPercent" = floored.p + CASE WHEN floored.rn <= remainder.r THEN 1 ELSE 0 END
FROM floored
JOIN remainder ON remainder."showId" = floored."showId"
WHERE l."id" = floored."id";

ALTER TABLE "Show" ALTER COLUMN "promoterPayoutPercent" SET DEFAULT 0;

UPDATE "Show"
SET "artistPayoutPercent" = 75,
    "venuePayoutPercent" = 25
WHERE "artistPayoutPercent" IS NOT NULL
   OR "venuePayoutPercent" IS NOT NULL;

UPDATE "Show"
SET "promoterPayoutPercent" = 0
WHERE "promoterPayoutPercent" <> 0;
