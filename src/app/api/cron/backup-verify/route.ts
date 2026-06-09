import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ADMIN_EMAIL = 'admin@ihype.org';

export async function GET(request: NextRequest) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [userCount, showCount, profileCount] = await Promise.all([
      db.user.count(),
      db.show.count(),
      db.profile.count(),
    ]);

    const isWarning = userCount === 0 || profileCount === 0;

    const subject = isWarning
      ? `⚠️ iHYPE backup check WARNING — unexpected zero counts`
      : `✓ iHYPE daily backup check — ${userCount} users, ${showCount} shows, ${profileCount} profiles`;

    const text = [
      subject,
      '',
      `Users:    ${userCount}`,
      `Shows:    ${showCount}`,
      `Profiles: ${profileCount}`,
      '',
      isWarning
        ? 'WARNING: One or more counts are zero — verify database backup integrity.'
        : 'All counts look healthy.',
      '',
      `Checked at: ${new Date().toISOString()}`,
    ].join('\n');

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;color:#10182a;">
      <h2 style="margin:0 0 12px;">${isWarning ? '⚠️ Backup Check WARNING' : '✓ Daily Backup Check'}</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:4px 8px;font-weight:bold;">Users</td><td style="padding:4px 8px;">${userCount}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Shows</td><td style="padding:4px 8px;">${showCount}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Profiles</td><td style="padding:4px 8px;">${profileCount}</td></tr>
      </table>
      ${isWarning ? '<p style="color:#c0392b;font-weight:bold;margin-top:16px;">WARNING: One or more counts are zero — verify database backup integrity.</p>' : '<p style="color:#27ae60;margin-top:16px;">All counts look healthy.</p>'}
      <p style="color:#5b657a;font-size:12px;margin-top:16px;">Checked at: ${new Date().toISOString()}</p>
    </div>
  `;

    await sendGenericEmail({ to: ADMIN_EMAIL, subject, text, html }).catch((err) => {
      console.error('[cron/backup-verify] Failed to send email:', err);
    });

    return NextResponse.json({ ok: true, userCount, showCount, profileCount });
  } catch (err) {
    console.error('[cron/backup-verify] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
