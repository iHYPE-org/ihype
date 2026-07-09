import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import {
  createPasskeyBootstrapCapability,
  getPasskeyBootstrapCookieName,
  getPasskeyBootstrapCookieOptions,
} from '@/lib/passkey-bootstrap';
import { readClientAddress } from '@/lib/request-meta';
import { verifyBearerToken } from '@/lib/secret-compare';

export async function POST(request: Request) {
  try {
    // Uses bearer token auth because this endpoint runs before any admin
    // session exists. The bearer secret gates setup; a separate one-time,
    // random capability gates the passkey ceremony itself.
    if (process.env.ALLOW_ADMIN_SETUP !== 'true') {
      await recordAuditEvent({
        action: 'admin_setup_blocked',
        entityType: 'admin-setup',
        ipAddress: readClientAddress(request),
        metadata: { reason: 'setup_disabled' },
      });
      return NextResponse.json({ error: 'Admin setup is disabled.' }, { status: 410 });
    }

    const secret = process.env.ADMIN_SETUP_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Admin setup is not configured.' }, { status: 500 });
    }

    if (!verifyBearerToken(request.headers.get('authorization'), secret)) {
      await recordAuditEvent({
        action: 'admin_setup_failed',
        entityType: 'admin-setup',
        ipAddress: readClientAddress(request),
        metadata: { reason: 'invalid_secret' },
      });
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const bootstrap = createPasskeyBootstrapCapability();
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: 'admin@ihype.org' },
        select: { id: true, _count: { select: { passkeys: true } } },
      });

      if (existing?._count.passkeys) return { state: 'completed' as const, userId: existing.id };

      const userId = existing
        ? existing.id
        : (
            await tx.user.create({
              data: {
                email: 'admin@ihype.org',
                role: 'ADMIN',
                isThirteenOrOlder: true,
                username: 'admin',
                name: 'iHYPE Admin',
              },
              select: { id: true },
            })
          ).id;

      await tx.passkeyBootstrapToken.deleteMany({
        where: { userId, usedAt: null },
      });
      await tx.passkeyBootstrapToken.create({
        data: {
          userId,
          tokenHash: bootstrap.tokenHash,
          expiresAt: bootstrap.expiresAt,
        },
      });

      return { state: existing ? ('existing' as const) : ('created' as const), userId };
    });

    if (result.state === 'completed') {
      return NextResponse.json({ error: 'Admin setup already completed.' }, { status: 410 });
    }

    if (result.state === 'created') {
      await recordAuditEvent({
        actorUserId: result.userId,
        action: 'admin_account_created',
        entityType: 'User',
        entityId: result.userId,
        ipAddress: readClientAddress(request),
        metadata: { via: 'admin-setup' },
      });
    }

    const response = NextResponse.json({
      created: result.state === 'created',
      exists: result.state === 'existing',
    });
    response.cookies.set(
      getPasskeyBootstrapCookieName(),
      bootstrap.token,
      getPasskeyBootstrapCookieOptions(),
    );
    response.cookies.delete('pk_reg_first_uid');
    response.cookies.delete('pk_reg_first_challenge');
    return response;
  } catch (error) {
    console.error('[api/admin/setup] error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
