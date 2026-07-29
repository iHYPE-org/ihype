import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { sendGenericEmail } from '@/lib/mailer';
import { deferWork } from '@/lib/defer-work';
import { getAdminAlertRecipients } from '@/lib/env';

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
    html: textLines.map((line) => `<p>${line}</p>`).join('\n')
  }), 'beta-access-request-email');

  return NextResponse.json({ ok: true });
}
