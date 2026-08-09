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
import { log } from '@/lib/logger';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { consumeAdminSetupRateLimit } from '@/lib/admin-setup-rate-limit';
import { DEFAULT_ADMIN_EMAIL as ADMIN_EMAIL } from '@/lib/admin-allowlist';
import { sendOperationalEmail } from '@/lib/mailer';
import { deferWork } from '@/lib/defer-work';

export async function POST(request: Request) {
  try {
    // Uses bearer token auth because this endpoint runs before any admin
    // session exists. The bearer secret gates setup; a separate one-time,
    // random capability gates the passkey ceremony itself.
    if (readRuntimeEnv('ALLOW_ADMIN_SETUP') !== 'true') {
      await recordAuditEvent({
        action: 'admin_setup_blocked',
        entityType: 'admin-setup',
        ipAddress: readClientAddress(request),
        metadata: { reason: 'setup_disabled' },
      });
      return NextResponse.json({ error: 'Admin setup is disabled.' }, { status: 410 });
    }

    const rateLimit = await consumeAdminSetupRateLimit(request);
    if (!rateLimit.allowed) {
      await recordAuditEvent({
        action: 'admin_setup_rate_limited',
        entityType: 'admin-setup',
        ipAddress: readClientAddress(request),
      });
      return NextResponse.json(
        { error: 'Too many setup attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const secret = readRuntimeEnv('ADMIN_SETUP_SECRET');
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
        where: { email: ADMIN_EMAIL },
        select: { id: true, _count: { select: { passkeys: true } } },
      });

      if (existing?._count.passkeys) return { state: 'completed' as const, userId: existing.id };

      const userId = existing
        ? existing.id
        : (
            await tx.user.create({
              data: {
                email: ADMIN_EMAIL,
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

      // Creating the administrator is the single most sensitive thing this
      // deployment can do, and until now it happened in silence — an audit row
      // nobody reads unless they already suspect something. The notice goes to
      // the account's OWN mailbox, which is the point: whoever holds
      // admin@ihype.org finds out that an admin account now exists, even if
      // they were not the one who ran setup.
      //
      // Deferred and not awaited: a mail outage must not fail the one endpoint
      // that can bootstrap access, and `deferWork` reports its own failures to
      // Sentry. The audit row above is written first and is the durable record.
      const when = new Date().toISOString();
      const lines = [
        `An administrator account was created for ${ADMIN_EMAIL} at ${when}.`,
        `Requested from ${readClientAddress(request) ?? 'an unknown address'}.`,
        '',
        'A one-time passkey registration link was issued with it. If this was',
        'not you, register a passkey on that account immediately to claim it,',
        'then set ALLOW_ADMIN_SETUP to false.',
      ];
      deferWork(
        sendOperationalEmail(
          {
            to: ADMIN_EMAIL,
            subject: 'iHYPE administrator account created',
            text: lines.join('\n'),
            html: lines.map((line) => `<p>${line}</p>`).join('\n'),
          },
          'admin-setup-notice',
        ),
        'admin-setup-notice',
      );
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
    log.error('[api/admin/setup]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
