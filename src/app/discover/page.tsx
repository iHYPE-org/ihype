import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discover · iHYPE',
  description: 'Trending artists, top fans, and new artists to the scene.'
};

type RankedRow = {
  rank: number;
  count: number;
  profile: {
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string | null;
    stateRegion: string | null;
    genre: string | null;
  };
};

function pathForProfile(type: string, slug: string): string {
  switch (type) {
    case 'ARTIST':
      return `/artists/${slug}`;
    case 'VENUE':
      return `/venues/${slug}`;
    case 'DJ':
      return `/djs/${slug}`;
    default:
      return `/profiles/${slug}`;
  }
}

export default async function DiscoverPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string; genre?: string; city?: string }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const tab = resolved.tab === 'fans' ? 'fans' : resolved.tab === 'new' ? 'new' : 'trending';

  // ── TRENDING TAB ──────────────────────────────────────────────────────────
  let trendingRows: RankedRow[] = [];
  let genrePills: string[] = [];
  let genreFilter: string | null = null;

  if (tab === 'trending') {
    genreFilter = typeof resolved.genre === 'string' ? resolved.genre : null;

    const getTrending = unstable_cache(
      async (genre: string | null) => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const grouped = await db.profileHypeEvent.groupBy({
          by: ['profileId'],
          where: { createdAt: { gte: sevenDaysAgo } },
          _count: { profileId: true },
          orderBy: { _count: { profileId: 'desc' } },
          take: 50
        });
        const profileIds = grouped.map((g) => g.profileId);
        const profiles = profileIds.length
          ? await db.profile.findMany({
              where: {
                id: { in: profileIds },
                ...(genre ? { genre: { contains: genre, mode: 'insensitive' } } : {}),
                ...getDemoOwnerExclusion()
              },
              select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true, genre: true }
            })
          : [];
        const profileMap = new Map(profiles.map((p) => [p.id, p]));
        const rows: RankedRow[] = [];
        grouped.forEach((g, i) => {
          const profile = profileMap.get(g.profileId);
          if (!profile) return;
          rows.push({ rank: i + 1, count: g._count.profileId, profile: { ...profile, type: profile.type as unknown as string } });
        });
        const allGenres = await db.profile.findMany({
          where: { genre: { not: null }, ...getDemoOwnerExclusion() },
          select: { genre: true },
          distinct: ['genre'],
          take: 30
        });
        const pills = allGenres.map((p) => p.genre).filter((g): g is string => Boolean(g)).sort();
        return { rows, pills };
      },
      ['discover-trending', genreFilter ?? ''],
      { revalidate: 300 }
    );

    const { rows, pills } = await getTrending(genreFilter);
    trendingRows = rows;
    genrePills = pills;
  }

  // ── TOP FANS TAB ──────────────────────────────────────────────────────────
  let fanProfiles: Array<{
    id: string;
    slug: string;
    name: string;
    city: string | null;
    stateRegion: string | null;
    hypeCount: number;
    avatarImage: string | null;
  }> = [];
  let cityFilter: string | undefined;

  if (tab === 'fans') {
    cityFilter = resolved.city?.trim() || undefined;
    const getTopFans = unstable_cache(
      async (city: string | undefined) => db.profile.findMany({
        where: { type: 'LISTENER', ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}) },
        select: { id: true, slug: true, name: true, city: true, stateRegion: true, hypeCount: true, avatarImage: true },
        orderBy: { hypeCount: 'desc' },
        take: 20
      }),
      ['discover-fans', cityFilter ?? ''],
      { revalidate: 300 }
    );
    fanProfiles = await getTopFans(cityFilter);
  }

  // ── NEW ARTISTS TAB ───────────────────────────────────────────────────────
  let newArtists: Array<{
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string | null;
    stateRegion: string | null;
    genre: string | null;
    createdAt: Date;
  }> = [];

  if (tab === 'new') {
    const getNewArtists = unstable_cache(
      async () => db.profile.findMany({
        where: { type: { in: ['ARTIST', 'DJ'] }, ...getDemoOwnerExclusion() },
        select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true, genre: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      ['discover-new'],
      { revalidate: 300 }
    );
    newArtists = await getNewArtists();
  }

  return (
    <main className="container section">
      <header style={{ marginBottom: '1.5rem' }}>
        <div className="badge">DISCOVER</div>
        <h1 className="title">Discover</h1>
      </header>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Link href="/discover?tab=trending" className={`button small${tab === 'trending' ? '' : ' secondary'}`}>Trending</Link>
        <Link href="/discover?tab=fans" className={`button small${tab === 'fans' ? '' : ' secondary'}`}>Top Fans</Link>
        <Link href="/discover?tab=new" className={`button small${tab === 'new' ? '' : ' secondary'}`}>New Artists</Link>
      </nav>

      {tab === 'trending' && (
        <>
          <p className="subtitle" style={{ marginBottom: 16 }}>Profiles ranked by hype velocity over the last 7 days.</p>
          {genrePills.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <Link href="/discover?tab=trending" className={`button small${!genreFilter ? '' : ' secondary'}`} style={{ fontSize: 12 }}>All</Link>
              {genrePills.map((g) => (
                <Link key={g} href={`/discover?tab=trending&genre=${encodeURIComponent(g)}`} className={`button small${genreFilter === g ? '' : ' secondary'}`} style={{ fontSize: 12 }}>{g}</Link>
              ))}
            </div>
          )}
          {trendingRows.length === 0 ? (
            <div className="empty">
              <span className="empty-title">No trending profiles yet.</span>
              <p>Hype an artist, venue, or DJ to see them surface here.</p>
            </div>
          ) : (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {trendingRows.map((row) => {
                const location = [row.profile.city, row.profile.stateRegion].filter(Boolean).join(', ');
                return (
                  <li key={row.profile.id} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, color: 'var(--accent)', minWidth: 36, textAlign: 'right' }}>{row.rank}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={pathForProfile(row.profile.type, row.profile.slug)} style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{row.profile.name}</Link>
                      <div className="meta">{row.profile.type}{location ? ` · ${location}` : ''}{row.profile.genre ? ` · ${row.profile.genre}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="meta" style={{ fontSize: 10, letterSpacing: '.14em' }}>HYPE 7D</div>
                      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18 }}>{row.count}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      {tab === 'fans' && (
        <>
          <p className="subtitle" style={{ marginBottom: 16 }}>Top fans by hype activity.</p>
          <form method="GET" style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
            <input type="hidden" name="tab" value="fans" />
            <input className="input" defaultValue={cityFilter} name="city" placeholder="Filter by city…" style={{ maxWidth: 240 }} type="text" />
            <button className="button secondary" type="submit">Filter</button>
            {cityFilter && <Link className="button secondary" href="/discover?tab=fans">Clear</Link>}
          </form>
          {fanProfiles.length === 0 ? (
            <p className="meta">No fans found{cityFilter ? ` in "${cityFilter}"` : ''}.</p>
          ) : (
            <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fanProfiles.map((profile, index) => (
                <li key={profile.id} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px' }}>
                  <span style={{ fontWeight: 700, fontSize: 18, minWidth: 32, textAlign: 'right', opacity: 0.5 }}>{index + 1}</span>
                  {profile.avatarImage && <Image alt={profile.name} src={profile.avatarImage} width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
                  <div style={{ flex: 1 }}>
                    <Link href={`/fans/${profile.slug}`} style={{ fontWeight: 600 }}>{profile.name}</Link>
                    {(profile.city || profile.stateRegion) && <p className="meta" style={{ margin: 0 }}>{[profile.city, profile.stateRegion].filter(Boolean).join(', ')}</p>}
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{profile.hypeCount.toLocaleString()} hype</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {tab === 'new' && (
        <>
          <p className="subtitle" style={{ marginBottom: 16 }}>Freshly joined artists and DJs on iHYPE.</p>
          {newArtists.length === 0 ? (
            <div className="empty"><span className="empty-title">No artists yet.</span></div>
          ) : (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {newArtists.map((artist, i) => {
                const location = [artist.city, artist.stateRegion].filter(Boolean).join(', ');
                return (
                  <li key={artist.id} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, color: 'var(--accent)', minWidth: 36, textAlign: 'right' }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={pathForProfile(artist.type, artist.slug)} style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{artist.name}</Link>
                      <div className="meta">{artist.type}{location ? ` · ${location}` : ''}{artist.genre ? ` · ${artist.genre}` : ''}</div>
                    </div>
                    <div className="meta" style={{ textAlign: 'right', fontSize: 11 }}>{new Date(artist.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </main>
  );
}
