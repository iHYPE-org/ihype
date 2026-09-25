import { NextResponse } from 'next/server';
import { recordAuditEvent } from '@/lib/audit';

/**
 * Refuse a CREDENTIAL change made from an impersonated session.
 *
 * Impersonation is deliberately not read-only (see impersonation.ts), but a
 * credential is the one thing it must never touch. A passkey registered while
 * signed in as a member is a key the operator keeps after pressing "stop
 * impersonating" — it outlives the session, the audit trail and the banner,
 * and a passkey syncs to the member's other devices besides. Deleting a
 * member's passkey locks them out of their own account; attaching a recovery
 * address hands account recovery to whoever typed it. So: add a passkey,
 * remove one, attach an email — each answers 403 while `impersonatorId` is set.
 *
 * The refusal is itself written to the audit log under the OPERATOR's id, so an
 * attempt is attributable even though it changed nothing — the same promise
 * impersonation.ts makes for the session it rides on.
 *
 * Returns the refusal to send, or null to carry on.
 */
export async function refuseCredentialChangeWhileImpersonating(
  session: { user?: unknown } | null | undefined,
  attempted: 'passkey.register' | 'passkey.delete' | 'recovery_email.add',
): Promise<NextResponse | null> {
  const user = session?.user as { id?: unknown; impersonatorId?: unknown } | null | undefined;
  const impersonatorId = user?.impersonatorId;
  if (typeof impersonatorId !== 'string' || impersonatorId.length === 0) return null;
  await recordAuditEvent({
    actorUserId: impersonatorId,
    action: 'credential_change_refused_impersonating',
    entityType: 'user',
    entityId: typeof user?.id === 'string' ? user.id : null,
    metadata: { attempted },
  });
  return NextResponse.json(
    {
      error: 'Credentials cannot be changed while you are signed in as someone else.',
      code: 'IMPERSONATING',
    },
    { status: 403 },
  );
}
