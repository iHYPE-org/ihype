import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { refuseCredentialChangeWhileImpersonating } from '@/lib/impersonation-guard';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { recordAuditEvent } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const impersonating = await refuseCredentialChangeWhileImpersonating(session, 'passkey.delete');
    if (impersonating) return impersonating;

    const { id } = await params;
    const passkey = await db.passkey.findUnique({ where: { id }, select: { userId: true } });
    if (!passkey) return NextResponse.json({ error: 'Passkey not found.' }, { status: 404 });
    if (passkey.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    await db.passkey.delete({ where: { id } });
    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'passkey_deleted',
      entityType: 'user',
      entityId: session.user.id,
      metadata: { passkeyId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[api/auth/passkey/[id]', err instanceof Error ? err : { error: String(err) }, '] error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
