import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { HypeHeatmapVenuePing } from '@/components/HypeHeatmap';

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ pings: [] });

  const profile = await db.profile.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ pings: [] });

  const [confirmedShows, bookingRequests] = await Promise.all([
    db.show.findMany({
      where: {
        headlinerProfileId: profile.id,
        venueProfileId: { not: null },
        status: { in: ['SCHEDULED', 'LIVE'] },
        startsAt: { gte: new Date() },
      },
      select: {
        id: true,
        startsAt: true,
        venueProfile: { select: { name: true, city: true } },
      },
      take: 6,
      orderBy: { startsAt: 'asc' },
    }),
    db.bookingRequest.findMany({
      where: { toProfileId: profile.id, status: 'pending' },
      select: {
        id: true,
        fromUser: {
          select: {
            profiles: {
              where: { type: 'VENUE' },
              select: { name: true, city: true },
              take: 1,
            },
          },
        },
      },
      take: 4,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const pings: HypeHeatmapVenuePing[] = [];

  for (const show of confirmedShows) {
    if (!show.venueProfile) continue;
    pings.push({
      id: show.id,
      name: show.venueProfile.name,
      city: show.venueProfile.city ?? '',
      capacity: 300,
      statusLabel: `CONFIRMED ${fmt.format(show.startsAt)}`,
      signal: 'confirmed',
    });
  }

  for (const req of bookingRequests) {
    const venue = req.fromUser?.profiles?.[0];
    if (!venue) continue;
    pings.push({
      id: req.id,
      name: venue.name,
      city: venue.city ?? '',
      capacity: 200,
      statusLabel: 'Wants to book you',
      signal: 'interest',
    });
  }

  return NextResponse.json({ pings });
}
