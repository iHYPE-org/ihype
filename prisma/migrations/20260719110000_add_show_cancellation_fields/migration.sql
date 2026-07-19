-- Event Cancellation Flow (DESIGN_SYNC row 227) — records why an organizer
-- cancelled their own show, distinct from the existing admin-moderation
-- CANCELED path (src/app/api/admin/moderation/[id]/route.ts), which never
-- recorded a reason. Additive, nullable — no existing row needs a value.

ALTER TABLE "Show" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Show" ADD COLUMN "canceledAt" TIMESTAMP(3);
