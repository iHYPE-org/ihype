import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { readClientAddress } from '@/lib/request-meta';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';
import { log } from '@/lib/logger';
import {
  executeAccountErasure,
  executeHypeWipe,
  executeIdentityDetach,
} from '@/lib/privacy-actions';

// Executes staff-reviewed privacy requests from the admin console. detach and
// hype-wipe normally auto-execute at submission time; this endpoint covers
// legacy OPEN rows for those kinds plus the deletion flow, which always
// requires a human to confirm identity/intent before running. All executions
// require a fresh admin passkey re-auth.
const schema = z.object({ action: z.enum(['execute', 'close']) });

const PRIVACY_TYPES = ['PRIVACY_DELETION', 'PRIVACY_DETACH', 'PRIVACY_HYPE_WIPE'] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const reauthed = await requireRecentAdminReauth(session.user.id);
  if (!reauthed) {
    return NextResponse.json({ requiresReauth: true }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const supportRequest = await db.supportRequest.findUnique({ where: { id } });

    if (!supportRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (!(PRIVACY_TYPES as readonly string[]).includes(supportRequest.type)) {
      return NextResponse.json({ error: 'Not a privacy request' }, { status: 400 });
    }
    if (supportRequest.status !== 'OPEN') {
      return NextResponse.json({ error: `Request is already ${supportRequest.status}` }, { status: 409 });
    }

    let summary: unknown = null;
    let newStatus = 'CLOSED';

    if (body.action === 'execute') {
      const targetUserId = supportRequest.requesterUserId;
      if (!targetUserId) {
        return NextResponse.json({ error: 'Request has no linked user to act on' }, { status: 400 });
      }
      if (supportRequest.type === 'PRIVACY_DELETION') {
        if (targetUserId === session.user.id) {
          return NextResponse.json({ error: 'Refusing to erase your own admin account from here' }, { status: 400 });
        }
        summary = await executeAccountErasure(targetUserId, session.user.id);
      } else if (supportRequest.type === 'PRIVACY_DETACH') {
        summary = await executeIdentityDetach(targetUserId, session.user.id);
      } else {
        summary = await executeHypeWipe(targetUserId, session.user.id);
      }
      newStatus = 'DONE';
    }

    const updated = await db.supportRequest.update({
      where: { id },
      data: { status: newStatus },
    });

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'privacy_request_resolved',
      entityType: 'support',
      entityId: id,
      ipAddress: readClientAddress(request),
      metadata: {
        requestType: supportRequest.type,
        action: body.action,
        status: newStatus,
        summary: summary ? JSON.parse(JSON.stringify(summary)) : null,
      },
    });

    return NextResponse.json({ id: updated.id, status: updated.status, summary });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid action' }, { status: 400 });
    }
    log.error('[api/admin/privacy-requests]', error instanceof Error ? error : { error: String(error) }, 'privacy request execution failed');
    const message = error instanceof Error ? error.message : 'Could not process the privacy request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
