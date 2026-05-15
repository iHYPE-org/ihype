import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ cities: [] });

  // Find the artist profile owned by the current user
  const artistProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: 'ARTIST' },
    select: { id: true },
  });

  if (!artistProfile) return NextResponse.json({ cities: [] });

  // Get all users who hyped this profile
  const hypeEvents = await db.profileHypeEvent.findMany({
    where: { profileId: artistProfile.id },
    select: { userId: true },
  });

  if (hypeEvents.length === 0) return NextResponse.json({ cities: [] });

  const userIds = hypeEvents.map(h => h.userId);

  // Get the city/stateRegion from those users' profiles
  const fanProfiles = await db.profile.findMany({
    where: {
      ownerId: { in: userIds },
      city: { not: null },
    },
    select: {
      city: true,
      stateRegion: true,
    },
  });

  // Aggregate by city
  const cityMap = new Map<string, { city: string; stateRegion: string | null; hype: number }>();
  for (const fp of fanProfiles) {
    if (!fp.city) continue;
    const key = fp.city.toLowerCase();
    const existing = cityMap.get(key);
    if (existing) {
      existing.hype += 1;
    } else {
      cityMap.set(key, { city: fp.city, stateRegion: fp.stateRegion, hype: 1 });
    }
  }

  const cities = Array.from(cityMap.values())
    .sort((a, b) => b.hype - a.hype)
    .slice(0, 20);

  return NextResponse.json({ cities });
}
