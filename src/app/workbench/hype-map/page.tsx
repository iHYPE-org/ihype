import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { HypeHeatmap, type HypeHeatmapCity, type HypeHeatmapVenuePing } from '@/components/HypeHeatmap';

export const dynamic = 'force-dynamic';

// Normalized US coordinates [x 0–1 left→right, y 0–1 top→bottom]
const CITY_COORDS: Record<string, { x: number; y: number }> = {
  'chicago':       { x: .55, y: .42 },
  'brooklyn':      { x: .81, y: .42 },
  'new york':      { x: .81, y: .42 },
  'new york city': { x: .81, y: .42 },
  'nyc':           { x: .81, y: .42 },
  'austin':        { x: .45, y: .74 },
  'los angeles':   { x: .13, y: .56 },
  'la':            { x: .13, y: .56 },
  'seattle':       { x: .10, y: .28 },
  'nashville':     { x: .62, y: .58 },
  'denver':        { x: .32, y: .44 },
  'atlanta':       { x: .66, y: .64 },
  'miami':         { x: .72, y: .84 },
  'houston':       { x: .46, y: .80 },
  'dallas':        { x: .47, y: .74 },
  'portland':      { x: .10, y: .30 },
  'phoenix':       { x: .25, y: .66 },
  'minneapolis':   { x: .50, y: .34 },
  'detroit':       { x: .64, y: .38 },
  'philadelphia':  { x: .79, y: .44 },
  'boston':        { x: .84, y: .38 },
  'san francisco': { x: .08, y: .50 },
  'sf':            { x: .08, y: .50 },
  'new orleans':   { x: .57, y: .78 },
  'kansas city':   { x: .51, y: .53 },
  'cleveland':     { x: .68, y: .40 },
  'pittsburgh':    { x: .72, y: .42 },
  'charlotte':     { x: .70, y: .58 },
  'raleigh':       { x: .74, y: .56 },
  'richmond':      { x: .76, y: .50 },
  'dc':            { x: .77, y: .48 },
  'washington':    { x: .77, y: .48 },
  'baltimore':     { x: .78, y: .47 },
  'columbus':      { x: .67, y: .44 },
  'indianapolis':  { x: .62, y: .46 },
  'memphis':       { x: .59, y: .63 },
  'louisville':    { x: .64, y: .50 },
  'omaha':         { x: .46, y: .46 },
  'salt lake city':{ x: .24, y: .46 },
  'las vegas':     { x: .20, y: .60 },
  'san diego':     { x: .16, y: .64 },
  'sacramento':    { x: .10, y: .48 },
  'albuquerque':   { x: .32, y: .62 },
  'oklahoma city': { x: .49, y: .63 },
  'tucson':        { x: .26, y: .70 },
};

