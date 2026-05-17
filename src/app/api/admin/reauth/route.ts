import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPasskeyAuthenticationOptions, verifyPasskeyAuthentication } from '@/lib/passkey';
import { markAdminReauth } from '@/lib/admin-confirmation';
import { isAdminSession } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

// GET — generate passkey challenge for current admin user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const options = await getPasskeyAuthenticationOptions(session.user.id);
  const resp = NextResponse.json(options);
  resp.cookies.set('admin_reauth_challenge', options.challenge, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 300,
    path: '/'
  });
  return resp;
}

// POST — verify passkey assertion + set KV reauth flag
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const challenge = jar.get('admin_reauth_challenge')?.value;
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge expired. Try again.' }, { status: 400 });
  }
  const body = await request.json();
  const verifiedUserId = await verifyPasskeyAuthentication(body, challenge);
  const resp = (payload: Record<string, unknown>, status = 200) => {
    const r = NextResponse.json(payload, { status });
    r.cookies.delete('admin_reauth_challenge');
    return r;
  };
  if (!verifiedUserId || verifiedUserId !== session.user.id) {
    return resp({ error: 'Passkey verification failed.' }, 401);
  }
  await markAdminReauth(session.user.id);
  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'admin_reauth',
    entityType: 'user',
    entityId: session.user.id,
    ipAddress: readClientAddress(request),
    metadata: { ok: true }
  });
  return resp({ ok: true });
}
