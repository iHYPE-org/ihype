import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  /* CONFIRMED, not PENDING (security sweep, 2026-09-02). PENDING was set by
     the public, unauthenticated `/api/dmca` form, so this job cancelled any
     show a stranger named ten days earlier — and cancelled it without the
     refunds the organizer cancellation route issues. `/api/dmca` now files a
     moderation report instead; this job only acts on a show an admin has
     marked CONFIRMED and given a deadline, which nothing in the app does yet.
     Any rows still PENDING from the old form are deliberately left alone. */
  const shows = await db.show.findMany({
    where: { dmcaDeadline: { lt: now }, dmcaStatus: 'CONFIRMED' },
    select: {
      id: true,
      title: true,
      headlinerProfile: {
        select: { name: true, owner: { select: { email: true } } },
      },
    },
  });

  if (shows.length === 0) {
    return NextResponse.json({ ok: true, enforced: 0 });
  }

  await db.show.updateMany({
    where: { id: { in: shows.map((show) => show.id) } },
    data: { status: 'CANCELED', dmcaStatus: 'ENFORCED' },
  });

  await Promise.all(
    shows.map((show) => {
      const ownerEmail = show.headlinerProfile?.owner?.email;
      if (!ownerEmail) return Promise.resolve();
      return sendGenericEmail({
        to: ownerEmail,
        subject: `[iHYPE] DMCA notice enforced — ${show.title}`,
        text: `Your show "${show.title}" has been canceled due to a DMCA takedown request that was not resolved before the deadline. Contact admin@ihype.org to appeal.`,
        html: `<p>Your show <strong>${escapeHtml(show.title)}</strong> has been canceled due to an unresolved DMCA notice.</p><p>Contact <a href="mailto:admin@ihype.org">admin@ihype.org</a> to appeal.</p>`,
      }).catch(() => {});
    }),
  );

  return NextResponse.json({ ok: true, enforced: shows.length });
}
