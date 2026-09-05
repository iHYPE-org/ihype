import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendPushToAllDevices } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Shows that just crossed 80% capacity and haven't been alerted yet
  const shows = await db.show.findMany({
    where: {
      status: { in: ['SCHEDULED', 'LIVE'] },
      isTicketed: true,
      ticketCapacity: { not: null },
      capacityAlertSentAt: null,
      startsAt: { gte: new Date() },
    },
    select: {
      id: true, title: true, slug: true,
      ticketsSoldCount: true, ticketCapacity: true,
      headlinerProfileId: true,
      headlinerProfile: { select: { name: true } },
      venueProfile: { select: { city: true } },
    },
  }).catch(() => []);

  let notified = 0;
  for (const show of shows) {
    if (!show.ticketCapacity || show.ticketCapacity === 0) continue;
    const pct = show.ticketsSoldCount / show.ticketCapacity;
    if (pct < 0.8) continue;

    const showCity = show.venueProfile?.city ?? null;

    // Find fans who hyped the headliner, with optional city targeting
    const fans = show.headlinerProfileId
      ? await db.profileHypeEvent.findMany({
          where: {
            profileId: show.headlinerProfileId,
            ...(showCity ? {
              user: {
                pushSubscriptions: {
                  some: { OR: [{ pushCity: null }, { pushCity: showCity }] }
                }
              }
            } : {})
          },
          select: { userId: true },
          distinct: ['userId'],
          take: 500,
        }).catch(() => [])
      : [];

    const artistName = show.headlinerProfile?.name ?? 'The artist';
    const pctDisplay = Math.round(pct * 100);

    for (const fan of fans) {
      await sendPushToAllDevices(fan.userId, {
        title: `${pctDisplay}% sold — don't miss it`,
        body: `${show.title} by ${artistName} is almost full`,
        url: `/shows/${show.slug}`,
      }).catch(() => {});
    }

    await db.show.update({
      where: { id: show.id },
      data: { capacityAlertSentAt: new Date() },
    });

    notified += fans.length;
  }

  return NextResponse.json({ ok: true, notified, shows: shows.length });
}
