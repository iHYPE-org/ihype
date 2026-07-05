import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getShowsDirectoryData } from '@/lib/public-data';
import { sortShowsForFeed } from '@/lib/integrity';
import { detectRequestLocation } from '@/lib/request-location';

export const dynamic = 'force-dynamic';

/**
 * Powers the mobile Events home (EventsHome.tsx): the full upcoming-shows
 * feed plus enough personalization signal (nearest city, hyped genres) for
 * the client to compute the Local/For You slices itself — mirrors exactly
 * what src/app/shows/page.tsx computes server-side for the desktop route.
 */
export async function GET() {
  const [rawShows, viewerLocation, session] = await Promise.all([
    getShowsDirectoryData(),
    detectRequestLocation(),
    auth().catch(() => null),
  ]);

  let userCity: string | null = null;
  let userGenres: string[] = [];
  if (session?.user?.id) {
    const [userProfile, hypedGenres] = await Promise.all([
      db.profile.findFirst({ where: { ownerId: session.user.id }, select: { city: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
      db.profileHypeEvent.findMany({ where: { userId: session.user.id }, select: { profile: { select: { genres: true } } }, take: 50 }).catch(() => []),
    ]);
    userCity = userProfile?.city ?? null;
    userGenres = Array.from(new Set(hypedGenres.flatMap((h) => h.profile.genres)));
  }
  const nearCity = userCity ?? viewerLocation?.city ?? null;

  const now = new Date();
  const shows = sortShowsForFeed(rawShows)
    .map((show) => ({ ...show, startsAt: show.startsAt instanceof Date ? show.startsAt.toISOString() : show.startsAt }))
    .filter((show) => show.status !== 'ENDED' && show.status !== 'CANCELED' && new Date(show.startsAt) >= now);

  return NextResponse.json(
    { shows, nearCity, userGenres, loggedIn: !!session?.user?.id },
    { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } }
  );
}
