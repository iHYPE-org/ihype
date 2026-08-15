import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api';
import { getDeviceCookieName } from '@/lib/admin-device';
import { listAdminDevices, revokeAdminDevice } from '@/lib/admin-device-store';
import { recordAuditEvent } from '@/lib/audit';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/admin/devices` · `DELETE /api/admin/devices?id=`
 *
 * The console can now be opened from more than one device (`AdminDevice`),
 * which immediately raises the question the single column never could: WHICH
 * ones. A list of devices that cannot be seen is a list that cannot be audited,
 * and the only revocation available before this was registering a new device
 * and hoping the old row was the one overwritten.
 *
 * Both verbs go through `requireAdminApi`, so they carry the full gate — the
 * session, `isAdminSession()` (role AND allowlisted address), and a registered
 * device. Note the last one deliberately: an unregistered device cannot revoke
 * a registered one, which is what stops a stolen session cookie from locking
 * the real operator out of their own console.
 */
export async function GET(request: NextRequest) {
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

  const cookieValue = request.cookies.get(getDeviceCookieName())?.value;
  const devices = await listAdminDevices(session.user.id, cookieValue);

  return NextResponse.json(
    { devices },
    // Names the operator's own devices and when each was last used — never a
    // shared cache.
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function DELETE(request: NextRequest) {
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'A device id is required.' }, { status: 400 });
  }

  const cookieValue = request.cookies.get(getDeviceCookieName())?.value;
  const devices = await listAdminDevices(session.user.id, cookieValue);
  const target = devices.find((device) => device.id === id);

  if (!target) {
    // 404 rather than 403: the id either is not this operator's or does not
    // exist, and telling those apart is a membership oracle for no benefit.
    return NextResponse.json({ error: 'No such device.' }, { status: 404 });
  }

  // Revoking the device you are holding signs you out of the console you are
  // standing in, and the way back is an emailed link. That is a legitimate
  // thing to want — a laptop being handed on — but it must be deliberate, so
  // it takes an explicit flag rather than a tap on the wrong row.
  if (target.current && new URL(request.url).searchParams.get('confirmSelf') !== 'true') {
    return NextResponse.json(
      {
        error: 'That is the device you are using. Re-send with confirmSelf=true to sign this device out.',
        current: true,
      },
      { status: 409 },
    );
  }

  const revoked = await revokeAdminDevice(session.user.id, id);
  if (!revoked) {
    return NextResponse.json({ error: 'No such device.' }, { status: 404 });
  }

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'admin_device_revoked',
    entityType: 'user',
    entityId: session.user.id,
    metadata: { label: target.label, wasCurrent: target.current },
  }).catch((error) => {
    // The revoke already happened; failing to record it must not report failure
    // to the caller, or they will revoke again.
    log.error('[api/admin/devices] audit failed', error instanceof Error ? error : { error: String(error) });
  });

  return NextResponse.json({ ok: true, revoked: id });
}
