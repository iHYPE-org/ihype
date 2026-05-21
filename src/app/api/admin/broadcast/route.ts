import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { sendGenericEmail } from '@/lib/mailer';
import { readClientAddress } from '@/lib/request-meta';

const ROLES = ['FAN', 'ARTIST', 'DJ', 'VENUE', 'ALL'] as const;
type TargetRole = (typeof ROLES)[number];

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const rl = await consumeRateLimit(`admin-broadcast:${session.user.id}`, {
    limit: 1,
    windowMs: 60 * 60 * 1000
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Broadcast rate limit reached. Try again in an hour.' },
      { status: 429 }
    );
  }

  let body: { subject?: string; body?: string; targetRole?: string; preview?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const subject = (body.subject ?? '').trim();
  const messageBody = (body.body ?? '').trim();
  const target = (body.targetRole ?? 'ALL').toUpperCase() as TargetRole;
  if (!subject || !messageBody) {
    return NextResponse.json({ error: 'Subject and body required.' }, { status: 400 });
  }
  if (!ROLES.includes(target)) {
    return NextResponse.json({ error: 'Invalid target role.' }, { status: 400 });
  }

  const recipients = await db.user.findMany({
    where:
      target === 'ALL'
        ? { email: { not: null } }
        : { email: { not: null }, role: target },
    select: { email: true, name: true },
    take: 5000
  });

  if (body.preview) {
    return NextResponse.json({ count: recipients.length, preview: true });
  }

  const escapedBody = messageBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#10182a;">${escapedBody}</div>`;

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    if (!r.email) continue;
    try {
      await sendGenericEmail({ to: r.email, subject, text: messageBody, html });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error('Broadcast send failed', err);
    }
  }

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'admin_broadcast_email',
    entityType: 'Broadcast',
    ipAddress: readClientAddress(request),
    metadata: { subject, targetRole: target, recipientCount: recipients.length, sent, failed }
  });

  return NextResponse.json({ ok: true, sent, failed, total: recipients.length });
}
