import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { readClientAddress } from '@/lib/request-meta';

const ALLOWED_FLAGS = new Set([
  'demo_logins',
  'invite_only_signup',
  'hide_demo_content',
  'blob_media_storage',
  'ticket_payment_capture'
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

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
    const { kvPut } = await import('@/lib/kv');
    await kvPut(`flags:${flag}`, enabled ? '1' : '0');
    storedInKv = true;
  } catch (error) {
    console.error('KV flag write failed', error);
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
