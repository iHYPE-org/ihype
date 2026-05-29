import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let enforced = 0;

  // Enforce DMCA on shows past deadline
  const shows = await db.show.findMany({
    where: { dmcaDeadline: { lt: now }, dmcaStatus: 'PENDING' },
    select: {
      id: true,
      title: true,
      headlinerProfile: {
        select: { name: true, owner: { select: { email: true } } },
      },
    },
  });

  for (const show of shows) {
    await db.show.update({
      where: { id: show.id },
      data: { status: 'CANCELED', dmcaStatus: 'ENFORCED' },
    });

    const ownerEmail = show.headlinerProfile?.owner?.email;
    if (ownerEmail) {
      await sendGenericEmail({
        to: ownerEmail,
        subject: `[iHYPE] DMCA notice enforced — ${show.title}`,
        text: `Your show "${show.title}" has been canceled due to a DMCA takedown request that was not resolved before the deadline. Contact support@ihype.org to appeal.`,
        html: `<p>Your show <strong>${show.title}</strong> has been canceled due to an unresolved DMCA notice.</p><p>Contact <a href="mailto:support@ihype.org">support@ihype.org</a> to appeal.</p>`,
      }).catch(() => {});
    }

    enforced++;
  }

  return NextResponse.json({ ok: true, enforced });
}
