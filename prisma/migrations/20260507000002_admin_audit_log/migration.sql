CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id"         TEXT NOT NULL,
  "actorId"    TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId"   TEXT NOT NULL,
  "meta"       JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetId_idx" ON "AdminAuditLog"("targetId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
