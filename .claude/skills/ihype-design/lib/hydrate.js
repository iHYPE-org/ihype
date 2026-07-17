/**
 * iHYPE Hydration Layer — lib/hydrate.js
 * Load AFTER lib/api.js and data.js.
 *
 * MOCK mode (default): does nothing — window.IHYPE_DATA from data.js stands.
 * REAL mode (window.IHYPE_API_BASE set): fetches live data via IHYPE_API,
 * maps API rows into the IHYPE_DATA shape the UI reads, then dispatches
 * 'ihype:data' so the shell re-renders. Components stay untouched.
 *
 * Also bridges WRITES: hype sends, ticket purchases, referral mints go
 * through IHYPE_API in real mode (fire-and-forget with optimistic UI).
 */
(function () {
  'use strict';
  const REAL = () => !!window.IHYPE_API_BASE;

  /* ── row mappers: API schema → IHYPE_DATA shape ─────────────────── */
  const mapEvent = (e) => ({
    id: e.id, artist: e.artist_name || e.artist_id, title: e.title,
    venue: e.venue_name || '', city: e.city,
    date: e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    price: Math.round((e.price_cents || 0) / 100),
    status: e.status === 'live' ? 'LIVE' : (e.status || '').toUpperCase(),
    tint: e.tint || '#ff5029',
  });
  const mapTrack = (t) => ({
    id: t.id, artist: t.artist_name || t.artist_id, track: t.title,
    dur: t.duration_s, tint: t.tint || '#ff3e9a', freeUse: !!t.free_use,
  });

  async function hydrate() {
    if (!REAL()) return;
    const api = window.IHYPE_API;
    if (!api) return console.error('hydrate.js: IHYPE_API missing — load lib/api.js first');
    const D = window.IHYPE_DATA = window.IHYPE_DATA || {};
    const prefs = window.IHYPE_USER_PREFS || {};
    const results = await Promise.allSettled([
      api.feed.events({ city: prefs.city, scope: 'local' }),
      api.feed.listen({ city: prefs.city, genres: (prefs.genres || []).join(',') }),
      api.feed.hypeChart({ window: 'week' }),
      api.studio.library({ free_use: true }),
      api.ticketing.myTickets(),
      api.referrals.myEarnings(),
    ]);
    const [events, listen, chart, lib, tickets, refs] = results.map(r => r.status === 'fulfilled' ? r.value : null);
    if (events) D.shows = (events.events || events).map(mapEvent);
    if (listen) {
      if (listen.seeds)  D.seeds  = listen.seeds.map(mapTrack);
      if (listen.tracks) D.tracks = listen.tracks.map(mapTrack);
    }
    if (chart)   D.demand = (chart.artists || chart).map(a => ({ artist: a.display_name || a.handle, trend: a.trend || '+0%' }));
    if (lib)     D.freeUseLibrary = (lib.tracks || lib).map(mapTrack);
    if (tickets) D.myTickets = tickets.tickets || tickets;
    if (refs)    D.myReferrals = refs.referrals || refs;
    window.dispatchEvent(new CustomEvent('ihype:data'));
  }

  /* ── write bridges (optimistic; API call in real mode) ──────────── */
  const orig = {};
  function bridge(name, fn) {
    Object.defineProperty(window, name, {
      configurable: true,
      get() { return orig[name] ? wrap : undefined; },
      set(v) { orig[name] = v; },
    });
    const wrap = function () {
      const r = orig[name] && orig[name].apply(this, arguments);
      if (REAL()) { try { fn.apply(null, arguments); } catch (e) { console.warn('hydrate bridge', name, e); } }
      return r;
    };
  }
  // hype: components call window.IHYPE_SEND_HYPE(targetType, targetId) if defined
  window.IHYPE_SEND_HYPE = function (type, id) {
    if (REAL()) window.IHYPE_API.hype.send(type, id).catch(e => console.warn('hype sync failed', e));
    else window.IHYPE_API && window.IHYPE_API.hype.send(type, id).catch(() => {});
  };
  // purchase: components call window.IHYPE_PURCHASE(eventId, referralCode) if defined
  window.IHYPE_PURCHASE = function (eventId, code) {
    return window.IHYPE_API.ticketing.buyTicket(eventId, code);
  };
  void bridge; // reserved for wrapping legacy window.* handlers if needed

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate);
  else hydrate();
  window.IHYPE_HYDRATE = hydrate; // manual refresh: await IHYPE_HYDRATE()
})();
