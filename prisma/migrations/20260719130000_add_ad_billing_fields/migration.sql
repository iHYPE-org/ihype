-- Pre-auth-then-capture ad billing (DESIGN_SYNC row 234) — real Stripe
-- payment authorization for self-serve ad campaigns. runDays is decoupled
-- from startsAt/endsAt so a campaign awaiting manual review or payment
-- doesn't lose run length while it waits.

ALTER TABLE "Ad" ADD COLUMN "runDays" INTEGER;
ALTER TABLE "Ad" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Ad" ADD COLUMN "authorizedAt" TIMESTAMP(3);
ALTER TABLE "Ad" ADD COLUMN "settledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Ad_stripePaymentIntentId_key" ON "Ad"("stripePaymentIntentId");
