-- Refund transparency for up-front ad billing (2026-09-02). Settlement used
-- to stamp `settledAt` and nothing else, so the advertiser's dashboard could
-- not say what stayed charged, what came back, or the Stripe refund it can
-- be traced by. Additive and nullable: a campaign settled before this
-- carries nulls and renders as "settled" without figures, never as $0.
ALTER TABLE "Ad" ADD COLUMN "settledChargedCents" INTEGER;
ALTER TABLE "Ad" ADD COLUMN "refundedCents" INTEGER;
ALTER TABLE "Ad" ADD COLUMN "stripeRefundId" TEXT;