function nearestNeighborRoute(cities: Array<{ name: string; x: number; y: number }>): string[] {
  if (cities.length <= 1) return cities.map(c => c.name);
  const unvisited = [...cities];
  const route = [unvisited.splice(0, 1)[0]];
  while (unvisited.length > 0) {
    const last = route[route.length - 1];
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const dx = unvisited[i].x - last.x;
      const dy = unvisited[i].y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) { minDist = dist; nearest = i; }
    }
    route.push(unvisited.splice(nearest, 1)[0]);
  }
  return route.map(c => c.name);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));
  let intersection = 0;
  for (const g of setA) { if (setB.has(g)) intersection++; }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export default async function HypeMapPage() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  // --- Auth + artist profile ---
  const session = await auth();
  let artistGenres: string[] = [];
  let viewerOwnerId: string | undefined;

  if (session?.user?.id) {
    viewerOwnerId = session.user.id;
    const artistProfile = await db.profile.findFirst({
      where: { ownerId: session.user.id, type: { in: ['ARTIST', 'DJ'] } },
      select: { genres: true }
    });
    if (artistProfile) artistGenres = artistProfile.genres ?? [];
  }

  // --- Two-window hype aggregation ---
  const [recentHypes, prevHypes] = await Promise.all([
    db.profileHypeEvent.groupBy({
      by: ['profileId'],
      _count: { _all: true },
      where: { createdAt: { gte: since30d }, profile: { type: { in: ['ARTIST', 'DJ'] } } },
      orderBy: { _count: { profileId: 'desc' } },
      take: 300
    }),
    db.profileHypeEvent.groupBy({
      by: ['profileId'],
      _count: { _all: true },
      where: { createdAt: { gte: since60d, lt: since30d }, profile: { type: { in: ['ARTIST', 'DJ'] } } },
      orderBy: { _count: { profileId: 'desc' } },
      take: 300
    })
  ]);

  // Fetch city data for all hyped profiles
  const allProfileIds = [
    ...new Set([
      ...recentHypes.map(h => h.profileId),
      ...prevHypes.map(h => h.profileId)
    ])
  ];

  const profiles = allProfileIds.length
    ? await db.profile.findMany({
        where: { id: { in: allProfileIds } },
        select: { id: true, city: true }
      })
    : [];

  const profileCityMap = new Map(profiles.map(p => [p.id, p.city?.trim().toLowerCase() ?? '']));

  // Build per-city velocity maps (30d and prev30d)
  const cityVelocity30d = new Map<string, number>();
  const cityVelocityPrev = new Map<string, number>();

  // Track which profileIds belong to each city (for genre fetching)
  const cityProfileIds = new Map<string, string[]>();

  for (const row of recentHypes) {
    const cityRaw = profileCityMap.get(row.profileId) ?? '';
    if (!cityRaw || !CITY_COORDS[cityRaw]) continue;
    cityVelocity30d.set(cityRaw, (cityVelocity30d.get(cityRaw) ?? 0) + row._count._all);
    if (!cityProfileIds.has(cityRaw)) cityProfileIds.set(cityRaw, []);
    cityProfileIds.get(cityRaw)!.push(row.profileId);
  }

  for (const row of prevHypes) {
    const cityRaw = profileCityMap.get(row.profileId) ?? '';
    if (!cityRaw || !CITY_COORDS[cityRaw]) continue;
    cityVelocityPrev.set(cityRaw, (cityVelocityPrev.get(cityRaw) ?? 0) + row._count._all);
  }

  // Sort cities by 30d velocity
  const sortedCities = [...cityVelocity30d.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const maxVelocity = sortedCities[0]?.[1] ?? 1;

  // --- Genre affinity: fetch genres for top artists per city ---
  const topProfileIds = [...cityProfileIds.values()]
    .map(ids => ids.slice(0, 20))
    .flat()
    .slice(0, 100);

  const profileGenreData = topProfileIds.length
    ? await db.profile.findMany({
        where: { id: { in: topProfileIds } },
        select: { id: true, city: true, genres: true }
      })
    : [];

  // Build per-city genre union
  const cityGenreUnion = new Map<string, string[]>();
  for (const p of profileGenreData) {
    const cityRaw = p.city?.trim().toLowerCase() ?? '';
    if (!cityRaw) continue;
    const existing = cityGenreUnion.get(cityRaw) ?? [];
    cityGenreUnion.set(cityRaw, [...existing, ...(p.genres ?? [])]);
  }

  // --- Comparable artists: find cities where similar-genre artists have played ---
  const comparableCities = new Set<string>();
  if (artistGenres.length > 0 && viewerOwnerId) {
    const comparableArtists = await db.profile.findMany({
      where: {
        type: { in: ['ARTIST', 'DJ'] },
        genres: { hasSome: artistGenres.slice(0, 3) },
        ownerId: { not: viewerOwnerId },
        headlinerShows: { some: {} }
      },
      select: {
        headlinerShows: {
          select: { venueProfile: { select: { city: true } } },
          take: 5,
          orderBy: { startsAt: 'desc' }
        }
      },
      take: 20
    });

    for (const artist of comparableArtists) {
      for (const show of artist.headlinerShows) {
        const city = show.venueProfile?.city?.toLowerCase().trim();
        if (city) comparableCities.add(city);
      }
    }
  }

  // --- Build cities list ---
  const cities: HypeHeatmapCity[] = sortedCities.map(([cityKey, velocity], i) => {
    const coords = CITY_COORDS[cityKey]!;
    const name = cityKey.replace(/\b\w/g, c => c.toUpperCase());
    const prevVelocity = cityVelocityPrev.get(cityKey) ?? 0;

    let velocityTrend: 'up' | 'down' | 'stable' = 'stable';
    if (velocity > prevVelocity * 1.2) velocityTrend = 'up';
    else if (velocity < prevVelocity * 0.8) velocityTrend = 'down';

    const cityGenres = cityGenreUnion.get(cityKey) ?? [];
    const genreAffinityScore = artistGenres.length > 0
      ? jaccardSimilarity(artistGenres, cityGenres)
      : 0.5;

    const hot = i < 3 || velocity > maxVelocity * 0.5 || comparableCities.has(cityKey);
    const collabSignal = comparableCities.has(cityKey) ? 0.7 : null;

    return {
      name,
      x: coords.x,
      y: coords.y,
      hype: velocity,
      venuesAsking: 0,
      hot,
      velocity,
      velocityTrend,
      genreAffinityScore,
      signalBreakdown: {
        taste: artistGenres.length > 0 ? genreAffinityScore : null,
        geo: null,
        momentum: velocity / maxVelocity,
        collab: collabSignal
      }
    };
  });

  // Boost hot status for comparable artist cities
  for (const city of cities) {
    if (comparableCities.has(city.name.toLowerCase()) && (city.velocity ?? 0) > 0) {
      city.hot = true;
    }
  }

  // --- Route optimizer: top 8 cities by velocity ---
  const routeCitiesInput = cities.slice(0, 8).map(c => ({ name: c.name, x: c.x, y: c.y }));
  const routeOrder = routeCitiesInput.length >= 2 ? nearestNeighborRoute(routeCitiesInput) : undefined;

  // --- Venue pings ---
  const upcomingShows = await db.show.findMany({
    where: {
      status: 'SCHEDULED',
      startsAt: { gte: new Date() }
    },
    select: {
      id: true,
      title: true,
      hypeCount: true,
      startsAt: true,
      ticketCapacity: true,
      venueProfile: { select: { name: true, city: true } }
    },
    orderBy: { hypeCount: 'desc' },
    take: 8
  });

  const venuePings: HypeHeatmapVenuePing[] = upcomingShows
    .filter(s => s.venueProfile)
    .slice(0, 6)
    .map(show => {
      const daysUntil = Math.ceil((show.startsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const signal: 'urgent' | 'warm' | 'new' =
        daysUntil <= 7 ? 'urgent' : daysUntil <= 30 ? 'warm' : 'new';
      return {
        id: show.id,
        name: show.venueProfile!.name,
        city: show.venueProfile!.city ?? '',
        capacity: show.ticketCapacity ?? 0,
        statusLabel: daysUntil <= 1
          ? 'tomorrow'
          : daysUntil <= 7
            ? `${daysUntil}d away`
            : show.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        signal
      };
    });

  // Fall back to placeholder if no real data yet
  if (cities.length === 0) {
    cities.push(
      { name: 'Chicago',   x: .55, y: .42, hype: 0, venuesAsking: 0 },
      { name: 'New York',  x: .81, y: .42, hype: 0, venuesAsking: 0 },
      { name: 'Austin',    x: .45, y: .74, hype: 0, venuesAsking: 0 },
    );
  }

  return (
    <HypeHeatmap
      cities={cities}
      venuePings={venuePings}
      suggestedRoute={undefined}
      routeOrder={routeOrder}
      artistGenres={artistGenres}
    />
  );
}
