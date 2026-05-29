import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/push-notify';

export const dynamic = 'force-dynamic';

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const RADIUS_KM = 80; // ~50 miles

  // New shows from the last 24h with a venue that has lat/lng
  const shows = await db.show.findMany({
    where: {
      createdAt: { gte: since },
      venueProfile: { latitude: { not: null }, longitude: { not: null } },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      venueProfile: { select: { name: true, latitude: true, longitude: true } },
    },
  });

  if (shows.length === 0) {
    return NextResponse.json({ ok: true, notified: 0, shows: 0 });
  }

  // Users with location set
  const users = await db.profile.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { ownerId: true, latitude: true, longitude: true },
  });

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let totalNotified = 0;

  for (const show of shows) {
    const vLat = show.venueProfile?.latitude;
    const vLon = show.venueProfile?.longitude;
    if (!vLat || !vLon) continue;

    const venueName = show.venueProfile?.name ?? 'Unknown venue';
    const dateStr = new Date(show.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    for (const user of users) {
      if (!user.latitude || !user.longitude) continue;
      const dist = haversineKm(user.latitude, user.longitude, vLat, vLon);
      if (dist > RADIUS_KM) continue;

      // Rate limit: skip if already notified in last 24h
      const recent = await db.notification.findFirst({
        where: {
          userId: user.ownerId,
          type: 'NEARBY_SHOW',
          createdAt: { gte: oneDayAgo },
        },
      });
      if (recent) continue;

      await sendPushNotification(user.ownerId, {
        title: 'New show near you',
        body: `${show.title} @ ${venueName} on ${dateStr}`,
        url: `/shows/${show.slug}`,
      });

      await db.notification.create({
        data: {
          userId: user.ownerId,
          type: 'NEARBY_SHOW',
          body: `New show near you: ${show.title} @ ${venueName} on ${dateStr}`,
          link: `/shows/${show.slug}`,
        },
      });

      totalNotified++;
    }
  }

  return NextResponse.json({ ok: true, notified: totalNotified, shows: shows.length });
}
