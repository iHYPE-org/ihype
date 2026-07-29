import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { getAdminAlertRecipients } from '@/lib/env';
import { kvDel, kvGet, kvIncr, kvPut } from '@/lib/kv';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FAIL_TTL = 24 * 60 * 60;
const ALERT_THRESHOLD = 3;

export async function POST(request: NextRequest) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as { path?: string; status?: number; ok?: boolean } | null;
    const path = typeof body?.path === 'string' ? body.path : '';
    if (!path) {
      return NextResponse.json({ error: 'Missing path.' }, { status: 400 });
    }

    const failKey = `cron-fail:${path}`;
    const alertedKey = `cron-fail-alerted:${path}`;

    if (body?.ok) {
      await kvDel(failKey);
      await kvDel(alertedKey);
      return NextResponse.json({ ok: true, cleared: true });
    }

    const streak = await kvIncr(failKey, FAIL_TTL);
    if (streak >= ALERT_THRESHOLD) {
      const alreadyAlerted = await kvGet<number>(alertedKey);
      if (!alreadyAlerted) {
        const status = typeof body?.status === 'number' ? body.status : 'unknown';
        const { sendGenericEmail } = await import('@/lib/mailer');
        await sendGenericEmail({
          to: getAdminAlertRecipients(),
          subject: `[iHYPE] Cron job failing: ${path}`,
          text: `The cron job ${path} has failed ${streak} consecutive times (latest status: ${status}).\n\nCheck the worker logs and the route handler. This alert will not repeat for 24h or until the job succeeds.`,
          html: `<p>The cron job <strong>${path}</strong> has failed <strong>${streak}</strong> consecutive times (latest status: ${status}).</p><p>Check the worker logs and the route handler. This alert will not repeat for 24h or until the job succeeds.</p>`
        }).catch((err) => {
          log.error('[cron/report-failure]', err instanceof Error ? err : { error: String(err) }, 'alert email failed');
        });
        await kvPut(alertedKey, Date.now(), { ex: FAIL_TTL });
      }
    }

    return NextResponse.json({ ok: true, streak });
  } catch (err) {
    log.error('[cron/report-failure]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
