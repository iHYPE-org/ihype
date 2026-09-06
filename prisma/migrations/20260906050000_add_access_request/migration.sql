-- Alpha/beta access requests become a first-class work item.
--
-- Until now a request from the landing page's form was an `AuditLog` row and
-- nothing else. An audit row is append-only and stateless by design, so there
-- was no way to approve one, no way to clear one, and the admin workbench's
-- "Alpha access requests" queue could only link to a raw audit dump. On a
-- closed alpha whose front page makes request-access the only way in, the
-- entire inbound funnel sat somewhere nobody could work.
--
-- The audit row is still written on every ask and remains the historical
-- record. This table is the WORK ITEM, so deleting a request never erases the
-- fact that somebody asked for one.
--
-- Additive only: one new enum, one new table, no column dropped or altered.

CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "note" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "inviteCode" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- Lower-cased and unique, so one person waiting is one row however many times
-- they ask, and `createdAt` keeps the moment of the FIRST ask — which is what
-- the workbench orders by ("longest wait", not "largest count").
CREATE UNIQUE INDEX "AccessRequest_email_key" ON "AccessRequest"("email");
CREATE INDEX "AccessRequest_status_createdAt_idx" ON "AccessRequest"("status", "createdAt");
CREATE INDEX "AccessRequest_createdAt_idx" ON "AccessRequest"("createdAt");

-- Backfill the queue from the audit rows that have been the only record so
-- far, so the new tab opens on the real funnel rather than on an empty list.
--
-- Three deliberate rules, each matching how the workbench already counted:
--   * one row per address, dated by the EARLIEST ask;
--   * addresses that already have an account are skipped — they got in, and a
--     row for them would read as "waiting" forever;
--   * a row whose metadata carries no usable address is skipped rather than
--     imported as an anonymous request nobody could action.
-- `role` and `note` are taken from that earliest ask, which is the one whose
-- date the row carries.
INSERT INTO "AccessRequest" ("id", "email", "role", "note", "status", "createdAt", "updatedAt")
SELECT
    'ar_backfill_' || md5(first_ask.email),
    first_ask.email,
    first_ask.role,
    first_ask.note,
    'PENDING',
    first_ask."createdAt",
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (lower(trim(a."metadata" ->> 'email')))
        lower(trim(a."metadata" ->> 'email')) AS email,
        NULLIF(trim(a."metadata" ->> 'role'), '') AS role,
        NULLIF(trim(a."metadata" ->> 'note'), '') AS note,
        a."createdAt"
    FROM "AuditLog" a
    WHERE a."action" = 'beta_access_request'
      AND a."metadata" ->> 'email' IS NOT NULL
      AND trim(a."metadata" ->> 'email') <> ''
      AND position('@' in a."metadata" ->> 'email') > 1
    ORDER BY lower(trim(a."metadata" ->> 'email')), a."createdAt" ASC
) AS first_ask
WHERE NOT EXISTS (
    SELECT 1 FROM "User" u WHERE lower(u."email") = first_ask.email
)
ON CONFLICT ("email") DO NOTHING;
