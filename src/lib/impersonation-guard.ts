import { NextResponse } from 'next/server';

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
 * Returns the refusal to send, or null to carry on.
 */
export function refuseCredentialChangeWhileImpersonating(
  session: { user?: unknown } | null | undefined,
): NextResponse | null {
  const impersonatorId = (session?.user as { impersonatorId?: unknown } | null | undefined)?.impersonatorId;
  if (typeof impersonatorId !== 'string' || impersonatorId.length === 0) return null;
  return NextResponse.json(
    {
      error: 'Credentials cannot be changed while you are signed in as someone else.',
      code: 'IMPERSONATING',
    },
    { status: 403 },
  );
}
