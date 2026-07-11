-- Double opt-in for newsletter subscriptions: a row written on subscribe is
-- not treated as consented until confirmedAt is set via the emailed confirm
-- link. confirmToken is single-use and time-boxed.
ALTER TABLE "NewsletterSubscription" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "NewsletterSubscription" ADD COLUMN "confirmToken" TEXT;
ALTER TABLE "NewsletterSubscription" ADD COLUMN "confirmTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "NewsletterSubscription_confirmToken_key" ON "NewsletterSubscription"("confirmToken");
