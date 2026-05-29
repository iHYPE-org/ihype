import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { triageSupportRequest } from '@/lib/support-triage';
import { sendGenericEmail } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  const session = await auth();

  let body: { message?: string; category?: string; url?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  const category = body.category ?? 'other';

  const request_ = await db.supportRequest.create({
    data: {
      requesterUserId: session?.user?.id ?? null,
      type: category === 'bug' ? 'BUG_REPORT' : category === 'suggestion' ? 'SUGGESTION' : 'FEEDBACK',
      email: session?.user?.email ?? null,
      subject: `[${category}] In-app feedback`,
      details: `${message}\n\nURL: ${body.url ?? 'unknown'}`,
      priority: category === 'bug' ? 'HIGH' : 'NORMAL',
    },
  });

  // Triage and auto-reply
  const triage = triageSupportRequest(request_.subject, request_.details);
  if (triage.category !== 'OTHER') {
    await db.supportRequest.update({
      where: { id: request_.id },
      data: { type: triage.category },
    }).catch(() => {});
  }

  if (triage.autoReply && (session?.user?.email || request_.email)) {
    const to = session?.user?.email ?? request_.email ?? '';
    if (to) {
      await sendGenericEmail({
        to,
        subject: 'Re: Your iHYPE support request',
        text: triage.autoReply,
        html: `<p>${triage.autoReply}</p>`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ submitted: true });
}
