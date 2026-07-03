import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getShowsDirectoryData } from '@/lib/public-data';
import { sortShowsForFeed } from '@/lib/integrity';
import { detectRequestLocation } from '@/lib/request-location';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { TicketCardActions } from '@/components/TicketCardActions';

export const metadata: Metadata = {
  title: 'Events · iHYPE',
  description: "Face value, zero fees. Every ticket — 45% artist, 45% venue, 10% promoters.",
  openGraph: { title: 'Events · iHYPE', description: 'Face value, zero fees. Every ticket — 45% artist, 45% venue, 10% promoters.' },
  twitter: { card: 'summary_large_image', title: 'Events · iHYPE', description: 'Face value, zero fees.' },
};

export const dynamic = 'force-dynamic';

type Tab = 'search' | 'local' | 'foryou' | 'tickets';
const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'local', label: 'Local Events' },
  { id: 'foryou', label: 'For You' },
  { id: 'tickets', label: 'My Tickets' },
];

function fmtDate(d: Date) {
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

const eventCard = { display: 'flex', alignItems: 'stretch', gap: 0, border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,.03)', textDecoration: 'none', color: 'inherit' } as const;
const emptyStyle = { textAlign: 'center' as const, padding: '60px 24px', color: 'rgba(240,235,229,.5)' };

export default async function ShowsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; q?: string; ticketView?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const tab: Tab = TABS.some((t) => t.id === resolvedParams.tab) ? (resolvedParams.tab as Tab) : 'local';
  const q = resolvedParams.q?.trim() ?? '';
  const ticketView = resolvedParams.ticketView === 'archive' ? 'archive' : 'active';

  const [rawShows, viewerLocation, session] = await Promise.all([
    getShowsDirectoryData(),
    detectRequestLocation(),
    auth().catch(() => null),
  ]);

  let userCity: string | null = null;
  let userGenres = new Set<string>();
  if (session?.user?.id) {
    const [userProfile, hypedGenres] = await Promise.all([
      db.profile.findFirst({ where: { ownerId: session.user.id }, select: { city: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
      db.profileHypeEvent.findMany({ where: { userId: session.user.id }, select: { profile: { select: { genres: true } } }, take: 50 }).catch(() => []),
    ]);
    userCity = userProfile?.city ?? null;
    userGenres = new Set(hypedGenres.flatMap((h) => h.profile.genres));
  }
  const nearCity = userCity ?? viewerLocation?.city ?? null;

  const now = new Date();
  const allShows = sortShowsForFeed(rawShows)
    .map((show) => ({ ...show, startsAt: show.startsAt instanceof Date ? show.startsAt : new Date(show.startsAt) }))
    .filter((show) => show.status !== 'ENDED' && show.status !== 'CANCELED' && show.startsAt >= now);

  const localShows = nearCity
    ? allShows.filter((s) => (s.venueProfile?.city ?? '').toLowerCase() === nearCity.toLowerCase())
    : allShows;

  const forYouShows = userGenres.size > 0
    ? allShows.filter((s) => s.headlinerProfile?.genres?.some((g) => userGenres.has(g)))
    : allShows;

  const ql = q.toLowerCase();
  const searchShows = ql
    ? allShows.filter((s) => `${s.title} ${s.headlinerProfile?.name ?? ''} ${s.venueProfile?.name ?? ''} ${s.venueProfile?.city ?? ''}`.toLowerCase().includes(ql))
    : [];

  let ticketOrders: Awaited<ReturnType<typeof loadTicketOrders>> = [];
  if (tab === 'tickets' && session?.user?.id) {
    ticketOrders = await loadTicketOrders(session.user.id, ticketView);
  }

  const tabHref = (t: Tab) => `/shows?tab=${t}`;

  function EventList({ shows, emptyTitle, emptyBody }: { shows: typeof allShows; emptyTitle: string; emptyBody: string }) {
    if (shows.length === 0) {
      return (
        <div style={emptyStyle}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'rgba(240,235,229,.6)', margin: '14px 0 6px' }}>{emptyTitle}</h3>
          <p>{emptyBody}</p>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shows.map((show) => {
          const demandLabel = show.hypeCount >= 50 ? `+${Math.min(99, Math.round(show.hypeCount / 5))}% this week` : null;
          return (
            <Link href={`/shows/${show.slug}`} key={show.id} style={eventCard}>
              <div style={{ width: 110, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(255,255,255,.05)', background: 'linear-gradient(135deg, rgba(255,80,41,.15) 0%, transparent 100%)', fontSize: 30 }}>🎵</div>
              <div style={{ flex: 1, minWidth: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{fmtDate(show.startsAt)}</span>
                  {demandLabel && <span style={{ color: '#22e5d4' }}>{demandLabel}</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {show.headlinerProfile ? `${show.headlinerProfile.name} @ ${show.venueProfile?.name ?? show.title}` : show.title}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(240,235,229,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{show.venueProfile?.name ?? ''}{show.venueProfile?.city ? ` · ${show.venueProfile.city}` : ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '18px 20px', gap: 8, flexShrink: 0 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-.02em' }}>
                    {show.isTicketed ? formatCurrencyFromCents(show.ticketPriceCents) : 'Free'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)' }}>$0 fees</div>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, padding: '8px 14px', borderRadius: 8, background: 'var(--accent)', color: '#fff' }}>Get ticket</span>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>WHAT&apos;S ON</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, margin: '0 0 6px' }}>Events</h1>
        <p style={{ fontSize: 14, color: 'rgba(240,235,229,.55)', margin: 0 }}>Face value, zero fees. Every ticket — 45% artist, 45% venue, 10% promoters.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 14, padding: '9px 18px', borderRadius: 9999, textDecoration: 'none',
              background: tab === t.id ? 'rgba(255,80,41,.1)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${tab === t.id ? 'rgba(255,80,41,.35)' : 'rgba(255,255,255,.08)'}`,
              color: tab === t.id ? 'var(--ink)' : 'rgba(240,235,229,.55)', fontWeight: tab === t.id ? 500 : 400,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'search' && (
        <div>
          <form action="/shows" method="GET" style={{ position: 'relative', marginBottom: 22 }}>
            <input type="hidden" name="tab" value="search" />
            <svg fill="none" height="16" stroke="rgba(240,235,229,.5)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} viewBox="0 0 24 24" width="16">
              <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <input
              defaultValue={q}
              name="q"
              placeholder="Search shows, artists, or venues…"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px 14px 46px', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15 }}
              type="text"
            />
          </form>
          {!q ? (
            <div style={emptyStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'rgba(240,235,229,.6)', margin: '14px 0 6px' }}>Search events</h3>
              <p>Find shows by artist, venue, or city.</p>
            </div>
          ) : (
            <EventList emptyBody="Try a different artist, venue, or city." emptyTitle={`No results for "${q}"`} shows={searchShows} />
          )}
        </div>
      )}

      {tab === 'local' && (
        <EventList
          emptyBody="No shows near you right now — check For You or Search instead."
          emptyTitle="Nothing here yet"
          shows={localShows}
        />
      )}

      {tab === 'foryou' && (
        <EventList
          emptyBody="Hype some artists and we'll surface shows that match your taste."
          emptyTitle="Nothing here yet"
          shows={forYouShows}
        />
      )}

      {tab === 'tickets' && (
        <div>
          {!session?.user?.id ? (
            <div style={emptyStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'rgba(240,235,229,.6)', margin: '14px 0 6px' }}>Sign in to see your tickets</h3>
              <Link href="/login?callbackUrl=/shows?tab=tickets" style={{ display: 'inline-block', marginTop: 16, padding: '11px 20px', fontSize: 13, background: 'var(--accent)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>Log in</Link>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, maxWidth: 280, marginBottom: 20 }}>
                {(['active', 'archive'] as const).map((v) => (
                  <Link
                    key={v}
                    href={`/shows?tab=tickets&ticketView=${v}`}
                    style={{
                      flex: 1, textAlign: 'center', padding: 12, borderRadius: 10, textDecoration: 'none',
                      border: `1px solid ${ticketView === v ? 'var(--accent)' : 'rgba(255,255,255,.12)'}`,
                      background: ticketView === v ? 'rgba(255,80,41,.08)' : 'transparent',
                      fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--ink)',
                    }}
                  >
                    {v === 'active' ? 'Active' : 'Archive'}
                  </Link>
                ))}
              </div>

              {ticketOrders.length === 0 ? (
                <div style={emptyStyle}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'rgba(240,235,229,.6)', margin: '14px 0 6px' }}>
                    {ticketView === 'archive' ? 'No past tickets yet' : 'No tickets yet'}
                  </h3>
                  <p>{ticketView === 'archive' ? "Shows you've attended or cancelled tickets land here." : 'Tickets you buy show up here with a QR for entry.'}</p>
                  {ticketView === 'active' && (
                    <Link href="/shows?tab=local" style={{ display: 'inline-block', marginTop: 16, padding: '11px 20px', fontSize: 13, background: 'var(--accent)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>Browse events</Link>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ticketOrders.map((order) => {
                    const dateStr = order.show.startsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                    const timeStr = order.show.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const unitPriceCents = order.quantity > 0 ? Math.round((order.totalChargeCents || order.subtotalCents) / order.quantity) : (order.totalChargeCents || order.subtotalCents);
                    return (
                      <div key={order.id} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 20, background: 'rgba(255,255,255,.03)', opacity: ticketView === 'archive' ? 0.6 : 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: order.status === 'VOID' ? 'var(--accent)' : '#22e5d4', marginBottom: 6 }}>
                          ● {order.status === 'VOID' ? 'CANCELLED' : ticketView === 'archive' ? 'USED' : 'VALID'} · {formatCurrencyFromCents(unitPriceCents)} FACE VALUE
                        </div>
                        <Link href={`/shows/${order.show.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 3 }}>{order.show.title}</div>
                        </Link>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginBottom: 14 }}>
                          {dateStr} · {timeStr}
                        </div>
                        {ticketView === 'active' && order.status !== 'VOID' && (
                          <TicketCardActions orderId={order.id} showCancel showsAt={order.show.startsAt.toISOString()} tickets={order.tickets} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p style={{ marginTop: 40, fontSize: 11, color: 'rgba(240,235,229,.25)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
        iHYPE · 0% platform fee · 45/45/10 split · admin@ihype.org
      </p>
    </div>
  );
}

function loadTicketOrders(userId: string, view: 'active' | 'archive') {
  const now = new Date();
  return db.ticketOrder.findMany({
    where: view === 'active'
      ? { buyerUserId: userId, status: { not: 'VOID' }, show: { startsAt: { gte: now } } }
      : { buyerUserId: userId, OR: [{ status: 'VOID' }, { show: { startsAt: { lt: now } } }] },
    orderBy: { show: { startsAt: view === 'active' ? 'asc' : 'desc' } },
    take: 50,
    select: {
      id: true,
      quantity: true,
      status: true,
      subtotalCents: true,
      totalChargeCents: true,
      show: { select: { slug: true, title: true, startsAt: true } },
      tickets: { select: { id: true, serializedId: true } },
    },
  });
}
