import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { releasedMediaWhere } from '@/lib/media-release';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search?q=QUERY&type=artist|venue|song|show|genre|city|playlist&limit=20
 *
 * Unified search across:
 *   - Profiles (artists and venues)
 *   - Shows (live events and radio shows)
 *   - Artist media assets (songs with freeUseEnabled)
 *   - Cities, derived from the profiles that matched
 *   - The signed-in viewer's own playlists
 *
 * Design System 8 makes this endpoint load-bearing in a way it was not before:
 * the MUSIC module carries a PERSISTENT universal field on every one of its
 * five surfaces, "scoped across artists, tracks, venues, cities and playlists
 * at once". Three of those five scopes are new here.
 *
 * `venue` used to be unreachable — VENUE profiles matched, but only under
 * `type=artist`, so a scope chip reading "Venues" had nothing to ask for. It is
 * now its own filter over the same query.
 *
 * `city` is DERIVED, not stored: there is no City table, so a city result is a
 * distinct `Profile.city` among the profiles this query already matched. That
 * makes it exact by construction — a city only appears if somebody is actually
 * on the platform there, which is the only version of a city result that can be
 * usefully opened.
 *
 * `playlist` is scoped to the CALLER'S OWN playlists and needs a session.
 * `FanPlaylist` carries no visibility column — every row is someone's private
 * listening, unlisted-by-id rather than public — so a search that returned
 * other people's would be an enumeration of exactly that. A signed-out caller
 * gets an empty playlist scope rather than a 401: the other four scopes are
 * public and must keep working.
 *
 * Returns { results, genres, counts }.
 */
