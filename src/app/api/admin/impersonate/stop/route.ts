import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';
import { isAllowedAdminEmail } from '@/lib/admin-allowlist';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Stop impersonating, and restore the operator's own session.
 *
 * Deliberately NOT behind `requireAdminApi`. The caller's current session is
 * the impersonated member's — role FAN, no admin device cookie of its own — so
 * an admin check here would refuse the one request an impersonating operator
 * most needs to make, and strand them in somebody else's account with no way
 * back but clearing cookies.
 *
 * What authorises it instead is the `imp` claim, which lives inside the signed
 * session token and therefore cannot be forged: possession of a session that
 * says "an operator is driving this" is exactly the right to stop driving it.
 *
 * The operator is then re-checked against the admin allowlist before their
 * session is re-minted. That is defence in depth rather than ceremony: the
 * impersonated session may have been minted before an address left the
 * allowlist, and exiting must not be a way to mint a fresh admin token for an
 * account that would no longer be granted one.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const operatorId = (session?.user as { impersonatorId?: string | null } | undefined)?.impersonatorId;
  if (!session?.user?.id || !operatorId) {
    return NextResponse.json({ error: 'Not impersonating.' }, { status: 400 });
  }

  const operator = await db.user.findUnique({
    where: { id: operatorId },
    select: {
      id: true, name: true, email: true, image: true, role: true,
      emailVerified: true, userSecurityVersion: true,
    },
  });

  if (!operator || operator.role !== 'ADMIN' || !isAllowedAdminEmail(operator.email, readRuntimeEnv('ADMIN_ALLOWED_EMAILS'))) {
    // The operator is gone, demoted or off the allowlist. Do NOT restore an
    // admin session; the safe landing is signed out, which the client turns
    // into a trip to /login.
    log.error(
      '[api/admin/impersonate/stop] operator is no longer an allowed admin',
      { operatorId, found: Boolean(operator) },
      'error',
    );
    return NextResponse.json({ error: 'Your operator session is no longer valid. Please sign in again.' }, { status: 403 });
  }

  // Best-effort here, unlike starting: the impersonation is already recorded,
  // and refusing to let someone LEAVE a borrowed account because a log write
  // failed would be the wrong trade.
  await recordAuditEvent({
    actorUserId: operator.id,
    action: 'admin_impersonation_stopped',
    entityType: 'User',
    entityId: session.user.id,
    ipAddress: readClientAddress(request),
  }).catch(() => {});

  const cookie = await buildAuthSessionCookie(operator);
  if (!cookie) {
    return NextResponse.json({ error: 'Could not restore your session.' }, { status: 500 });
  }

  const ok = NextResponse.json({ ok: true, redirect: '/admin' });
  ok.cookies.set(cookie);
  return ok;
}
