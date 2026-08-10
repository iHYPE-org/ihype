import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminApi } from '@/lib/admin-api';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { refuseImpersonation, refusalMessage, refusalStatus } from '@/lib/impersonation';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Start impersonating a member.
 *
 * Gated by `requireAdminApi`, which is both the admin-session check and the
 * registered-device check — this is not a route to reach from an unrecognised
 * machine.
 *
 * The audit row is written BEFORE the session is minted, on purpose. If the
 * write fails the impersonation does not happen: an untraceable session for
 * somebody else's account is worse than a refused request, and this is the one
 * place in the codebase where a failed audit write should abort rather than be
 * swallowed. Everywhere else logs best-effort because the action was the point;
 * here the record IS the safeguard.
 */
export async function POST(request: NextRequest) {
  const { session, response } = await requireAdminApi(request);
  if (response) return response;

  let body: { userId?: unknown } | null = null;
  try {
    body = (await request.json()) as { userId?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  if (!userId) return NextResponse.json({ error: 'A userId is required.' }, { status: 400 });

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, image: true, role: true,
      emailVerified: true, userSecurityVersion: true,
    },
  });

  const refusal = refuseImpersonation(target, session.user.id);
  if (refusal) {
    return NextResponse.json({ error: refusalMessage(refusal) }, { status: refusalStatus(refusal) });
  }
  // `refuseImpersonation` returning null already proves this, but it does so
  // through a helper TypeScript cannot see into.
  if (!target) return NextResponse.json({ error: 'That account cannot be signed in as.' }, { status: 404 });

  try {
    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'admin_impersonation_started',
      entityType: 'User',
      entityId: target.id,
      ipAddress: readClientAddress(request),
      metadata: { targetEmail: target.email, targetRole: target.role },
    });
  } catch (error) {
    log.error('[api/admin/impersonate]', error instanceof Error ? error : { error: String(error) }, 'audit write failed — refusing');
    return NextResponse.json({ error: 'Could not record this action, so it was not taken.' }, { status: 500 });
  }

  const cookie = await buildAuthSessionCookie(target, session.user.id);
  if (!cookie) {
    return NextResponse.json({ error: 'Could not create the session.' }, { status: 500 });
  }

  const ok = NextResponse.json({ ok: true, redirect: WORKBENCH_PATH });
  ok.cookies.set(cookie);
  return ok;
}
