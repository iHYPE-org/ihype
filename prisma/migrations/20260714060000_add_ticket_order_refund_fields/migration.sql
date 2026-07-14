-- Real refund audit trail — set when POST /api/tickets/[serializedId]/refund
-- actually completes a Stripe refund (see src/lib/stripe.ts's
-- refundTicketPaymentIntent), replacing the previous version which only
-- ever filed a support ticket and never touched money or ticket validity.
ALTER TABLE "TicketOrder" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "TicketOrder" ADD COLUMN "stripeRefundId" TEXT;
