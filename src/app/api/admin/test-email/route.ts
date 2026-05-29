import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { sendGenericEmail } from '@/lib/mailer';

export async function GET() {
  const session = await auth();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const to = session.user?.email;
  if (!to) {
    return NextResponse.json({ error: 'No email address on session.' }, { status: 400 });
  }

  const subject = 'iHYPE admin test email';
  const text = [
    'This is a test email sent from the iHYPE admin console.',
    '',
    'If you received this, email delivery is working correctly.',
    '',
    `Sent at: ${new Date().toISOString()}`,
    '— iHYPE'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;color:#10182a;">
      <h2 style="margin:0 0 12px;">iHYPE admin test email</h2>
      <p>This is a test email sent from the iHYPE admin console.</p>
      <p>If you received this, email delivery is working correctly.</p>
      <p style="color:#5b657a;font-size:12px;">Sent at: ${new Date().toISOString()}</p>
    </div>
  `;

  await sendGenericEmail({ to, subject, text, html });

  return NextResponse.json({ sent: true, to });
}
