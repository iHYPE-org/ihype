import { NextRequest, NextResponse } from 'next/server';
import { getHealthSnapshot } from '@/lib/health';
import { isEmailDeliveryConfigured, sendGenericEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  return false;
}

async function runCheck() {
  const snapshot = await getHealthSnapshot();
  if (snapshot.status !== 'ok' && isEmailDeliveryConfigured()) {
    try {
      const summary = JSON.stringify(snapshot, null, 2);
      await sendGenericEmail({
        to: 'admin@ihype.org',
        subject: '[iHYPE] Health check failure',
        text: `iHYPE health check returned non-ok status.\n\n${summary}`,
        html: `<p>iHYPE health check returned non-ok status.</p><pre style="font-family:monospace;font-size:12px;background:#0a0805;color:#f0ebe5;padding:12px;border-radius:6px;white-space:pre-wrap;">${summary
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</pre>`
      });
    } catch (err) {
      console.error('[health-check-cron] alert email failed', err);
    }
  }
  return snapshot;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const snapshot = await runCheck();
  return NextResponse.json(snapshot, {
    status: snapshot.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
