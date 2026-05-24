-- Idempotency log for inbound webhooks (Stripe and other providers)
CREATE TABLE "ProcessedWebhookEvent" (
  "id"          TEXT NOT NULL,
  "source"      TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedWebhookEvent_source_eventId_key"
  ON "ProcessedWebhookEvent"("source", "eventId");

CREATE INDEX "ProcessedWebhookEvent_processedAt_idx"
  ON "ProcessedWebhookEvent"("processedAt");
