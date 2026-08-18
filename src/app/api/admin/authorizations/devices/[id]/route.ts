import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';
import { recordAuditEvent } from '@/lib/audit';
import { log } from '@/lib/logger';

/**
 * Revoke one admin console device.
 *
 * Gated on a recent re-auth like the other destructive admin actions: whoever
 * holds a console session can otherwise cut every other operator off from the
 * console, including in an account takeover, which is precisely when the real
 * operator needs their own device to keep working.
 *
 * Revoking the caller's own device is allowed on purpose — an operator holding
 * a compromised laptop has to be able to cut it off from that laptop. The audit
 * row records which it was.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const reauthed = await requireRecentAdminReauth(session.user.id);
    if (!reauthed) return NextResponse.json({ requiresReauth: true }, { status: 401 });

    const { id } = await params;

    // Read before deleting so the audit row can name the device. After the
    // delete there is nothing left to describe it with.
    const device = await db.adminDevice.findUnique({
      where: { id },
      select: { id: true, label: true, userId: true },
    });
    if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // deleteMany, not delete: a concurrent revoke of the same row would throw
    // P2025 on the second caller, which is a 500 for what is actually the
    // desired end state.
    const result = await db.adminDevice.deleteMany({ where: { id } });
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'admin.device.revoke',
      entityType: 'AdminDevice',
      entityId: device.id,
      metadata: {
        label: device.label ?? null,
        ownerUserId: device.userId,
        selfRevoke: device.userId === session.user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error(
      '[admin/authorizations/devices]',
      error instanceof Error ? error : { error: String(error) },
      'device revoke failed',
    );
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
