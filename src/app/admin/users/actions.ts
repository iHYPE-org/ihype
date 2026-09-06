'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';
import { generateInviteCode, normaliseRequestEmail } from '@/lib/access-requests';
import { sendGenericEmail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';
import { getBaseUrl } from '@/lib/utils';
import { log } from '@/lib/logger';

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

/**
 * Approve an alpha/beta access request: mint the invite, tell the person.
 *
 * "Approved" in this product has always meant one specific thing — an admin
 * issues the requester a single-use `InviteCode` — and until now that was two
 * disconnected chores: mint a batch of codes on one screen, then find the
 * address in an audit dump and mail one out by hand. Nothing recorded which
 * code went to whom, so nothing could tell an operator whether a name had been
 * dealt with.
 *
 * The code is minted and the row is decided in ONE transaction, so a request
 * can never read as approved while carrying no code, and a code can never be
 * spent against a request that failed to save.
 *
 * The email is sent AFTER that commits and its failure is logged rather than
 * thrown: outbound mail has been dead here for 35 days once without anyone
 * noticing (DESIGN_SYNC row 254), and an approval that rolls back because
 * Resend is down would lose the decision as well as the message. The code is
 * shown in the console either way, so the operator can always send it by hand.
 */
export async function approveAccessRequestAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get('requestId') ?? '');
  if (!id) return;

  const existing = await db.accessRequest.findUnique({ where: { id }, select: { email: true, status: true } });
  if (!existing) return;

  const email = normaliseRequestEmail(existing.email);
  if (!email) return;

  /* Somebody who already has an account got in by another door — a member's
     invite link, a code handed over in person. Minting them a single-use code
     spends one on nobody and marks the row with a decision that never
     happened. The page hides the button in this case; this is the half of that
     rule the browser cannot be trusted to enforce. */
  const alreadyIn = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
  if (alreadyIn || existing.status !== 'PENDING') return;

  const code = generateInviteCode();
  await db.$transaction(async (tx) => {
    await tx.inviteCode.create({ data: { code, createdBy: session.user!.id! } });
    await tx.accessRequest.update({
      where: { id, status: 'PENDING' },
      data: { status: 'APPROVED', inviteCode: code, decidedAt: new Date(), decidedBy: session.user!.id! },
    });
  });

  await recordAuditEvent({
    actorUserId: session.user!.id!,
    action: 'access_request_approved',
    entityType: 'AccessRequest',
    entityId: id,
    metadata: { email, inviteCode: code },
  });

  const url = `${getBaseUrl().replace(/\/$/, '')}/register`;
  const lines = [
    'Your iHYPE invite is ready.',
    '',
    `Invite code: ${code}`,
    '',
    `Create your account at ${url} and enter the code when asked.`,
    'The code works once and is for you.',
  ];
  try {
    await sendGenericEmail({
      to: email,
      subject: 'Your iHYPE invite code',
      text: lines.join('\n'),
      html: lines.map((line) => (line ? `<p>${escapeHtml(line)}</p>` : '<p>&nbsp;</p>')).join('\n'),
    });
  } catch (error) {
    log.error('[access-request]', error instanceof Error ? error : { error: String(error) }, 'approved, but the invite email did not send');
  }

  revalidatePath('/admin/users');
}

/**
 * Clear a request off the queue — spam, a duplicate, or somebody being told no.
 *
 * This deletes the WORK ITEM, not the history: `POST /api/beta-access-request`
 * writes an append-only `AuditLog` row on every ask, and that row is untouched
 * here, so removing a request can never erase the fact that the person asked
 * or when. A second audit row records who cleared it and which address it was,
 * because "it disappeared from the list" is not an answer anyone can audit.
 *
 * Deliberately a delete rather than a DECLINED flip. The status exists for a
 * decision an operator wants to keep visible; most of what needs clearing off
 * this queue is a bot filling in a public form, and a growing wall of declined
 * spam is how a queue stops being read.
 */
export async function deleteAccessRequestAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get('requestId') ?? '');
  if (!id) return;

  const existing = await db.accessRequest.findUnique({
    where: { id },
    select: { email: true, status: true, inviteCode: true },
  });
  if (!existing) return;

  await db.accessRequest.delete({ where: { id } });

  await recordAuditEvent({
    actorUserId: session.user!.id!,
    action: 'access_request_deleted',
    entityType: 'AccessRequest',
    entityId: id,
    metadata: {
      email: existing.email,
      status: existing.status,
      // Recorded because deleting the row is the only remaining link between a
      // minted code and the person it was issued to. The code itself is NOT
      // revoked: it may already be in their inbox, and quietly killing an
      // invite somebody is holding is a worse failure than a stale row.
      inviteCode: existing.inviteCode,
    },
  });

  revalidatePath('/admin/users');
}
