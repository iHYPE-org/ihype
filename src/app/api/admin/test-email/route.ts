import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api';
import { sendGenericEmail } from '@/lib/mailer';

export async function GET() {
  try {
    const { session, response } = await requireAdminApi();
    if (response) return response;

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
  } catch (err) {
    console.error('[api/admin/test-email] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
