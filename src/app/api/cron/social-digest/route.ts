import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { ADMIN_EMAIL } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const topShows = await db.show.findMany({
    where: { startsAt: { gte: since }, status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] } },
    orderBy: { hypeCount: 'desc' },
    take: 3,
    select: { id: true, title: true, hypeCount: true, startsAt: true, headlinerProfile: { select: { name: true } } },
  });

  if (topShows.length === 0) {
    return NextResponse.json({ ok: true, message: 'No shows this week' });
  }

  const lines = topShows.map((s, i) => {
    const artist = s.headlinerProfile?.name ?? 'Unknown artist';
    return `${i + 1}. ${s.title} by ${artist} — ${s.hypeCount} hypes 🔥`;
  });
  const text = `This week on iHYPE:\n\n${lines.join('\n')}\n\nDiscover more at ihype.org`;

  const post = await db.socialPost.create({
    data: { text, platform: 'digest' },
  });

  await sendGenericEmail({
    to: ADMIN_EMAIL,
    subject: '[iHYPE] Weekly Social Digest — top shows',
    text,
    html: `<h2>Weekly Social Digest</h2><ol>${topShows.map((s) => `<li><strong>${s.title}</strong> — ${s.hypeCount} hypes</li>`).join('')}</ol><p>Copy ready to post.</p>`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, postId: post.id });
}
