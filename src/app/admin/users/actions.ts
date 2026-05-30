'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';

async function requireAdmin() {
  const session = await auth();
  if (!isAdminSession(session) || !session?.user?.id) {
    throw new Error('Forbidden');
  }
  return session;
}

export async function suspendUserAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return;

  // Increment userSecurityVersion to invalidate existing JWTs for the suspended user.
  await db.user.update({
    where: { id: userId },
    data: { userSecurityVersion: { increment: 1 } }
  });

  await recordAuditEvent({
    actorUserId: session.user!.id!,
    action: 'admin_user_suspended',
    entityType: 'User',
    entityId: userId,
    metadata: { note: 'soft-suspend via admin console — userSecurityVersion incremented to invalidate tokens' }
  });

  revalidatePath('/admin/users');
}

export async function promoteToAdminAction(formData: FormData) {
  const session = await requireAdmin();
  const reauthed = await requireRecentAdminReauth(session.user!.id!);
  if (!reauthed) throw new Error('Recent re-authentication required.');
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return;

  await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });

  await recordAuditEvent({
    actorUserId: session.user!.id!,
    action: 'admin_user_promoted',
    entityType: 'User',
    entityId: userId,
    metadata: { newRole: 'ADMIN' }
  });

  revalidatePath('/admin/users');
}

export async function featureShowAction(formData: FormData) {
  const session = await requireAdmin();
  const showId = String(formData.get('showId') ?? '');
  if (!showId) return;

  // Schema has no featured field — record an audit event instead.
  await recordAuditEvent({
    actorUserId: session.user!.id!,
    action: 'admin_show_featured',
    entityType: 'Show',
    entityId: showId,
    metadata: { note: 'feature toggle via admin console (no schema field)' }
  });

  revalidatePath('/admin');
}
