-- promoterPayoutPercent default was still 5 from the old 45/45/10 split;
-- application code already defaults to DEFAULT_PROMOTER_AFFILIATE_PERCENT (10),
-- this just brings the column default in line with it.
ALTER TABLE "Show" ALTER COLUMN "promoterPayoutPercent" SET DEFAULT 10;
