import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { sendMarketingEmail } from '@/lib/mailer';
import { readClientAddress } from '@/lib/request-meta';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';
import { log } from '@/lib/logger';

const ROLES = ['FAN', 'ARTIST', 'VENUE', 'ADVERTISER', 'ALL'] as const;
type TargetRole = (typeof ROLES)[number];

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminSession(session) || !session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const reauthed = await requireRecentAdminReauth(session.user.id);
  if (!reauthed) {
    return NextResponse.json({ requiresReauth: true }, { status: 401 });
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
    select: { id: true, email: true, name: true },
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
  let skipped = 0;
  for (const r of recipients) {
    if (!r.email) continue;
    try {
      /* THROUGH `sendMarketingEmail`, NOT `sendGenericEmail` (2026-09-10).
         An announcement to every member is the most marketing thing this
         product sends, and it was the one path that skipped the wrapper
         holding the unsubscribe state — so a member who pressed Unsubscribe
         in their mail client, and was told they would receive no more
         announcements, kept receiving them. It also ignored `emailBounced`,
         so every dead address was retried on every broadcast, which is how
         a sending domain's reputation goes. The wrapper checks both, appends
         the footer and sets the List-Unsubscribe header; it reports
         `skipped` rather than throwing, so an opted-out member is not
         counted as a failure. */
      const result = await sendMarketingEmail(r.id, { to: r.email, subject, text: messageBody, html, deliveryType: 'admin-broadcast' });
      if (result.skipped) { skipped += 1; continue; }
      sent += 1;
    } catch (err) {
      failed += 1;
      log.error('[api/admin/broadcast]', err instanceof Error ? err : { error: String(err) }, 'broadcast send failed');
    }
  }

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'admin_broadcast_email',
    entityType: 'Broadcast',
    ipAddress: readClientAddress(request),
    metadata: { subject, targetRole: target, recipientCount: recipients.length, sent, failed, skipped }
  });

  /* `skipped` is reported, never folded into `sent`: an operator who
     announces to 400 members and reaches 380 should see why. */
  return NextResponse.json({ ok: true, sent, failed, skipped, total: recipients.length });
}
