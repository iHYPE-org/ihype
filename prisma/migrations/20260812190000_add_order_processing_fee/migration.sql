-- Stripe's processing fee, paid by the buyer, recorded per order.
--
-- iHYPE is a nonprofit and absorbs no fee of any kind: the charter's 70/20/10
-- splits FACE VALUE, the platform takes $0, and Stripe's cost of moving the
-- money is added to the buyer's total and disclosed before payment.
--
-- Additive with a default, so it is safe to apply on deploy: existing rows read
-- 0, which is exactly right — they were charged before the fee existed, and
-- backfilling a computed figure would be inventing a charge nobody paid.
ALTER TABLE "TicketOrder" ADD COLUMN "processingFeeCents" INTEGER NOT NULL DEFAULT 0;
