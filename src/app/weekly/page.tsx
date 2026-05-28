import { db } from '@/lib/db';

export const revalidate = 3600;

export default async function WeeklyPage() {
  // Top hyped tracks this week — using ArtistMediaAsset which has hypeCount via profile
  // Use FanFavoriteMedia or ArtistMediaAsset; no standalone Media model exists
  // Use Show model with hypeCount for tracks, and ticketsSoldCount for shows

  // Top hyped shows this week (proxy for "tracks" since no standalone Media model)
  const topShows = await db.show.findMany({
    orderBy: { ticketsSoldCount: 'desc' },
    take: 3,
    where: { startsAt: { gte: new Date() } },
    select: { id: true, title: true, startsAt: true, ticketsSoldCount: true, ticketCapacity: true, ticketPriceCents: true, slug: true },
  }).catch(() => []);

  // Top hyped radio shows / content
  const topHyped = await db.show.findMany({
    orderBy: { hypeCount: 'desc' },
    take: 5,
    select: { id: true, title: true, hypeCount: true, slug: true, startsAt: true },
  }).catch(() => []);

  const week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '.2em', color: '#ff5029', marginBottom: 20 }}>
          ● IHYPE · WEEKLY DIGEST · {week.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, margin: '0 0 12px' }}>
          What Chicago<br />Hyped This Week
        </h1>
        <p style={{ color: '#888', fontSize: 15, margin: '0 0 48px', lineHeight: 1.6 }}>
          Raw hype counts. No algorithm. No pay-to-play. Just what the scene actually loved.
        </p>

        {/* Top Hyped Shows */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 13, letterSpacing: '.16em', color: '#555', fontFamily: 'monospace', textTransform: 'uppercase', margin: '0 0 20px' }}>
            🔥 Most Hyped
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topHyped.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#161616', borderRadius: 12, border: '1px solid #222' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: i === 0 ? '#f5d060' : i === 1 ? '#b0b7c3' : i === 2 ? '#c47722' : '#444', minWidth: 32 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ width: 4, height: 40, borderRadius: 2, background: '#ff5029', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                    {t.startsAt ? new Date(t.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#ff5029', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {t.hypeCount.toLocaleString()} hypes
                </div>
              </div>
            ))}
            {topHyped.length === 0 && (
              <p style={{ color: '#555', fontSize: 14 }}>No hypes yet this week.</p>
            )}
          </div>
        </section>

        {/* Hottest Shows by ticket velocity */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 13, letterSpacing: '.16em', color: '#555', fontFamily: 'monospace', textTransform: 'uppercase', margin: '0 0 20px' }}>
            🎪 Hottest Shows
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topShows.map(s => {
              const cap = s.ticketCapacity ?? 0;
              const sold = s.ticketsSoldCount ?? 0;
              const pct = cap > 0 ? Math.round((sold / cap) * 100) : 0;
              return (
                <div key={s.id} style={{ padding: '16px 20px', background: '#161616', borderRadius: 12, border: '1px solid #222' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                        {s.startsAt ? new Date(s.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: '#22e5d4', fontFamily: 'monospace' }}>
                      ${((s.ticketPriceCents ?? 0) / 100).toFixed(0)}
                    </div>
                  </div>
                  {cap > 0 && (
                    <>
                      <div style={{ height: 4, background: '#222', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#ff3e9a' : '#22e5d4', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#555', marginTop: 6, fontFamily: 'monospace' }}>{pct}% sold · {sold}/{cap} tickets</div>
                    </>
                  )}
                </div>
              );
            })}
            {topShows.length === 0 && (
              <p style={{ color: '#555', fontSize: 14 }}>No upcoming shows yet.</p>
            )}
          </div>
        </section>

        <div style={{ textAlign: 'center', paddingTop: 32, borderTop: '1px solid #1a1a1a' }}>
          <a href="https://ihype.org" style={{ display: 'inline-block', padding: '14px 28px', background: '#ff5029', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14, letterSpacing: '.04em' }}>
            Join iHYPE — No Platform Fee →
          </a>
          <p style={{ color: '#444', fontSize: 12, marginTop: 16, fontFamily: 'monospace' }}>
            45% artist · 45% venue · 10% referrer · 0% platform fee
          </p>
        </div>
      </div>
    </div>
  );
}
