import { Prisma } from '@prisma/client/edge';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

type EmailDeliveryInput = {
  type: string;
  recipient: string;
  status: 'LOGGED' | 'SENT' | 'FAILED';
  provider?: string | null;
  error?: string | null;
};

export async function recordAuditEvent({
  actorUserId,
  action,
  entityType,
  entityId,
  ipAddress,
  metadata
}: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        action,
        entityType,
        entityId: entityId || null,
        ipAddress: ipAddress || null,
        metadata: metadata === null ? Prisma.JsonNull : metadata ?? undefined
      }
    });
  } catch (error) {
    log.error('[audit]', error instanceof Error ? error : { error: String(error) }, 'audit log write failed');
  }
}

export async function recordEmailDelivery({
  type,
  recipient,
  status,
  provider,
  error
}: EmailDeliveryInput) {
  try {
    await db.emailDeliveryLog.create({
      data: {
        type,
        recipient,
        status,
        provider: provider || null,
        error: error || null
      }
    });
  } catch (logError) {
    log.error('[audit]', logError instanceof Error ? logError : { error: String(logError) }, 'email delivery log write failed');
  }
}
