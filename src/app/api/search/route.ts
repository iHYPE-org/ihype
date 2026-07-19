import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search?q=QUERY&type=artist|song|show|genre&limit=20
 *
 * Unified search across:
 *   - Profiles (artists, DJs, venues)
 *   - Shows (live events and radio shows)
 *   - Artist media assets (songs with freeUseEnabled)
 *
 * Returns { results, genres } where genres is the set of unique genre
 * strings found across matched artist profiles.
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

  const includeArtists = typeFilter === 'all' || typeFilter === 'artist';
  const includeSongs   = typeFilter === 'all' || typeFilter === 'song';
  const includeShows   = typeFilter === 'all' || typeFilter === 'show';

  const [profiles, tracks, shows] = await Promise.all([
    includeArtists
      ? db.profile.findMany({
          where: {
            type: { in: ['ARTIST', 'DJ', 'VENUE'] },
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
            OR: [
              { title:   { contains: q, mode: 'insensitive' } },
              { notes:   { contains: q, mode: 'insensitive' } },
              { profile: { name: { contains: q, mode: 'insensitive' } } },
              { profile: { genres: { hasSome: [q.toLowerCase()] } } },
            ]
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
            id: true, title: true, status: true, startsAt: true,
            isRadioShow: true, tags: true, isTicketed: true,
            venueProfile:     { select: { name: true, slug: true, city: true } },
            headlinerProfile: { select: { name: true, slug: true } },
          }
        })
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

  // Build unified result list
  type ResultItem = {
    type: 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre';
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
    const loc  = [p.city, p.stateRegion].filter(Boolean).join(', ');
    const type = p.type === 'VENUE' ? 'venue' : p.type === 'DJ' ? 'promoter' : 'artist';
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
                   status: s.status, isRadioShow: s.isRadioShow ?? false });
  });

  genreMatches.forEach(g => {
    results.push({ type: 'genre', id: 'genre-' + g, name: g, subtitle: 'Browse by genre' });
  });

  return NextResponse.json({
    results,
    genres: Array.from(genreMatches),
    counts: {
      artists:   profiles.filter(p => p.type !== 'VENUE').length,
      venues:    profiles.filter(p => p.type === 'VENUE').length,
      songs:     tracks.length,
      shows:     shows.length,
      genres:    genreMatches.size,
    }
  }, {
    // Results are public; let the CDN absorb repeated popular queries.
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
  });
  } catch (err) {
    console.error('[api/search] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
