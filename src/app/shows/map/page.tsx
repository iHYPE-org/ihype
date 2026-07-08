import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import type { Show } from '@prisma/client';

type ShowWithVenue = Show & {
  venueProfile: {
    name: string;
    slug: string;
    city: string | null;
    stateRegion: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export const metadata: Metadata = {
  title: 'Shows Near Me · Map View · iHYPE',
  description: 'Browse upcoming shows grouped by city on iHYPE.'
};

export const dynamic = 'force-dynamic';

export default async function ShowsMapPage() {
  const shows = await db.show.findMany({
    where: {
      status: { in: ['SCHEDULED', 'LIVE'] },
      startsAt: { gte: new Date() }
    },
    include: {
      venueProfile: { select: { name: true, slug: true, city: true, stateRegion: true, latitude: true, longitude: true } }
    },
    orderBy: { startsAt: 'asc' },
    take: 200
  }) as ShowWithVenue[];

  // Group by city
  const cityMap = new Map<string, ShowWithVenue[]>();
  for (const show of shows) {
    const city = show.venueProfile?.city ?? 'Unknown city';
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(show);
  }

  const cities = Array.from(cityMap.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="container section" style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, margin: 0 }}>Shows near me</h1>
        <Link href="/shows" className="button secondary" style={{ fontSize: 12, padding: '6px 14px' }}>
          List view
        </Link>
      </div>

      <p className="meta" style={{ marginBottom: 32 }}>
        {shows.length} upcoming show{shows.length !== 1 ? 's' : ''} across {cities.length} cit{cities.length !== 1 ? 'ies' : 'y'}.
      </p>

      {cities.length === 0 ? (
        <p className="meta">No upcoming shows found.</p>
      ) : (
        <div style={{ display: 'grid', gap: 40 }}>
          {cities.map(([city, cityShows]) => {
            const venueWithCoords = cityShows.find((s) => s.venueProfile?.latitude && s.venueProfile?.longitude)?.venueProfile;
            const mapsUrl = venueWithCoords
              ? `https://www.google.com/maps/search/?api=1&query=${venueWithCoords.latitude},${venueWithCoords.longitude}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city + ' music venue')}`;

            return (
              <section key={city}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 20, margin: 0, color: 'var(--ink)' }}>
                    {city}
                  </h2>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--accent)', textDecoration: 'none', padding: '2px 8px', border: '1px solid rgba(255,80,41,.3)', borderRadius: 4 }}
                  >
                    View on map ↗
                  </a>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {cityShows.slice(0, 8).map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                      <div style={{ minWidth: 52, fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--accent)', textAlign: 'center' }}>
                        {s.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Link href={`/shows/${s.slug}`} style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}>
                          {s.title}
                        </Link>
                        {s.venueProfile?.name ? (
                          <p style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', margin: '2px 0 0' }}>
                            @ <Link href={`/venues/${s.venueProfile.slug}`} style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>{s.venueProfile.name}</Link>
                          </p>
                        ) : null}
                      </div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>
                        {s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                    </div>
                  ))}
                  {cityShows.length > 8 && (
                    <Link href={`/shows?city=${encodeURIComponent(city)}`} className="text-link" style={{ fontSize: 12, padding: '4px 0' }}>
                      +{cityShows.length - 8} more in {city}
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
