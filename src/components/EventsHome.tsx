'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { TicketCardActions } from '@/components/TicketCardActions';
import { PagesReferralTab } from '@/components/PagesReferralTab';
import { MobileQuickGrid, type QuickGridItem } from '@/components/MobileQuickGrid';

type Tab = 'search' | 'local' | 'foryou' | 'tickets' | 'referral';
const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'local', label: 'Local Events' },
  { id: 'foryou', label: 'For You' },
  { id: 'tickets', label: 'My Tickets' },
  { id: 'referral', label: 'HYPE Link' },
];

type Show = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: string;
  hypeCount: number;
  isTicketed: boolean;
  ticketPriceCents: number;
  headlinerProfile?: { name: string; genres?: string[] } | null;
  venueProfile?: { name: string; city?: string | null } | null;
};

type TicketOrder = {
  id: string;
  quantity: number;
  status: string;
  subtotalCents: number;
  totalChargeCents: number;
  show: { slug: string; title: string; startsAt: string };
  tickets: { id: string; serializedId: string }[];
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

const eventCard = { display: 'flex', alignItems: 'stretch', gap: 0, border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,.03)', textDecoration: 'none', color: 'inherit' } as const;
const emptyStyle = { textAlign: 'center' as const, padding: '60px 24px', color: 'rgba(240,235,229,.5)' };

function EventList({ shows, emptyTitle, emptyBody }: { shows: Show[]; emptyTitle: string; emptyBody: string }) {
  if (shows.length === 0) {
    return (
      <div>
        {/* Ghost event card — the module keeps its designed shape even with nothing to list */}
        <div aria-hidden="true" style={{ ...eventCard, border: '1px dashed rgba(255,255,255,.12)', background: 'rgba(255,255,255,.015)' }}>
          <div style={{ width: 110, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(255,255,255,.04)', background: 'linear-gradient(135deg, rgba(255,80,41,.07) 0%, transparent 100%)', fontSize: 30, opacity: 0.35 }}>🎵</div>
          <div style={{ flex: 1, minWidth: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.25)', marginBottom: 7 }}>Date · Time</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4, color: 'rgba(240,235,229,.3)' }}>Your next show</div>
            <div style={{ fontSize: 13, color: 'rgba(240,235,229,.22)' }}>Venue · City</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '18px 20px', gap: 8, flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'rgba(255,80,41,.35)', letterSpacing: '-.02em' }}>—</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.2)' }}>$0 fees</div>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,80,41,.2)', color: 'rgba(255,255,255,.4)' }}>Get ticket</span>
          </div>
        </div>
        <div style={{ ...emptyStyle, padding: '28px 24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'rgba(240,235,229,.6)', margin: '0 0 6px' }}>{emptyTitle}</h3>
          <p style={{ margin: 0 }}>{emptyBody}</p>
        </div>
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

export function EventsHome({
  initialTab,
  initialTicketView,
  isShellForeground = true,
  resetToken,
}: {
  initialTab?: string;
  initialTicketView?: string;
  isShellForeground?: boolean;
  resetToken?: number;
} = {}) {
  const validInitialTab = TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : null;
  const [tab, setTab] = useState<Tab>(validInitialTab ?? 'local');
  const [gridMode, setGridMode] = useState(!validInitialTab);
  const prevResetToken = useRef(resetToken);
  useEffect(() => {
    if (resetToken !== undefined && resetToken !== prevResetToken.current) {
      prevResetToken.current = resetToken;
      setGridMode(true);
    }
  }, [resetToken]);
  const [q, setQ] = useState('');
  const [shows, setShows] = useState<Show[] | null>(null);
  const [nearCity, setNearCity] = useState<string | null>(null);
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ticketView, setTicketView] = useState<'active' | 'archive'>(initialTicketView === 'archive' ? 'archive' : 'active');
  const [ticketOrders, setTicketOrders] = useState<TicketOrder[] | null>(null);

  useEffect(() => {
    fetch('/api/shows/directory')
      .then((r) => r.json())
      .then((d) => { setShows(d.shows ?? []); setNearCity(d.nearCity ?? null); setUserGenres(d.userGenres ?? []); setLoggedIn(!!d.loggedIn); })
      .catch(() => setShows([]));
  }, []);

  useEffect(() => {
    if (tab !== 'tickets' || !loggedIn) return;
    setTicketOrders(null);
    fetch(`/api/tickets?view=${ticketView}`)
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => setTicketOrders(d.orders ?? []))
      .catch(() => setTicketOrders([]));
  }, [tab, loggedIn, ticketView]);

  const allShows = shows ?? [];
  const genresSet = useMemo(() => new Set(userGenres), [userGenres]);

  const localShows = nearCity
    ? allShows.filter((s) => (s.venueProfile?.city ?? '').toLowerCase() === nearCity.toLowerCase())
    : allShows;
  const forYouShows = genresSet.size > 0
    ? allShows.filter((s) => s.headlinerProfile?.genres?.some((g) => genresSet.has(g)))
    : allShows;
  const ql = q.trim().toLowerCase();
  const searchShows = ql
    ? allShows.filter((s) => `${s.title} ${s.headlinerProfile?.name ?? ''} ${s.venueProfile?.name ?? ''} ${s.venueProfile?.city ?? ''}`.toLowerCase().includes(ql))
    : [];

  const gridItems: QuickGridItem[] = [
    {
      id: 'local', label: 'Local', color: '#22e5d4', sublabel: nearCity ? `${nearCity} · ${localShows.length}` : `${localShows.length} shows`,
      icon: <svg fill="none" height="30" stroke="#22e5d4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="30"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>,
    },
    {
      id: 'foryou', label: 'For You', color: '#ff5029', sublabel: `${forYouShows.length} matched`,
      icon: <svg fill="none" height="30" stroke="#ff5029" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="30"><path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2.4 4 6.4 4c2 0 3.6 1 5.6 3 2-2 3.6-3 5.6-3 4 0 5.9 4.2 4.4 7.7C19.5 16.4 12 21 12 21Z" /></svg>,
    },
    {
      id: 'tickets', label: 'Tickets', color: '#b983ff', sublabel: loggedIn ? 'View yours' : 'Log in to view',
      icon: <svg fill="none" height="30" stroke="#b983ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="30"><path d="M3 9a2 2 0 0 0 2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2a2 2 0 0 0-2-2Z" /></svg>,
    },
    {
      id: 'referral', label: 'HYPE Link', color: '#ff3e9a', sublabel: '10% share',
      icon: <svg fill="none" height="30" stroke="#ff3e9a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="30"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>,
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px' }}>
      <MobileQuickGrid
        active={gridMode && isShellForeground}
        items={gridItems}
        onSearchTap={() => { setGridMode(false); setTab('search'); }}
        onSelect={(id) => { setGridMode(false); setTab(id as Tab); }}
        searchPlaceholder="Search artists, venues, shows…"
      />

      <div className={`mqg-content${gridMode ? ' is-hidden' : ''}`}>
      <button className="mqg-back" onClick={() => setGridMode(true)} type="button">
        <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><polyline points="15 18 9 12 15 6" /></svg>
        Events
      </button>

      <h1 className="sr-only">Events</h1>

      <div className="mqg-tabstrip" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {TABS.map((t) => (
          <div
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 14, padding: '9px 18px', borderRadius: 9999, cursor: 'pointer',
              background: tab === t.id ? 'rgba(255,80,41,.1)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${tab === t.id ? 'rgba(255,80,41,.35)' : 'rgba(255,255,255,.08)'}`,
              color: tab === t.id ? 'var(--ink)' : 'rgba(240,235,229,.55)', fontWeight: tab === t.id ? 500 : 400,
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'search' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <svg fill="none" height="16" stroke="rgba(240,235,229,.5)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} viewBox="0 0 24 24" width="16">
              <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <input
              autoFocus
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search artists, venues, shows…"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px 14px 46px', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 16 }}
              type="text"
              value={q}
            />
          </div>
          {!q.trim() ? (
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
        shows === null ? <div style={emptyStyle}><p>Loading events…</p></div> : (
          <EventList
            emptyBody="No shows near you right now — check For You or Search instead."
            emptyTitle="Nothing here yet"
            shows={localShows}
          />
        )
      )}

      {tab === 'foryou' && (
        shows === null ? <div style={emptyStyle}><p>Loading events…</p></div> : (
          <EventList
            emptyBody="Hype some artists and we'll surface shows that match your taste."
            emptyTitle="Nothing here yet"
            shows={forYouShows}
          />
        )
      )}

      {tab === 'tickets' && (
        <div>
          {!loggedIn ? (
            <div style={emptyStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'rgba(240,235,229,.6)', margin: '14px 0 6px' }}>Sign in to see your tickets</h3>
              <Link href="/login?callbackUrl=/shows" style={{ display: 'inline-block', marginTop: 16, padding: '11px 20px', fontSize: 13, background: 'var(--accent)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>Log in</Link>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, maxWidth: 280, marginBottom: 20 }}>
                {(['active', 'archive'] as const).map((v) => (
                  <div
                    key={v}
                    onClick={() => setTicketView(v)}
                    style={{
                      flex: 1, textAlign: 'center', padding: 12, borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${ticketView === v ? 'var(--accent)' : 'rgba(255,255,255,.12)'}`,
                      background: ticketView === v ? 'rgba(255,80,41,.08)' : 'transparent',
                      fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--ink)',
                    }}
                  >
                    {v === 'active' ? 'Active' : 'Archive'}
                  </div>
                ))}
              </div>

              {ticketOrders === null ? (
                <div style={emptyStyle}><p>Loading tickets…</p></div>
              ) : ticketOrders.length === 0 ? (
                <div style={emptyStyle}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'rgba(240,235,229,.6)', margin: '14px 0 6px' }}>
                    {ticketView === 'archive' ? 'No past tickets yet' : 'No tickets yet'}
                  </h3>
                  <p>{ticketView === 'archive' ? "Shows you've attended or cancelled tickets land here." : 'Tickets you buy show up here with a QR for entry.'}</p>
                  {ticketView === 'active' && (
                    <button onClick={() => { setTab('local'); }} style={{ display: 'inline-block', marginTop: 16, padding: '11px 20px', fontSize: 13, background: 'var(--accent)', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer' }} type="button">Browse events</button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ticketOrders.map((order) => {
                    const startsAt = new Date(order.show.startsAt);
                    const dateStr = startsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                    const timeStr = startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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
                          <TicketCardActions orderId={order.id} showCancel showsAt={order.show.startsAt} tickets={order.tickets} />
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

      {tab === 'referral' && <PagesReferralTab />}
      </div>
    </div>
  );
}
