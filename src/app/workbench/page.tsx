import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { SavedPlaylistPlayButton } from '@/components/SavedPlaylistPlayButton';

export const metadata: Metadata = { title: 'Workbench · iHYPE' };
export const dynamic = 'force-dynamic';

type Tab = 'analytics' | 'tickets';

function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="panel" style={{ padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>{label}</h3>
      {data.length === 0 ? (
        <div className="empty">No data yet.</div>
      ) : (
        <svg viewBox={`0 0 ${data.length * 18} 100`} width="100%" height={120} aria-label={label}>
          {data.map((d, i) => {
            const h = (d.value / max) * 90;
            return (
              <g key={`${d.label}-${i}`}>
                <rect x={i * 18 + 2} y={100 - h} width={14} height={h} fill="var(--accent, #ff5d5d)" rx={2} />
                <title>{`${d.label}: ${d.value}`}</title>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export default async function WorkbenchPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const resolved = searchParams ? await searchParams : {};
  const rawTab = resolved.tab;
  const tab: Tab = rawTab === 'tickets' ? 'tickets' : 'analytics';

  // ── ANALYTICS TAB ──
  let analyticsProfiles: Array<{ id: string; name: string; slug: string; type: string }> = [];
  let hypeByDay: Array<{ label: string; value: number }> = [];
  let topMedia: Array<{ label: string; value: number }> = [];
  let recentFans: Array<{ id: string; createdAt: Date; user: { name: string | null; username: string } | null }> = [];

  if (tab === 'analytics') {
    analyticsProfiles = await db.profile.findMany({
      where: { ownerId: session.user.id, type: { in: ['ARTIST', 'DJ'] } },
      select: { id: true, name: true, slug: true, type: true }
    });

    if (analyticsProfiles.length > 0 || isAdminSession(session)) {
      const profileIds = analyticsProfiles.map((p) => p.id);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [hypeEvents, mediaTop, recentFansData] = await Promise.all([
        profileIds.length ? db.profileHypeEvent.findMany({ where: { profileId: { in: profileIds }, createdAt: { gte: since } }, select: { createdAt: true } }) : Promise.resolve([] as { createdAt: Date }[]),
        profileIds.length ? db.artistMediaAsset.findMany({ where: { profileId: { in: profileIds } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true } }) : Promise.resolve([] as { id: string; title: string }[]),
        profileIds.length ? db.profileHypeEvent.findMany({ where: { profileId: { in: profileIds } }, orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { name: true, username: true } } } }) : Promise.resolve([] as typeof recentFans)
      ]);

      const dayBuckets = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dayBuckets.set(d.toISOString().slice(0, 10), 0);
      }
      for (const evt of hypeEvents) {
        const day = evt.createdAt.toISOString().slice(0, 10);
        if (dayBuckets.has(day)) dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
      }
      hypeByDay = [...dayBuckets.entries()].map(([label, value]) => ({ label, value }));

      const mediaIds = mediaTop.map((m) => m.id);
      const listenCounts = mediaIds.length ? await db.mediaListen.groupBy({ by: ['mediaId'], where: { mediaId: { in: mediaIds } }, _count: { mediaId: true } }).catch(() => [] as Array<{ mediaId: string; _count: { mediaId: number } }>) : [];
      const countMap = new Map(listenCounts.map((r) => [r.mediaId, r._count.mediaId]));
      topMedia = mediaTop.map((m) => ({ label: m.title.slice(0, 16), value: countMap.get(m.id) ?? 0 })).sort((a, b) => b.value - a.value).slice(0, 10);
      recentFans = recentFansData;
    }
  }

  // ── TICKETS TAB ──
  let ticketShows: Array<{
    id: string; title: string; status: string; startsAt: Date; ticketsSoldCount: number; ticketCapacity: number | null;
    venueProfile: { name: string } | null; headlinerProfile: { name: string } | null;
    _count: { tickets: number };
  }> = [];
  let revenueMap = new Map<string, { cents: number; orders: number }>();

  if (tab === 'tickets') {
    const profiles = await db.profile.findMany({
      where: { ownerId: session.user.id, type: { in: ['ARTIST', 'VENUE', 'DJ'] } },
      select: { id: true }
    });

    if (profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);
      ticketShows = await db.show.findMany({
        where: {
          isTicketed: true,
          OR: [{ headlinerProfileId: { in: profileIds } }, { venueProfileId: { in: profileIds } }]
        },
        include: { venueProfile: { select: { name: true } }, headlinerProfile: { select: { name: true } }, _count: { select: { tickets: true } } },
        orderBy: { startsAt: 'desc' },
        take: 50
      });

      const showIds = ticketShows.map((s) => s.id);
      const revenueRows = showIds.length > 0
        ? await db.ticketOrder.groupBy({ by: ['showId'], where: { showId: { in: showIds }, status: 'CAPTURED' }, _sum: { subtotalCents: true }, _count: { id: true } })
        : [];
      revenueMap = new Map(revenueRows.map((r) => [r.showId, { cents: r._sum.subtotalCents ?? 0, orders: r._count.id }]));
    }
  }

  return (
    <main className="container section" style={{ maxWidth: 1000 }}>
      <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28 }}>Workbench</h1>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/workbench?tab=analytics" className={`button small${tab === 'analytics' ? '' : ' secondary'}`}>Analytics</Link>
        <Link href="/workbench?tab=tickets" className={`button small${tab === 'tickets' ? '' : ' secondary'}`}>Tickets</Link>
        <Link href="/workbench/saved" className="button small secondary">Saved tracks</Link>
        <Link href="/workbench/history" className="button small secondary">History</Link>
      </nav>

      {tab === 'analytics' && (
        <>
          {analyticsProfiles.length === 0 && !isAdminSession(session) ? (
            <>
              <p className="meta">You need an Artist or DJ profile to view analytics.</p>
              <Link className="button" href="/home">Back</Link>
            </>
          ) : (
            <>
              <p className="meta">Last 30 days across your {analyticsProfiles.length} profile{analyticsProfiles.length === 1 ? '' : 's'}.</p>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <BarChart data={hypeByDay} label="HYPE per day (30d)" />
                <BarChart data={topMedia} label="Top media (by listens)" />
              </div>
              <section className="panel" style={{ padding: '1rem', marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Profile views</h3>
                <p className="meta">Coming soon — we don&apos;t yet record anonymous profile view events.</p>
              </section>
              <section className="panel" style={{ padding: '1rem', marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Recent fans</h3>
                {recentFans.length === 0 ? (
                  <div className="empty">No fans yet.</div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                    {recentFans.map((f) => (
                      <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{f.user?.name ?? f.user?.username ?? 'Anonymous'}</strong>
                        <span className="meta">{f.createdAt.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}

      {tab === 'tickets' && (
        <>
          {ticketShows.length === 0 ? (
            <p className="meta">No ticketed shows yet. Enable ticketing when creating a show.</p>
          ) : (
            <>
              <p className="meta" style={{ marginBottom: 24 }}>{ticketShows.length} ticketed show{ticketShows.length !== 1 ? 's' : ''}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--f-m)', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--line)', color: 'var(--ink-3)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Show</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tickets sold</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Capacity</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Revenue</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketShows.map((s) => {
                      const rev = revenueMap.get(s.id);
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--ink)', fontWeight: 600 }}>
                            {s.title}
                            {s.venueProfile?.name ? <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}> @ {s.venueProfile.name}</span> : null}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>{s.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s.ticketsSoldCount}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ink-2)' }}>{s.ticketCapacity ?? '—'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#22e5d4' }}>{rev ? `$${(rev.cents / 100).toFixed(2)}` : '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, letterSpacing: '.06em', background: s.status === 'LIVE' ? 'rgba(255,62,154,.15)' : 'rgba(34,229,212,.1)', color: s.status === 'LIVE' ? '#ff3e9a' : '#22e5d4' }}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
