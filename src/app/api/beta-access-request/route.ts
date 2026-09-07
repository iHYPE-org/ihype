import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { sendGenericEmail } from '@/lib/mailer';
import { deferWork } from '@/lib/defer-work';
import { getAdminAlertRecipients } from '@/lib/env';
import { escapeHtml } from '@/lib/html-escape';
import { db } from '@/lib/db';
import { normaliseRequestEmail } from '@/lib/access-requests';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().email().max(200),
  note: z.string().trim().max(500).optional(),
  role: z.string().trim().max(40).optional(),
  company: z.string().max(0).optional() // honeypot
});

export async function POST(request: NextRequest) {
  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`beta-access-request:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  // Silently accept the honeypot case without doing any real work, same as
  // the pattern already used for the other public request forms.
  if (body.company) return NextResponse.json({ ok: true });

  await recordAuditEvent({
    action: 'beta_access_request',
    entityType: 'beta_access_request',
    ipAddress: ip,
    metadata: {
      email: body.email,
      role: body.role?.slice(0, 40) ?? null,
      note: body.note?.slice(0, 500) ?? null
    }
  });

  /* The audit row above is the append-only record that somebody asked. This is
     the WORK ITEM an operator can approve or clear at /admin/users?tab=requests
     — until now this route wrote the audit row and an email and nothing else,
     so the whole inbound funnel of a closed alpha lived in one inbox with no
     queue behind it.

     Upsert rather than create: a second ask from the same address is the same
     person waiting, so it refreshes what they told us without resetting
     `createdAt` — the queue is ordered by longest wait, and re-asking must not
     send someone to the back of it. `status` is deliberately NOT in the update:
     role and note are refreshed so an operator revisiting the row reads what
     the person said most recently, but a decision already made is never
     re-opened by the applicant asking again.

     Caught rather than awaited into the response: the member has already been
     accepted, the audit row and the admin email have both landed, and failing
     their request because a queue row could not be written would be the wrong
     trade on the only door into the product. */
  const email = normaliseRequestEmail(body.email);
  if (email) {
    try {
      await db.accessRequest.upsert({
        where: { email },
        create: {
          email,
          role: body.role?.slice(0, 40) ?? null,
          note: body.note?.slice(0, 500) ?? null
        },
        update: {
          role: body.role?.slice(0, 40) ?? null,
          note: body.note?.slice(0, 500) ?? null
        }
      });
    } catch (error) {
      log.error('[beta-access-request]', error instanceof Error ? error : { error: String(error) }, 'could not record the access request queue row');
    }
  }

  const textLines = [
    `Email: ${body.email}`,
    body.role ? `Interested as: ${body.role}` : null,
    body.note ? `Note: ${body.note}` : null,
    '',
    'Logged in the admin audit log as beta_access_request.'
  ].filter((line): line is string => line !== null);

  deferWork(sendGenericEmail({
    to: getAdminAlertRecipients(),
    subject: `Beta access request — ${body.email}`,
    text: textLines.join('\n'),
    html: textLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')
  }), 'beta-access-request-email');

  return NextResponse.json({ ok: true });
}
