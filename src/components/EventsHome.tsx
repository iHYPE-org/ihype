'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { HEAT_LABEL, HEAT_TOKEN, heatLevel } from '@/lib/heat-level';
import { TicketCardActions } from '@/components/TicketCardActions';
import { PagesReferralTab } from '@/components/PagesReferralTab';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useAppShellActive } from '@/components/shell/AppShellContext';
import { useI18n } from '@/components/I18nProvider';

type Tab = 'search' | 'local' | 'foryou' | 'tickets' | 'referral';
/**
 * Tab ids the app shell's context strip already carries for EVENTS. Inside the
 * shell they come off this strip; 'search' and 'referral' stay, because the
 * strip does not carry them and nothing else links to them from here.
 */
const SHELL_TABS: readonly string[] = ['local', 'foryou', 'tickets'];

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
  venueProfile?: { name: string; city?: string | null; stateRegion?: string | null } | null;
  /** Present only on For You results — a personalized "why this show" one-liner from the AI-enhanced recommender, e.g. "Because you hyped X". */
  reason?: { text: string } | null;
  /** Set client-side on the Local tab only — true when a show matched by state/region rather than exact city. */
  isRegional?: boolean;
};

type TicketOrder = {
  id: string;
  quantity: number;
  status: string;
  subtotalCents: number;
  totalChargeCents: number;
  show: { slug: string; title: string; startsAt: string };
  tickets: { id: string; serializedId: string; status?: string }[];
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/**
 * The DS8 show card (`templates/discover/`, the `#dsc-shows` grid).
 *
 * This replaced a 110px-wide art block holding a 🎵 glyph, a horizontal row
 * and a full-width stack. Three things about that were wrong under DS8 and
 * only one of them was cosmetic: the emoji breaks the system's first hard rule,
 * the row layout is not the template's, and at 1000px a single column of
 * full-width rows is the shape that made this page read as un-designed while
 * the tokens underneath it were already correct.
 *
 * Values are lifted from the template verbatim — 12px radius, 16/18 padding,
 * the .04/.15 surface-tint pair, 15px title, 12px meta.
 */
const eventCard = {
  display: 'block',
  background: 'rgba(var(--surface-tint-rgb), .04)',
  border: '1px solid rgba(var(--surface-tint-rgb), .15)',
  borderRadius: 12,
  padding: '16px 18px',
  textDecoration: 'none',
  color: 'inherit',
} as const;
const emptyStyle = { textAlign: 'center' as const, padding: '60px 24px', color: 'var(--ink-a50)' };

function EventList({ shows, emptyTitle, emptyBody }: { shows: Show[]; emptyTitle: string; emptyBody: string }) {
  const { t } = useI18n();
  if (shows.length === 0) {
    return (
      // No ghost card. It used to render a dashed "Your next show — Venue ·
      // City — Get ticket" above this message, to "keep the module's designed
      // shape with nothing to list". On a real empty city that reads as a
      // broken listing: a show with no name, no date and a dead buy button,
      // directly above the words "Nothing here yet". It also carried an emoji,
      // against DS8's first hard rule. An empty state should say it is empty.
      <div>
        <div style={{ ...emptyStyle, padding: '28px 24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--ink-a60)', margin: '0 0 6px' }}>{emptyTitle}</h3>
          <p style={{ margin: 0 }}>{emptyBody}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="ev-grid">
      {shows.map((show) => {
        const heat = heatLevel(show.hypeCount);
        const isLive = show.status === 'LIVE';
        return (
          <Link className="ev-card" href={`/shows/${show.slug}`} key={show.id} style={eventCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span
                  aria-label={HEAT_LABEL[heat]}
                  role="img"
                  style={{ width: 7, height: 7, borderRadius: '50%', background: HEAT_TOKEN[heat], flexShrink: 0 }}
                  title={HEAT_LABEL[heat]}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.06em', textTransform: 'uppercase', color: isLive ? 'var(--accent)' : 'var(--ink-a50)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isLive ? t('eventsHome.liveNow', '● LIVE NOW') : fmtDate(show.startsAt)}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--role-venue)', flexShrink: 0 }}>
                {show.isTicketed ? formatCurrencyFromCents(show.ticketPriceCents) : t('eventsHome.free', 'Free')}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '-.01em', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {show.headlinerProfile ? `${show.headlinerProfile.name} @ ${show.venueProfile?.name ?? show.title}` : show.title}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-a55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {show.venueProfile?.name ?? ''}{show.venueProfile?.city ? ` · ${show.venueProfile.city}` : ''}
              {show.isRegional && <span style={{ color: 'var(--role-venue)' }}> · {t('eventsHome.regionalTag', 'Regional')}</span>}
            </div>
            {show.reason?.text && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--accent)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{show.reason.text}</div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function EventsHome({
  initialTab,
  initialTicketView,
}: {
  initialTab?: string;
  initialTicketView?: string;
} = {}) {
  const { t } = useI18n();
  const validInitialTab = TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : null;
  const [tab, setTab] = useState<Tab>(validInitialTab ?? 'local');
  // The app shell's context strip navigates between these tabs with real
  // links (/shows?tab=tickets). Same route, different query = a soft nav, so
  // the useState initialiser above never re-runs and the tab would otherwise
  // stay put while its pill lit up.
  useEffect(() => {
    if (!validInitialTab) return;
    setTab(validInitialTab);
  }, [validInitialTab]);
  const shellDrivesTabs = useAppShellActive();
  const visibleTabs = shellDrivesTabs ? TABS.filter((d) => !SHELL_TABS.includes(d.id)) : TABS;
  const [q, setQ] = useState('');
  const [shows, setShows] = useState<Show[] | null>(null);
  const [forYouShows, setForYouShows] = useState<Show[] | null>(null);
  const [nearCity, setNearCity] = useState<string | null>(null);
  const [nearRegion, setNearRegion] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ticketView, setTicketView] = useState<'active' | 'archive'>(initialTicketView === 'archive' ? 'archive' : 'active');
  const [ticketOrders, setTicketOrders] = useState<TicketOrder[] | null>(null);
  const contentTopRef = useRef<HTMLDivElement>(null);

  // Inside the app shell the shell owns scroll position across navigation
  // (ShellScrollManager) — the context strip's pills ARE the tab switch, so a
  // second owner here fights it and wins by running later, leaving the region
  // parked 141px down. Verified by e2e: expected 0, got 141. Outside the shell
  // (phone swipe shell, marketing) this is still the only thing that resets it.
  useEffect(() => {
    if (shellDrivesTabs) return;
    contentTopRef.current?.scrollIntoView({ block: 'start' });
  }, [tab, shellDrivesTabs]);

  const refreshDirectory = useCallback(() => {
    return fetch('/api/shows/directory')
      .then((r) => r.json())
      .then((d) => {
        setShows(d.shows ?? []);
        setForYouShows(d.forYouShows ?? d.shows ?? []);
        setNearCity(d.nearCity ?? null);
        setNearRegion(d.nearRegion ?? null);
        setLoggedIn(!!d.loggedIn);
      })
      .catch(() => { setShows([]); setForYouShows([]); });
  }, []);

  useEffect(() => {
    refreshDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshTickets = useCallback(() => {
    if (tab !== 'tickets' || !loggedIn) return Promise.resolve();
    setTicketOrders(null);
    return fetch(`/api/tickets?view=${ticketView}`)
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => setTicketOrders(d.orders ?? []))
      .catch(() => setTicketOrders([]));
  }, [tab, loggedIn, ticketView]);

  useEffect(() => {
    refreshTickets();
  }, [refreshTickets]);

  const refreshAll = useCallback(() => Promise.all([refreshDirectory(), refreshTickets()]), [refreshDirectory, refreshTickets]);

  const allShows = shows ?? [];
  const forYouShownList = forYouShows ?? [];

  // Local now covers both exact-city and same-state/region shows — city
  // matches are tagged plain, region-only matches get an "· Regional" tag
  // (below) and sort after the city matches within the list.
  const localShows = nearCity || nearRegion
    ? allShows
        .filter((s) => {
          const city = (s.venueProfile?.city ?? '').toLowerCase();
          const region = (s.venueProfile?.stateRegion ?? '').toLowerCase();
          const cityMatch = Boolean(nearCity) && city === nearCity!.toLowerCase();
          const regionMatch = Boolean(nearRegion) && region === nearRegion!.toLowerCase();
          return cityMatch || regionMatch;
        })
        .map((s) => ({ ...s, isRegional: nearCity ? (s.venueProfile?.city ?? '').toLowerCase() !== nearCity.toLowerCase() : false }))
        .sort((a, b) => Number(a.isRegional) - Number(b.isRegional))
    : allShows;
  const ql = q.trim().toLowerCase();
  const searchShows = ql
    ? allShows.filter((s) => `${s.title} ${s.headlinerProfile?.name ?? ''} ${s.venueProfile?.name ?? ''} ${s.venueProfile?.city ?? ''}`.toLowerCase().includes(ql))
    : [];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 100px' }}>
      <PullToRefresh onRefresh={refreshAll}>
      <div className="section-content">
      <div ref={contentTopRef} />

      {/* templates/discover/'s header block: mono eyebrow, display heading,
          one line of body. The heading here was `sr-only` — the page opened
          straight onto a tab strip with no statement of what it was, which is
          the single biggest reason it did not read as a designed surface. */}
      <header style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          {t('eventsHome.pageHeading', 'Events')}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 8px' }}>
          {t('eventsHome.pageTitle', 'Shows near you')}
        </h1>
        <p style={{ color: 'var(--ink-a55)', fontSize: '0.875rem', margin: 0 }}>
          {t('eventsHome.pageSub', 'Every ticket at face value — 70% artist, 20% venue, 10% promoters. iHYPE keeps none of it; card processing is Stripe’s and is shown before you pay.')}
        </p>
      </header>

      <div className="section-tabstrip" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {visibleTabs.map((tabItem) => (
          <button
            key={tabItem.id}
            className={tab === tabItem.id ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab(tabItem.id)}
            type="button"
          >
            {t(`eventsHome.tab.${tabItem.id}`, tabItem.label)}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="sub-panel">
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <svg fill="none" height="16" stroke="var(--ink-a50)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} viewBox="0 0 24 24" width="16">
              <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <input
              autoFocus
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('eventsHome.searchPlaceholder', 'Search artists, venues, shows…')}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--hair-30)', border: '1px solid var(--hair-80)', borderRadius: 12, padding: '14px 16px 14px 46px', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: '1rem' }}
              type="text"
              value={q}
            />
          </div>
          {!q.trim() ? (
            <div style={emptyStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--ink-a60)', margin: '14px 0 6px' }}>{t('eventsHome.searchHeading', 'Search events')}</h3>
              <p>{t('eventsHome.searchBody', 'Find shows by artist, venue, or city.')}</p>
            </div>
          ) : (
            <EventList emptyBody={t('eventsHome.searchEmptyBody', 'Try a different artist, venue, or city.')} emptyTitle={`${t('eventsHome.searchEmptyTitlePrefix', 'No results for')} "${q}"`} shows={searchShows} />
          )}
        </div>
      )}

      {tab === 'local' && (
        shows === null ? <div style={emptyStyle}><p>{t('eventsHome.loadingEvents', 'Loading events…')}</p></div> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a45)' }}>
                {nearCity || nearRegion
                  ? `${t('eventsHome.nearLabel', 'NEAR')} ${(nearCity ?? nearRegion)!.toUpperCase()}`
                  : t('eventsHome.allCitiesLabel', 'ALL CITIES — SET YOUR HOMETOWN IN SETTINGS TO LOCALIZE')}
              </div>
              <Link href="/shows/map" style={{ fontSize: '0.7812rem', color: 'var(--ink-a60)', flexShrink: 0 }}>{t('eventsHome.viewOnMap', 'View on map →')}</Link>
            </div>
            <EventList
              emptyBody={t('eventsHome.localEmptyBody', 'No shows in your city or region right now — check For You or Search instead.')}
              emptyTitle={t('eventsHome.emptyTitle', 'Nothing here yet')}
              shows={localShows}
            />
          </>
        )
      )}

      {tab === 'foryou' && (
        forYouShows === null ? <div style={emptyStyle}><p>{t('eventsHome.loadingEvents', 'Loading events…')}</p></div> : (
          <EventList
            emptyBody={t('eventsHome.forYouEmptyBody', "Hype some artists, swipe some seeds, or buy a ticket — we'll start surfacing shows that match your taste.")}
            emptyTitle={t('eventsHome.emptyTitle', 'Nothing here yet')}
            shows={forYouShownList}
          />
        )
      )}

      {tab === 'tickets' && (
        <div className="sub-panel">
          {!loggedIn ? (
            <div style={emptyStyle}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--ink-a60)', margin: '14px 0 6px' }}>{t('eventsHome.signInHeading', 'Sign in to see your tickets')}</h3>
              <Link href="/login?callbackUrl=/shows" style={{ display: 'inline-block', marginTop: 16, padding: '11px 20px', fontSize: '0.8125rem', background: 'var(--accent)', color: 'var(--ink-on-accent)', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>{t('eventsHome.logIn', 'Log in')}</Link>
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
                      border: `1px solid ${ticketView === v ? 'var(--accent)' : 'var(--hair-120)'}`,
                      background: ticketView === v ? 'rgba(var(--accent-rgb),.08)' : 'transparent',
                      fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 800, color: 'var(--ink)',
                    }}
                  >
                    {v === 'active' ? t('eventsHome.ticketsActive', 'Active') : t('eventsHome.ticketsArchive', 'Archive')}
                  </div>
                ))}
              </div>

              {ticketOrders === null ? (
                <div style={emptyStyle}><p>{t('eventsHome.loadingTickets', 'Loading tickets…')}</p></div>
              ) : ticketOrders.length === 0 ? (
                <div style={emptyStyle}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 800, color: 'var(--ink-a60)', margin: '14px 0 6px' }}>
                    {ticketView === 'archive' ? t('eventsHome.noPastTickets', 'No past tickets yet') : t('eventsHome.noTickets', 'No tickets yet')}
                  </h3>
                  <p>{ticketView === 'archive' ? t('eventsHome.archiveEmptyBody', "Shows you've attended or cancelled tickets land here.") : t('eventsHome.activeEmptyBody', 'Tickets you buy show up here with a QR for entry.')}</p>
                  {ticketView === 'active' && (
                    <button onClick={() => { setTab('local'); }} style={{ display: 'inline-block', marginTop: 16, padding: '11px 20px', fontSize: '0.8125rem', background: 'var(--accent)', color: 'var(--ink-on-accent)', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer' }} type="button">{t('eventsHome.browseEvents', 'Browse events')}</button>
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
                      <div key={order.id} style={{ border: '1px solid var(--hair-80)', borderRadius: 16, padding: 20, background: 'var(--hair-30)', opacity: ticketView === 'archive' ? 0.6 : 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', letterSpacing: '.14em', textTransform: 'uppercase', color: order.status === 'VOID' ? 'var(--accent)' : 'var(--role-venue)', marginBottom: 6 }}>
                          ● {order.status === 'VOID' ? t('eventsHome.statusCancelled', 'CANCELLED') : ticketView === 'archive' ? t('eventsHome.statusUsed', 'USED') : t('eventsHome.statusValid', 'VALID')} · {formatCurrencyFromCents(unitPriceCents)} {t('eventsHome.faceValue', 'FACE VALUE')}
                        </div>
                        <Link href={`/shows/${order.show.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, letterSpacing: '-.01em', marginBottom: 3 }}>{order.show.title}</div>
                        </Link>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginBottom: 14 }}>
                          {dateStr} · {timeStr}
                        </div>
                        {ticketView === 'active' && order.status !== 'VOID' && (
                          <TicketCardActions orderId={order.id} orderStatus={order.status} showsAt={order.show.startsAt} tickets={order.tickets} />
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
      </PullToRefresh>
      <style>{`
        /* templates/discover/, #dsc-shows: auto-fill at a 260px floor. One
           column on a 375px phone, four at 1000px, and no breakpoint to keep
           in sync — which is why the template uses auto-fill rather than a
           media query per width. */
        .ev-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
        .ev-card { transition: border-color .16s ease; }
        .ev-card:hover { border-color: rgba(var(--accent-rgb), .35); }
        @media (prefers-reduced-motion: reduce) { .ev-card { transition: none; } }
      `}</style>
    </div>
  );
}
