-- Set when an AccountsPayableEntry is actually paid out via a real Stripe
-- transfer (src/lib/stripe.ts's createPayoutTransfer) — see DESIGN_SYNC.md
-- for the payout-routing fix this supports.
ALTER TABLE "AccountsPayableEntry" ADD COLUMN "stripeTransferId" TEXT;
