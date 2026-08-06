import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendArtistEarningsSummaryEmail } from '@/lib/artist-earnings-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 100;
const CHUNK = 5;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Artist/DJ profiles with pending payouts whose owner hasn't received a summary this month
  const profiles = await db.profile.findMany({
    where: {
      type: 'ARTIST',
      owner: {
        email: { not: null },
        emailBounced: false,
        OR: [
          { earningsSummarySentAt: null },
          { earningsSummarySentAt: { lt: monthStart } },
        ],
      },
      accountsPayableEntries: { some: { status: 'PENDING' } },
    },
    select: {
      id: true,
      hypeCount: true,
      owner: { select: { id: true, email: true, name: true } },
      _count: { select: { mediaUploads: { where: { isPublished: true } } } },
      accountsPayableEntries: {
        where: { status: 'PENDING' },
        select: { amountCents: true },
      },
    },
    take: BATCH,
  }).catch(() => []);

  let sent = 0;
  for (let i = 0; i < profiles.length; i += CHUNK) {
    await Promise.allSettled(profiles.slice(i, i + CHUNK).map(async p => {
      if (!p.owner.email) return;
      const pendingCents = p.accountsPayableEntries.reduce((s, e) => s + e.amountCents, 0);
      if (pendingCents === 0) return;

      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const hypeCount7d = await db.profileHypeEvent.count({
        where: { profileId: p.id, createdAt: { gte: weekAgo } },
      }).catch(() => 0);

      await sendArtistEarningsSummaryEmail({
        id: p.owner.id,
        email: p.owner.email,
        name: p.owner.name,
        pendingCents,
        trackCount: p._count.mediaUploads,
        hypeCount7d,
      });
      await db.user.update({ where: { id: p.owner.id }, data: { earningsSummarySentAt: now } });
      sent++;
    }));
  }

  return NextResponse.json({ ok: true, sent });
}
