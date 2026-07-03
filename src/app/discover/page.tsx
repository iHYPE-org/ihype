import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoCreatorExclusion, getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { FollowButton } from '@/components/FollowButton';
import { CompactHypeButton } from '@/components/CompactHypeButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discover · iHYPE',
  description: 'Find independent artists, venues, and shows near you. Real fan demand — no paid promotion.',
};

const TYPE_COLOR: Record<string, string> = {
  ARTIST: '#ff5029',
  DJ: '#ff3e9a',
  VENUE: '#22e5d4',
  FAN: '#b983ff',
};

const TYPE_LABEL: Record<string, string> = {
  ARTIST: 'Artist',
  DJ: 'Promoter',
  VENUE: 'Venue',
  FAN: 'Fan',
};

export default async function DiscoverPage({ searchParams }: { searchParams?: Promise<{ city?: string; genre?: string; page?: string }> }) {
  const session = await auth().catch(() => null);
  const params = searchParams ? await searchParams : {};
  const cityFilter = params.city?.trim() || null;
  const genreFilter = params.genre?.trim() || null;
  const page = Math.max(0, parseInt(params.page ?? '0', 10) || 0);

  // Collect distinct cities and genres for filter chips
  const [allCities, allGenres] = await Promise.all([
    db.profile.findMany({ where: { type: { in: ['ARTIST', 'DJ', 'VENUE'] }, city: { not: null } }, select: { city: true }, distinct: ['city'], orderBy: { city: 'asc' }, take: 30 }),
    db.profile.findMany({ where: { type: { in: ['ARTIST', 'DJ'] }, genres: { isEmpty: false } }, select: { genres: true }, take: 200 }),
  ]);
  const cities = allCities.map(p => p.city).filter(Boolean) as string[];
  const genres = [...new Set(allGenres.flatMap(p => p.genres))].sort().slice(0, 20);

  const [topArtists, topVenues, upcomingShows] = await Promise.all([
    db.profile.findMany({
      where: {
        type: { in: ['ARTIST', 'DJ'] },
        ...getDemoOwnerExclusion(),
        ...(cityFilter ? { city: { contains: cityFilter, mode: 'insensitive' as const } } : {}),
        ...(genreFilter ? { genres: { has: genreFilter } } : {}),
      },
      orderBy: { hypeCount: 'desc' },
      skip: page * 12,
      take: 12,
      select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true, hypeCount: true, avatarImage: true },
    }),
    db.profile.findMany({
      where: {
        type: 'VENUE',
        ...getDemoOwnerExclusion(),
        ...(cityFilter ? { city: { contains: cityFilter, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { hypeCount: 'desc' },
      take: 6,
      select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true, hypeCount: true },
    }),
    db.show.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] }, startsAt: { gte: new Date() }, ...getDemoCreatorExclusion(),
        ...(cityFilter ? { venueProfile: { city: { contains: cityFilter, mode: 'insensitive' as const } } } : {}),
      },
      orderBy: { startsAt: 'asc' },
      take: 8,
      select: {
        id: true, slug: true, title: true, status: true, startsAt: true, isTicketed: true,
        ticketPriceCents: true, hypeCount: true,
        headlinerProfile: { select: { name: true, slug: true } },
        venueProfile: { select: { name: true, city: true } },
      },
    }),
  ]);

  const profileRoute = (type: string, slug: string) =>
    type === 'VENUE' ? `/venues/${slug}` : `/artists/${slug}`;

  const buildUrl = (city: string | null, genre: string | null) => {
    const p = new URLSearchParams();
    if (city) p.set('city', city);
    if (genre) p.set('genre', genre);
    const q = p.toString();
    return `/discover${q ? `?${q}` : ''}`;
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 100px' }}>

      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          DISCOVER
        </p>
        <h1 className="ihype-hero-heading" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 8px' }}>
          Find your next favourite artist
        </h1>
        <p style={{ color: 'rgba(240,235,229,.55)', fontSize: 14, margin: 0 }}>
          Ranked by real fan hypes — no paid promotion.
        </p>
      </div>

      {/* For You entry point */}
      <Link href="/for-you" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderRadius: 16, background: 'rgba(255,80,41,.08)', border: '1px solid rgba(255,80,41,.3)' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>FOR YOU</span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-.02em', color: '#f0ebe5', marginTop: 2 }}>Artists picked for your taste →</div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(240,235,229,.5)', flexShrink: 0 }}>See why</span>
        </div>
      </Link>

      {/* This Weekend entry point */}
      <Link href="/this-weekend" style={{ textDecoration: 'none', display: 'block', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderRadius: 16, background: 'rgba(34,229,212,.08)', border: '1px solid rgba(34,229,212,.3)' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#22e5d4' }}>THIS WEEKEND</span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-.02em', color: '#f0ebe5', marginTop: 2 }}>Shows near you →</div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(240,235,229,.5)', flexShrink: 0 }}>Get tickets</span>
        </div>
      </Link>

      {/* Filters */}
      {(cities.length > 0 || genres.length > 0) && (
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cities.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.3)', flexShrink: 0 }}>City</span>
              {cityFilter && (
                <Link href={buildUrl(null, genreFilter)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                    {cityFilter} ×
                  </span>
                </Link>
              )}
              {cities.filter(c => c !== cityFilter).map(c => (
                <Link key={c} href={buildUrl(c, genreFilter)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.06)', color: 'rgba(240,235,229,.6)', cursor: 'pointer', border: '1px solid rgba(255,255,255,.08)' }}>
                    {c}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {genres.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.3)', flexShrink: 0 }}>Genre</span>
              {genreFilter && (
                <Link href={buildUrl(cityFilter, null)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: '#ff3e9a', color: '#fff', cursor: 'pointer' }}>
                    {genreFilter} ×
                  </span>
                </Link>
              )}
              {genres.filter(g => g !== genreFilter).map(g => (
                <Link key={g} href={buildUrl(cityFilter, g)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.06)', color: 'rgba(240,235,229,.6)', cursor: 'pointer', border: '1px solid rgba(255,255,255,.08)' }}>
                    {g}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming shows */}
      {upcomingShows.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: 0 }}>Upcoming shows</h2>
            <Link href="/shows" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
              VIEW ALL →
            </Link>
          </div>
          <div className="ihype-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {upcomingShows.map(s => {
              const isLive = s.status === 'LIVE';
              const date = new Date(s.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              return (
                <Link key={s.id} href={`/shows/${s.slug}`} style={{ textDecoration: 'none' }}>
                  <div className="ihype-card" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      {isLive ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                          Live now
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'rgba(240,235,229,.4)', fontFamily: 'var(--font-mono)' }}>{date}</span>
                      )}
                      {s.isTicketed && (
                        <span style={{ fontSize: 11, color: '#22e5d4', fontFamily: 'var(--font-mono)' }}>
                          {s.ticketPriceCents ? `$${(s.ticketPriceCents / 100).toFixed(0)}` : 'Free'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, marginBottom: 4, color: 'var(--ink)' }}>{s.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'rgba(240,235,229,.45)' }}>
                        {s.headlinerProfile?.name ?? 'iHYPE Radio'}
                        {s.venueProfile?.city ? ` · ${s.venueProfile.city}` : ''}
                      </div>
                      <div onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                        <CompactHypeButton targetType="show" targetId={s.id} initialCount={s.hypeCount} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Top artists */}
      {topArtists.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: '0 0 16px' }}>
            Trending artists &amp; DJs
          </h2>
          <div className="ihype-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {topArtists.map(p => (
              <div key={p.id} className="ihype-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href={profileRoute(p.type, p.slug)} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 22, position: 'relative',
                    background: `linear-gradient(135deg, ${TYPE_COLOR[p.type] ?? '#ff5029'}, #b983ff)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0, overflow: 'hidden',
                  }}>
                    {p.avatarImage
                      ? <Image src={p.avatarImage} alt={p.name} fill sizes="44px" style={{ objectFit: 'cover', borderRadius: 22 }} />
                      : (p.type === 'VENUE' ? '🏛️' : '🎤')}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, marginBottom: 2, color: 'var(--ink)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: TYPE_COLOR[p.type] ?? '#ff5029', fontFamily: 'var(--font-mono)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {TYPE_LABEL[p.type] ?? p.type}
                    </div>
                    {p.city && (
                      <div style={{ fontSize: 11, color: 'rgba(240,235,229,.4)', marginTop: 2 }}>{p.city}</div>
                    )}
                  </div>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <CompactHypeButton targetType="profile" targetId={p.id} initialCount={p.hypeCount} />
                  {session?.user && <FollowButton profileId={p.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {topArtists.length === 12 && (
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link
            href={buildUrl(cityFilter, genreFilter) + (buildUrl(cityFilter, genreFilter).includes('?') ? `&page=${page + 1}` : `?page=${page + 1}`)}
            style={{ display: 'inline-block', padding: '10px 24px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-mono)', color: 'rgba(240,235,229,.7)', textDecoration: 'none', letterSpacing: '.04em' }}
          >
            Load more artists →
          </Link>
        </div>
      )}

      {/* Top venues */}
      {topVenues.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: '0 0 16px' }}>
            Venues
          </h2>
          <div className="ihype-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {topVenues.map(p => (
              <Link key={p.id} href={`/venues/${p.slug}`} style={{ textDecoration: 'none' }}>
                <div className="ihype-card" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#22e5d4' }}>🏛️ {p.name}</div>
                    <div onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                      <CompactHypeButton targetType="profile" targetId={p.id} initialCount={p.hypeCount} />
                    </div>
                  </div>
                  {p.city && (
                    <div style={{ fontSize: 12, color: 'rgba(240,235,229,.45)' }}>{p.city}{p.stateRegion ? `, ${p.stateRegion}` : ''}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {topArtists.length === 0 && upcomingShows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(240,235,229,.3)' }}>
          <div className="icon" style={{ marginBottom: 16 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 56, height: 56, color: '#ff5029', opacity: 0.7 }}><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10a7 7 0 0 1-14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg></div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginBottom: 8, color: 'var(--ink)' }}>
            No artists yet
          </p>
          <p style={{ fontSize: 14 }}>Be the first to join the beta and claim your page.</p>
          <Link href="/register" style={{ display: 'inline-block', marginTop: 20, padding: '12px 24px', background: 'var(--accent)', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            Join iHYPE →
          </Link>
        </div>
      )}
    </div>
  );
}