export async function GET(request: NextRequest) {
  try {
  // 60 searches per minute per IP — allows normal autocomplete usage
  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`search:ip:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many search requests.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const typeFilter = searchParams.get('type') ?? 'all';
  const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 60);

  if (!q) {
    return NextResponse.json({ results: [], genres: [] });
  }

  // `city` reads the same profile rows as `artist`/`venue` — it is derived from
  // them, so asking for cities has to run the profile query. `venue` narrows
  // that query's type filter rather than adding a second one.
  const includeArtists   = typeFilter === 'all' || typeFilter === 'artist';
  const includeVenues    = typeFilter === 'all' || typeFilter === 'venue';
  const includeCities    = typeFilter === 'all' || typeFilter === 'city';
  const includeSongs     = typeFilter === 'all' || typeFilter === 'song';
  const includeShows     = typeFilter === 'all' || typeFilter === 'show';
  // Playlists are the ONE scope `all` does not include, and that is deliberate.
  // They are the caller's own rows, so a response carrying them cannot be
  // CDN-cached (see the Cache-Control note at the bottom) — folding them into
  // the default would make every public search on /search uncacheable to
  // protect data that search was never asking for. The MUSIC field asks for
  // them explicitly instead; every viewer there is signed in, because /app is
  // behind the auth gate.
  const includePlaylists = typeFilter === 'playlist';
  const includeProfiles  = includeArtists || includeVenues || includeCities;
  const profileTypes: Array<'ARTIST' | 'VENUE'> =
    includeArtists || includeCities
      ? includeVenues || includeCities ? ['ARTIST', 'VENUE'] : ['ARTIST']
      : ['VENUE'];

  const [profiles, tracks, shows, playlists] = await Promise.all([
    includeProfiles
      ? db.profile.findMany({
          where: {
            type: { in: profileTypes },
            discoverable: true,
            OR: [
              { name:        { contains: q, mode: 'insensitive' } },
              { headline:    { contains: q, mode: 'insensitive' } },
              { bio:         { contains: q, mode: 'insensitive' } },
              { city:        { contains: q, mode: 'insensitive' } },
              { stateRegion: { contains: q, mode: 'insensitive' } },
              { hometown:    { contains: q, mode: 'insensitive' } },
            ]
          },
          orderBy: [{ hypeCount: 'desc' }],
          take: limit,
          select: {
            id: true, slug: true, type: true,
            name: true, headline: true,
            city: true, stateRegion: true, country: true,
            genres: true, hypeCount: true, avatarImage: true, verified: true
          }
        })
      : Promise.resolve([]),

    includeSongs
      ? db.artistMediaAsset.findMany({
          where: {
            freeUseEnabled: true,
            profile: { discoverable: true },
            AND: [
              releasedMediaWhere(),
              {
                OR: [
                  { title:   { contains: q, mode: 'insensitive' } },
                  { notes:   { contains: q, mode: 'insensitive' } },
                  { profile: { name: { contains: q, mode: 'insensitive' } } },
                  { profile: { genres: { hasSome: [q.toLowerCase()] } } },
                ],
              },
            ],
          },
          orderBy: [{ createdAt: 'desc' }],
          take: limit,
          select: {
            hexId: true, title: true, mimeType: true, notes: true, createdAt: true,
            profile: { select: { name: true, slug: true, genres: true } }
          }
        })
      : Promise.resolve([]),

    includeShows
      ? db.show.findMany({
          where: {
            status: { in: ['SCHEDULED', 'LIVE'] },
            OR: [
              { title:       { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ]
          },
          orderBy: [{ startsAt: 'asc' }],
          take: limit,
          select: {
            id: true, slug: true, title: true, status: true, startsAt: true,
            isRadioShow: true, tags: true, isTicketed: true,
            venueProfile:     { select: { name: true, slug: true, city: true } },
            headlinerProfile: { select: { name: true, slug: true } },
          }
        })
      : Promise.resolve([]),

    // The caller's OWN playlists only — see the route header. `auth()` is
    // called lazily inside the branch so a public search never pays for a
    // session read it does not use, and a failure here degrades this one
    // scope to empty instead of failing the whole search.
    includePlaylists
      ? (async () => {
          try {
            const session = await auth();
            const userId = session?.user?.id;
            if (!userId) return [];
            return await db.fanPlaylist.findMany({
              where: { userId, name: { contains: q, mode: 'insensitive' } },
              orderBy: [{ updatedAt: 'desc' }],
              take: limit,
              select: { id: true, name: true, _count: { select: { items: true } } },
            });
          } catch (err) {
            log.error('[api/search] playlist scope', err instanceof Error ? err : { error: String(err) }, 'error');
            return [];
          }
        })()
      : Promise.resolve([]),
  ]);

  // Also search genres as a distinct concept — any profile whose genres
  // array contains a string matching the query becomes a "genre" result.
  const genreMatches = new Set<string>();
  profiles.forEach(p => {
    p.genres.forEach(g => {
      if (g.toLowerCase().includes(q.toLowerCase())) genreMatches.add(g);
    });
  });

  // Cities are derived from the profiles that matched — one entry per distinct
  // city, counted, so "Portland" reads as a place with N accounts on it rather
  // than as a bare string. Only cities whose NAME matched are offered: a
  // profile can match on bio or headline while sitting in a city the query
  // never mentioned, and listing that city would be a result the query does
  // not explain.
  const cityMatches = new Map<string, { label: string; count: number }>();
  if (includeCities) {
    const needle = q.toLowerCase();
    profiles.forEach(p => {
      if (!p.city || !p.city.toLowerCase().includes(needle)) return;
      const label = [p.city, p.stateRegion].filter(Boolean).join(', ');
      const key = label.toLowerCase();
      const seen = cityMatches.get(key);
      if (seen) seen.count += 1;
      else cityMatches.set(key, { label, count: 1 });
    });
  }

  // Build unified result list
  type ResultItem = {
    type: 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre' | 'city' | 'playlist';
    id: string;
    name: string;
    subtitle: string;
    slug?: string;
    hypeCount?: number;
    status?: string;
    isRadioShow?: boolean;
    genres?: string[];
  };

  const results: ResultItem[] = [];

  profiles.forEach(p => {
    const type = p.type === 'VENUE' ? 'venue' : 'artist';
    // A `city` request runs the profile query for its cities but must not emit
    // the profiles themselves — otherwise picking the "Cities" chip would
    // return a list of artists.
    if (type === 'venue' ? !includeVenues : !includeArtists) return;
    const loc  = [p.city, p.stateRegion].filter(Boolean).join(', ');
    const sub  = [
      p.genres.slice(0, 2).join(' · '),
      loc,
      p.hypeCount ? `${p.hypeCount} HYPE` : null
    ].filter(Boolean).join(' · ');
    results.push({ type, id: p.id, name: p.name, subtitle: sub, slug: p.slug,
                   hypeCount: p.hypeCount ?? 0, genres: p.genres });
  });

  tracks.forEach(t => {
    const sub = `by ${t.profile.name}` + (t.profile.genres.length ? ` · ${t.profile.genres.slice(0,2).join(', ')}` : '');
    results.push({ type: 'song', id: t.hexId, name: t.title, subtitle: sub,
                   slug: t.profile.slug });
  });

  shows.forEach(s => {
    const venueName = s.venueProfile?.name ?? '';
    const date = s.startsAt
      ? new Date(s.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'TBD';
    const sub = [
      s.isRadioShow ? 'Radio show' : (venueName || null),
      date,
      s.isTicketed ? 'Ticketed' : null
    ].filter(Boolean).join(' · ');
    results.push({ type: 'show', id: s.id, name: s.title, subtitle: sub,
                   slug: s.slug, status: s.status, isRadioShow: s.isRadioShow ?? false });
  });

  genreMatches.forEach(g => {
    results.push({ type: 'genre', id: 'genre-' + g, name: g, subtitle: 'Browse by genre' });
  });

  cityMatches.forEach(({ label, count }) => {
    results.push({
      type: 'city',
      id: 'city-' + label.toLowerCase(),
      name: label,
      subtitle: `${count} account${count === 1 ? '' : 's'} here`,
    });
  });

  playlists.forEach(list => {
    const count = list._count.items;
    results.push({
      type: 'playlist',
      id: list.id,
      name: list.name,
      subtitle: `Your playlist · ${count} track${count === 1 ? '' : 's'}`,
      slug: list.id,
    });
  });

  return NextResponse.json({
    results,
    genres: Array.from(genreMatches),
    counts: {
      artists:   includeArtists ? profiles.filter(p => p.type !== 'VENUE').length : 0,
      venues:    includeVenues  ? profiles.filter(p => p.type === 'VENUE').length : 0,
      songs:     tracks.length,
      shows:     shows.length,
      genres:    genreMatches.size,
      cities:    cityMatches.size,
      playlists: playlists.length,
    }
  }, {
    // The playlist scope puts the CALLER'S OWN rows in this body. A shared
    // cache in front of that is a cross-account leak, so any response that
    // could carry them is private and uncacheable — the same rule
    // /api/analytics/summary follows. Everything else stays public and
    // CDN-cacheable, which is what absorbs repeated popular queries.
    headers: {
      'Cache-Control': includePlaylists
        ? 'private, no-store'
        : 'public, s-maxage=60, stale-while-revalidate=300',
    }
  });
  } catch (err) {
    log.error('[api/search]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
