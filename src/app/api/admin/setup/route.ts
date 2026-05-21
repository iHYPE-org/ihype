import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';

const REG_COOKIE_TTL_SECONDS = 10 * 60;

export async function POST(request: Request) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Admin setup is not configured.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const provided = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (!provided || provided !== secret) {
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
      return NextResponse.json({ exists: true, userId: existing.id });
    }
    const resp = NextResponse.json({ exists: true, userId: existing.id });
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

  const resp = NextResponse.json({ created: true, userId: created.id });
  return setCookie(resp, created.id);
}
