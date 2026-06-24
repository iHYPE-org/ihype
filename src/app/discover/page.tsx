import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoCreatorExclusion, getDemoOwnerExclusion } from '@/lib/runtime-flags';

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

export default async function DiscoverPage() {
  const session = await auth().catch(() => null);

  const [topArtists, topVenues, upcomingShows] = await Promise.all([
    db.profile.findMany({
      where: { type: { in: ['ARTIST', 'DJ'] }, ...getDemoOwnerExclusion() },
      orderBy: { hypeCount: 'desc' },
      take: 12,
      select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true, hypeCount: true, avatarImage: true },
    }),
    db.profile.findMany({
      where: { type: 'VENUE', ...getDemoOwnerExclusion() },
      orderBy: { hypeCount: 'desc' },
      take: 6,
      select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true, hypeCount: true },
    }),
    db.show.findMany({
      where: { status: { in: ['SCHEDULED', 'LIVE'] }, startsAt: { gte: new Date() }, ...getDemoCreatorExclusion() },
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

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 100px' }}>

      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          DISCOVER
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 8px' }}>
          Find your next favourite artist
        </h1>
        <p style={{ color: 'rgba(240,235,229,.55)', fontSize: 14, margin: 0 }}>
          Ranked by real fan hypes — no paid promotion.
        </p>
      </div>

      {/* Upcoming shows */}
      {upcomingShows.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: 0 }}>Upcoming shows</h2>
            <Link href="/shows" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
              VIEW ALL →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
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
                    <div style={{ fontSize: 12, color: 'rgba(240,235,229,.45)' }}>
                      {s.headlinerProfile?.name ?? 'iHYPE Radio'}
                      {s.venueProfile?.city ? ` · ${s.venueProfile.city}` : ''}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {topArtists.map(p => (
              <Link key={p.id} href={profileRoute(p.type, p.slug)} style={{ textDecoration: 'none' }}>
                <div className="ihype-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 22,
                    background: `linear-gradient(135deg, ${TYPE_COLOR[p.type] ?? '#ff5029'}, #b983ff)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                  }}>
                    {p.type === 'VENUE' ? '🏛️' : '🎤'}
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
                  {p.hypeCount > 0 && (
                    <div style={{ fontSize: 11, color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)' }}>
                      🔥 {p.hypeCount.toLocaleString()} hypes
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top venues */}
      {topVenues.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: '0 0 16px' }}>
            Venues
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {topVenues.map(p => (
              <Link key={p.id} href={`/venues/${p.slug}`} style={{ textDecoration: 'none' }}>
                <div className="ihype-card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, marginBottom: 4, color: '#22e5d4' }}>🏛️ {p.name}</div>
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
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
