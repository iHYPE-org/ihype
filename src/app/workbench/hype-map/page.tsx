import { db } from '@/lib/db';
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

export default async function HypeMapPage() {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Aggregate hype events by profile city (artists/DJs only)
  const hypeByCity = await db.profileHypeEvent.groupBy({
    by: ['profileId'],
    _count: { _all: true },
    where: {
      createdAt: { gte: since7d },
      profile: { type: { in: ['ARTIST', 'DJ'] } }
    },
    orderBy: { _count: { profileId: 'desc' } },
    take: 200
  });

  // Fetch city data for the top hyped profiles
  const profileIds = hypeByCity.map((h) => h.profileId);
  const profiles = profileIds.length
    ? await db.profile.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, city: true }
      })
    : [];

  const profileCityMap = new Map(profiles.map((p) => [p.id, p.city?.trim().toLowerCase() ?? '']));

  // Aggregate by city
  const cityHypeTotals = new Map<string, number>();
  for (const row of hypeByCity) {
    const cityRaw = profileCityMap.get(row.profileId) ?? '';
    if (!cityRaw || !CITY_COORDS[cityRaw]) continue;
    cityHypeTotals.set(cityRaw, (cityHypeTotals.get(cityRaw) ?? 0) + row._count._all);
  }

  // Build city list, sorted by hype desc
  const topCities = [...cityHypeTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const maxHype = topCities[0]?.[1] ?? 1;

  const cities: HypeHeatmapCity[] = topCities.map(([cityKey, hype], i) => {
    const coords = CITY_COORDS[cityKey]!;
    // Capitalise display name
    const name = cityKey.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      name,
      x: coords.x,
      y: coords.y,
      hype,
      venuesAsking: 0, // venue booking interest not yet tracked
      hot: i < 3 || hype > maxHype * 0.5
    };
  });

  // Venues with upcoming shows — surface ones with highest upcoming hype
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
    .filter((s) => s.venueProfile)
    .slice(0, 6)
    .map((show, i) => {
      const daysUntil = Math.ceil((show.startsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const signal: 'urgent' | 'warm' | 'new' =
        daysUntil <= 7 ? 'urgent' : daysUntil <= 30 ? 'warm' : 'new';
      return {
        id: show.id,
        name: show.venueProfile!.name,
        city: show.venueProfile!.city ?? '',
        capacity: show.ticketCapacity ?? 0,
        statusLabel: daysUntil <= 1 ? 'tomorrow' : daysUntil <= 7 ? `${daysUntil}d away` : show.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        signal
      };
    });

  // Suggested tour route: top 3 cities by 7-day hype
  const routeCities = topCities.slice(0, 3).map(([cityKey]) =>
    cityKey.slice(0, 3).toUpperCase()
  );
  const suggestedRoute = routeCities.length >= 2 ? routeCities.join(' → ') : undefined;

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
      suggestedRoute={suggestedRoute}
    />
  );
}
