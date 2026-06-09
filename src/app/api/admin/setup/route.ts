import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';
import { verifyBearerToken } from '@/lib/secret-compare';

const REG_COOKIE_TTL_SECONDS = 10 * 60;

export async function POST(request: Request) {
  try {
    // Uses bearer token auth (ADMIN_SETUP_SECRET) instead of session auth because
    // this endpoint is called during bootstrapping, before any admin session exists.
    // Session-based auth is not available at this stage of setup.
    if (process.env.ALLOW_ADMIN_SETUP !== 'true') {
      await recordAuditEvent({
        action: 'admin_setup_blocked',
        entityType: 'admin-setup',
        ipAddress: readClientAddress(request),
        metadata: { reason: 'setup_disabled' }
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
        metadata: { reason: 'invalid_secret' }
      });
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const setCookie = (resp: NextResponse, userId: string) => {
      resp.cookies.set({
        name: 'pk_reg_first_uid',
        value: userId,
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: isProduction,
        maxAge: REG_COOKIE_TTL_SECONDS
      });
      return resp;
    };

    const existing = await db.user.findUnique({
      where: { email: 'admin@ihype.org' },
      select: { id: true, _count: { select: { passkeys: true } } }
    });

    if (existing) {
      // Don't re-issue the passkey bootstrap cookie once passkeys are already registered —
      // that window should only be open once.
      if (existing._count.passkeys > 0) {
        return NextResponse.json({ error: 'Admin setup already completed.' }, { status: 410 });
      }
      const resp = NextResponse.json({ exists: true });
      return setCookie(resp, existing.id);
    }

    const created = await db.user.create({
      data: {
        email: 'admin@ihype.org',
        role: 'ADMIN',
        isThirteenOrOlder: true,
        username: 'admin',
        name: 'iHYPE Admin'
      },
      select: { id: true }
    });

    await recordAuditEvent({
      actorUserId: created.id,
      action: 'admin_account_created',
      entityType: 'User',
      entityId: created.id,
      ipAddress: readClientAddress(request),
      metadata: { via: 'admin-setup' }
    });

    const resp = NextResponse.json({ created: true });
    return setCookie(resp, created.id);
  } catch (err) {
    console.error('[api/admin/setup] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
