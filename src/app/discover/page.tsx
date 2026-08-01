import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoCreatorExclusion, getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { FollowButton } from '@/components/FollowButton';
import { CompactHypeButton } from '@/components/CompactHypeButton';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discover · iHYPE',
  description: 'Find independent artists, venues, and shows near you. Real fan demand — no paid promotion.',
};

const TYPE_COLOR: Record<string, string> = {
  ARTIST: 'var(--role-artist)',
  DJ: 'var(--role-dj)',
  VENUE: 'var(--role-venue)',
  FAN: 'var(--role-fan)',
};

const TYPE_LABEL: Record<string, string> = {
  ARTIST: 'Artist',
  DJ: 'DJ',
  VENUE: 'Venue',
  FAN: 'Fan',
};

export default async function DiscoverPage({ searchParams }: { searchParams?: Promise<{ city?: string; genre?: string; page?: string }> }) {
  const t = await getServerT();
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
        discoverable: true,
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
        discoverable: true,
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

  // "On air now" — real live radio shows, keyed by DJ headliner profile id,
  // so the trending-DJ cards below can show a genuine on-air badge instead
  // of a fabricated status.
  const trendingDjIds = topArtists.filter(p => p.type === 'DJ').map(p => p.id);
  const onAirShows = trendingDjIds.length
    ? await db.show.findMany({
        where: { isRadioShow: true, status: 'LIVE', headlinerProfileId: { in: trendingDjIds } },
        select: { headlinerProfileId: true },
      })
    : [];
  const onAirProfileIds = new Set(onAirShows.map(s => s.headlinerProfileId).filter(Boolean));

  // "Rising near you" — ranked by real hype velocity (recent HypeEvent/
  // ProfileHypeEvent rows in a trailing window), not by date. Both models
  // record a fresh createdAt on every (re)hype (see POST /api/hype), so a
  // count of rows since `risingSince` is a genuine recent-activity signal.
  const RISING_WINDOW_HOURS = 6;
  const risingSince = new Date(Date.now() - RISING_WINDOW_HOURS * 60 * 60 * 1000);
  const [risingShowCounts, risingProfileCounts] = await Promise.all([
    db.hypeEvent.groupBy({ by: ['showId'], where: { createdAt: { gte: risingSince } }, _count: { _all: true } }),
    db.profileHypeEvent.groupBy({ by: ['profileId'], where: { createdAt: { gte: risingSince } }, _count: { _all: true } }),
  ]);
  const topRisingShowIds = [...risingShowCounts].sort((a, b) => b._count._all - a._count._all).slice(0, 6).map(g => g.showId);
  const topRisingProfileIds = [...risingProfileCounts].sort((a, b) => b._count._all - a._count._all).slice(0, 6).map(g => g.profileId);
  const [risingShows, risingProfiles] = await Promise.all([
    topRisingShowIds.length
      ? db.show.findMany({
          where: { id: { in: topRisingShowIds }, status: { in: ['SCHEDULED', 'LIVE'] }, ...getDemoCreatorExclusion() },
          select: { id: true, slug: true, title: true, status: true, hypeCount: true, headlinerProfile: { select: { name: true } }, venueProfile: { select: { city: true } } },
        })
      : Promise.resolve([]),
    topRisingProfileIds.length
      ? db.profile.findMany({
          where: { id: { in: topRisingProfileIds }, discoverable: true, ...getDemoOwnerExclusion() },
          select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true, hypeCount: true },
        })
      : Promise.resolve([]),
  ]);
  const risingCountByShow = new Map(risingShowCounts.map(g => [g.showId, g._count._all]));
  const risingCountByProfile = new Map(risingProfileCounts.map(g => [g.profileId, g._count._all]));
  const rising = [
    ...risingShows.map(s => ({
      key: `show:${s.id}`,
      href: `/shows/${s.slug}`,
      title: s.title,
      meta: [s.headlinerProfile?.name ?? 'iHYPE Radio', s.venueProfile?.city, s.status === 'LIVE' ? 'Live now' : null].filter(Boolean).join(' · '),
      hypeCount: s.hypeCount,
      targetType: 'show' as const,
      targetId: s.id,
      count: risingCountByShow.get(s.id) ?? 0,
    })),
    ...risingProfiles.map(p => ({
      key: `profile:${p.id}`,
      href: profileRoute(p.type, p.slug),
      title: p.name,
      meta: [p.city, p.stateRegion].filter(Boolean).join(', '),
      hypeCount: p.hypeCount,
      targetType: 'profile' as const,
      targetId: p.id,
      count: risingCountByProfile.get(p.id) ?? 0,
    })),
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(r => ({ ...r, ratePerHour: Math.max(1, Math.round(r.count / RISING_WINDOW_HOURS)) }));

  // Heat map — city heat bars (real sum of Profile.hypeCount grouped by city)
  // and genre heat chips (Profile.genres is a String[] so Prisma can't
  // group by array element; aggregated in JS from a bounded profile scan).
  const [cityHeatRaw, genreHeatProfiles] = await Promise.all([
    db.profile.groupBy({
      by: ['city'],
      where: { type: { in: ['ARTIST', 'DJ', 'VENUE'] }, discoverable: true, city: { not: null }, ...getDemoOwnerExclusion() },
      _sum: { hypeCount: true },
      orderBy: { _sum: { hypeCount: 'desc' } },
      take: 6,
    }),
    db.profile.findMany({
      where: { type: { in: ['ARTIST', 'DJ'] }, discoverable: true, genres: { isEmpty: false }, ...getDemoOwnerExclusion() },
      select: { genres: true, hypeCount: true },
      take: 300,
    }),
  ]);
  const genreHeatTotals = new Map<string, number>();
  for (const p of genreHeatProfiles) {
    for (const g of p.genres) genreHeatTotals.set(g, (genreHeatTotals.get(g) ?? 0) + p.hypeCount);
  }
  const heatTier = (score: number, [fire, hot, warm]: [number, number, number]) =>
    score >= fire ? 'fire' : score >= hot ? 'hot' : score >= warm ? 'warm' : 'cold';
  const HEAT_TIER_COLOR: Record<string, string> = { fire: 'var(--heat-fire)', hot: 'var(--heat-hot)', warm: 'var(--heat-warm)', cold: 'var(--heat-cold)' };
  // The triplet form exists because the genre chips below compose a tint from
  // the tier colour. Appending a hex alpha suffix (`${color}20`) only works
  // when every tier is a hex literal — the hot tier was already `var(--accent)`,
  // making `var(--accent)20` invalid, so the hot chip alone rendered untinted
  // and unbordered. rgba(var(--triplet), a) composes uniformly for all four.
  const HEAT_TIER_RGB: Record<string, string> = { fire: 'var(--heat-fire-rgb)', hot: 'var(--heat-hot-rgb)', warm: 'var(--heat-warm-rgb)', cold: 'var(--heat-cold-rgb)' };
  const HEAT_TIER_WIDTH: Record<string, string> = { fire: '100%', hot: '70%', warm: '45%', cold: '20%' };
  const cityHeat = cityHeatRaw
    .filter(c => c.city)
    .map(c => ({ label: c.city as string, score: c._sum.hypeCount ?? 0, tier: heatTier(c._sum.hypeCount ?? 0, [6000, 2500, 1000]) }));
  const genreHeat = [...genreHeatTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, score]) => ({ label, score, tier: heatTier(score, [4000, 1800, 800]) }));

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
          {t('discoverPage.kicker', 'DISCOVER')}
        </p>
        <h1 className="ihype-hero-heading" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 8px' }}>
          {t('discoverPage.heroTitle', 'Find your next favourite artist')}
        </h1>
        <p style={{ color: 'var(--ink-a55)', fontSize: 14, margin: 0 }}>
          {t('discoverPage.heroSubtitle', 'Ranked by real fan hypes — no paid promotion.')}
        </p>
      </div>

      {/* For You entry point */}
      <Link href="/for-you" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderRadius: 16, background: 'rgba(var(--accent-rgb),.08)', border: '1px solid rgba(var(--accent-rgb),.3)' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>{t('discoverPage.forYouKicker', 'FOR YOU')}</span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-.02em', color: 'var(--ink)', marginTop: 2 }}>{t('discoverPage.forYouTitle', 'Artists picked for your taste →')}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-a50)', flexShrink: 0 }}>{t('discoverPage.forYouCta', 'See why')}</span>
        </div>
      </Link>

      {/* This Weekend entry point */}
      <Link href="/this-weekend" style={{ textDecoration: 'none', display: 'block', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderRadius: 16, background: 'rgba(var(--role-venue-rgb),.08)', border: '1px solid rgba(var(--role-venue-rgb),.3)' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--role-venue)' }}>{t('discoverPage.thisWeekendKicker', 'THIS WEEKEND')}</span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-.02em', color: 'var(--ink)', marginTop: 2 }}>{t('discoverPage.thisWeekendTitle', 'Shows near you →')}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-a50)', flexShrink: 0 }}>{t('discoverPage.thisWeekendCta', 'Get tickets')}</span>
        </div>
      </Link>

      {/* Rising near you — hype-velocity ranking */}
      {rising.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: 0 }}>🔥 {t('discoverPage.risingTitle', 'Rising near you')}</h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a35)' }}>
              {t('discoverPage.risingSubtitle', 'Sorted by hype velocity, not date')}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {rising.map(r => (
              <Link key={r.key} href={r.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(var(--accent-rgb),.14), transparent 60%), var(--hair-40)', border: '1px solid rgba(var(--accent-rgb),.25)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, marginBottom: 3, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-a55)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.meta}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>▲ {r.ratePerHour}/hr</span>
                    <CompactHypeButton targetType={r.targetType} targetId={r.targetId} initialCount={r.hypeCount} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Heat map — real city/genre hype aggregates. Map view links to the
          companion DiscoverMap design; no Next.js route exists for it yet
          (not in CLAUDE.md's page map), so it's rendered as a label rather
          than a broken link. */}
      {(cityHeat.length > 0 || genreHeat.length > 0) && (
        <section style={{ marginBottom: 32, border: '1px solid var(--hair-80)', borderRadius: 16, background: 'var(--hair-40)', padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, margin: 0 }}>🌡️ {t('discoverPage.heatMapTitle', 'Heat map')}</h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a30)' }}>{t('discoverPage.heatMapComingSoon', 'Map view (coming soon)')}</span>
          </div>
          {cityHeat.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: genreHeat.length > 0 ? 18 : 0 }}>
              {cityHeat.map(ch => (
                <div key={ch.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 92, flexShrink: 0, fontSize: 12, color: 'var(--ink-a70)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.label}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--hair-80)', overflow: 'hidden' }} role="img" aria-label={`${ch.label}: ${ch.score.toLocaleString()} ${t('discoverPage.hypesUnit', 'hypes')}`}>
                    <div style={{ width: HEAT_TIER_WIDTH[ch.tier], height: '100%', borderRadius: 4, background: HEAT_TIER_COLOR[ch.tier] }} />
                  </div>
                  <span style={{ width: 72, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-a45)' }}>{ch.score.toLocaleString()} {t('discoverPage.hypesUnit', 'hypes')}</span>
                </div>
              ))}
            </div>
          )}
          {genreHeat.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {genreHeat.map(gh => (
                <span key={gh.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: 11, fontFamily: 'var(--font-mono)', background: `rgba(${HEAT_TIER_RGB[gh.tier]}, .125)`, border: `1px solid rgba(${HEAT_TIER_RGB[gh.tier]}, .25)`, color: HEAT_TIER_COLOR[gh.tier] }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: HEAT_TIER_COLOR[gh.tier] }} />
                  {gh.label}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Filters */}
      {(cities.length > 0 || genres.length > 0) && (
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cities.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a30)', flexShrink: 0 }}>{t('discoverPage.cityFilterLabel', 'City')}</span>
              {cityFilter && (
                <Link href={buildUrl(null, genreFilter)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'var(--ink-on-accent)', cursor: 'pointer' }}>
                    {cityFilter} ×
                  </span>
                </Link>
              )}
              {cities.filter(c => c !== cityFilter).map(c => (
                <Link key={c} href={buildUrl(c, genreFilter)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--line)', color: 'var(--ink-a60)', cursor: 'pointer', border: '1px solid var(--hair-80)' }}>
                    {c}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {genres.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a30)', flexShrink: 0 }}>{t('discoverPage.genreFilterLabel', 'Genre')}</span>
              {genreFilter && (
                <Link href={buildUrl(cityFilter, null)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--accent-2)', color: 'var(--ink-on-accent)', cursor: 'pointer' }}>
                    {genreFilter} ×
                  </span>
                </Link>
              )}
              {genres.filter(g => g !== genreFilter).map(g => (
                <Link key={g} href={buildUrl(cityFilter, g)} style={{ textDecoration: 'none' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--line)', color: 'var(--ink-a60)', cursor: 'pointer', border: '1px solid var(--hair-80)' }}>
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
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: 0 }}>{t('discoverPage.upcomingShowsTitle', 'Upcoming shows')}</h2>
            <Link href="/shows" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
              {t('discoverPage.viewAll', 'VIEW ALL →')}
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
                          {t('discoverPage.liveNow', 'Live now')}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--ink-a50)', fontFamily: 'var(--font-mono)' }}>{date}</span>
                      )}
                      {s.isTicketed && (
                        <span style={{ fontSize: 11, color: 'var(--role-venue)', fontFamily: 'var(--font-mono)' }}>
                          {s.ticketPriceCents ? `$${(s.ticketPriceCents / 100).toFixed(0)}` : t('discoverPage.free', 'Free')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, marginBottom: 4, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-a55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                        {s.headlinerProfile?.name ?? 'iHYPE Radio'}
                        {s.venueProfile?.city ? ` · ${s.venueProfile.city}` : ''}
                      </div>
                      {/* No onClick wrapper: this is a Server Component, and function
                          props crash RSC serialization the moment a show row exists.
                          CompactHypeButton stops propagation/navigation itself. */}
                      <div>
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
            {t('discoverPage.trendingArtistsTitle', 'Trending artists & DJs')}
          </h2>
          <div className="ihype-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {topArtists.map(p => (
              <div key={p.id} className="ihype-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href={profileRoute(p.type, p.slug)} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 22, position: 'relative',
                    background: `linear-gradient(135deg, ${TYPE_COLOR[p.type] ?? 'var(--role-artist)'}, var(--role-fan))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0, overflow: 'hidden',
                  }}>
                    {p.avatarImage
                      ? <Image src={p.avatarImage} alt={p.name} fill sizes="44px" style={{ objectFit: 'cover', borderRadius: 22 }} />
                      : (p.type === 'VENUE' ? '🏛️' : '🎤')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, marginBottom: 2, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: TYPE_COLOR[p.type] ?? 'var(--role-artist)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {t(`discoverPage.typeLabel.${p.type}`, TYPE_LABEL[p.type] ?? p.type)}
                    </div>
                    {p.city && (
                      <div style={{ fontSize: 11, color: 'var(--ink-a50)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.city}</div>
                    )}
                    {p.type === 'DJ' && onAirProfileIds.has(p.id) && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, padding: '2px 8px', borderRadius: 999, background: 'rgba(var(--accent-2-rgb),.15)', border: '1px solid rgba(var(--accent-2-rgb),.3)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-2)' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>{t('discoverPage.onAirNow', 'On air now')}</span>
                      </div>
                    )}
                  </div>
                </Link>
                {/* Sibling of the card's Link (not nested inside it), so clicks here
                    can't trigger navigation — no handler needed, and Server Components
                    can't pass one anyway. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--line)', border: '1px solid var(--hair-100)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-a70)', textDecoration: 'none', letterSpacing: '.04em' }}
          >
            {t('discoverPage.loadMoreArtists', 'Load more artists →')}
          </Link>
        </div>
      )}

      {/* Top venues */}
      {topVenues.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: '0 0 16px' }}>
            {t('discoverPage.venuesTitle', 'Venues')}
          </h2>
          <div className="ihype-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {topVenues.map(p => (
              <Link key={p.id} href={`/venues/${p.slug}`} style={{ textDecoration: 'none' }}>
                <div className="ihype-card" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--role-venue)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏛️ {p.name}</div>
                    {/* No onClick wrapper (Server Component) — CompactHypeButton
                        stops propagation/navigation itself. */}
                    <div style={{ flexShrink: 0 }}>
                      <CompactHypeButton targetType="profile" targetId={p.id} initialCount={p.hypeCount} />
                    </div>
                  </div>
                  {p.city && (
                    <div style={{ fontSize: 12, color: 'var(--ink-a55)' }}>{p.city}{p.stateRegion ? `, ${p.stateRegion}` : ''}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {topArtists.length === 0 && upcomingShows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a30)' }}>
          <div className="icon" style={{ marginBottom: 16 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 56, height: 56, color: 'var(--accent)', opacity: 0.7 }}><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10a7 7 0 0 1-14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg></div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginBottom: 8, color: 'var(--ink)' }}>
            {t('discoverPage.emptyTitle', 'No artists yet')}
          </p>
          <p style={{ fontSize: 14 }}>{t('discoverPage.emptySubtitle', 'Be the first to join and claim your page.')}</p>
          <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 20, padding: '12px 24px', background: 'var(--accent)', color: 'var(--ink-on-accent)', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            {t('discoverPage.joinCta', 'Join iHYPE →')}
          </Link>
        </div>
      )}
    </div>
  );
}
