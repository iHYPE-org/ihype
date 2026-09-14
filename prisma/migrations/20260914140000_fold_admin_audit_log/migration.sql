-- Folds AdminAuditLog into AuditLog and drops it (DESIGN_SYNC row 438).
--
-- AdminAuditLog had exactly one writer — the verification decision route,
-- which recorded `verification.verified` / `verification.rejected` there —
-- and no reader anywhere: /admin/audit reads AuditLog, the erasure path never
-- knew it, and nothing exported it. The one identity decision the console
-- makes was therefore invisible in the console's own audit log. The route
-- writes AuditLog as of this deploy; this carries the rows already recorded
-- across, then removes the table so a second log cannot grow again.
--
-- Nothing is lost: every row is copied first, under its own id and timestamp,
-- with the actor kept where that user still exists and NULL (rendered as
-- "system" by the audit page) where they do not — AuditLog.actorUserId is a
-- foreign key to User and AdminAuditLog.actorId never was, so a copy that
-- assumed the actor still exists could fail and block every later deploy
-- (CLAUDE.md's P3009 incident). ON CONFLICT covers a partial earlier run.

INSERT INTO "AuditLog" ("id", "actorUserId", "action", "entityType", "entityId", "metadata", "createdAt")
SELECT a."id", u."id", a."action", a."targetType", a."targetId", a."meta", a."createdAt"
FROM "AdminAuditLog" a
LEFT JOIN "User" u ON u."id" = a."actorId"
ON CONFLICT ("id") DO NOTHING;

DROP TABLE "AdminAuditLog";
