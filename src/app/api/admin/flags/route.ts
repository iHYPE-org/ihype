import { NextResponse, NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';
import { kvPut } from '@/lib/kv';
import { log } from '@/lib/logger';

const ALLOWED_FLAGS = new Set([
  'invite_only_signup',
  'invite_code_sharing',
  'blob_media_storage',
  'registrations_enabled',
  'uploads_enabled',
  'outbound_email_enabled',
  'advertising_enabled',
  'payments_enabled',
  'tickets_enabled',
  'radio_enabled',
  'maps_enabled',
]);

export async function POST(request: NextRequest) {
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

  let body: { flag?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const flag = typeof body.flag === 'string' ? body.flag.trim() : '';
  const enabled = Boolean(body.enabled);
  if (!flag || !ALLOWED_FLAGS.has(flag)) {
    return NextResponse.json({ error: 'Unknown flag.' }, { status: 400 });
  }

  let storedInKv = false;
  try {
    await kvPut(`flags:${flag}`, enabled ? '1' : '0');
    storedInKv = true;
  } catch (error) {
    log.error('[api/admin/flags]', error instanceof Error ? error : { error: String(error) }, 'KV flag write failed');
  }

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'admin_flag_override',
    entityType: 'FeatureFlag',
    entityId: flag,
    ipAddress: readClientAddress(request),
    metadata: { enabled, storedInKv }
  });

  return NextResponse.json({ ok: true, flag, enabled, storedInKv });
}
