/**
 * iHYPE API Client — lib/api.js
 * Works in two modes:
 *   MOCK  — no backend needed; uses window.IHYPE_DATA + localStorage (default in beta)
 *   REAL  — set window.IHYPE_API_BASE = 'https://api.ihype.app/v1' before loading
 *
 * Usage (after loading this script):
 *   const api = window.IHYPE_API;
 *   const { jwt, user } = await api.auth.verify(token);
 *   const events        = await api.feed.events({ city:'LA' });
 *   await api.hype.send('artist', artistId);
 *
 * All methods return plain objects or throw { status, message }.
 * In MOCK mode, network latency is simulated (~120ms).
 */

(function () {
  'use strict';

  /* ── config ──────────────────────────────────────────────────────── */
  const BASE  = () => window.IHYPE_API_BASE || null;  // null = mock mode
  const MOCK  = () => !BASE();
  const DELAY = (ms = 120) => new Promise(r => setTimeout(r, ms));
  const BETA_CODES = ['IHYPE','HYPE2026','BETA','LISTEN'];

  /* ── JWT store ───────────────────────────────────────────────────── */
  const Token = {
    get: ()    => { try { return localStorage.getItem('ihype_jwt'); } catch { return null; } },
    set: (t)   => { try { localStorage.setItem('ihype_jwt', t); } catch {} },
    clear: ()  => { try { localStorage.removeItem('ihype_jwt'); } catch {} },
  };

  /* ── base fetch ──────────────────────────────────────────────────── */
  async function req(method, path, body) {
    if (MOCK()) throw new Error('req() called in mock mode — this is a bug');
    const headers = { 'Content-Type': 'application/json' };
    const jwt = Token.get();
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    const res = await fetch(BASE() + path, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, message: json.message || res.statusText };
    return json;
  }
  const GET    = (path)       => req('GET',    path);
  const POST   = (path, body) => req('POST',   path, body);
  const DELETE = (path)       => req('DELETE', path);

  /* ── mock helpers ────────────────────────────────────────────────── */
  function mockUser(prefs) {
    return {
      id:           'u_' + Math.random().toString(36).slice(2,8),
      handle:       prefs?.handle || 'demo_user',
      display_name: prefs?.displayName || 'Demo User',
      email:        prefs?.email || 'demo@ihype.app',
      city:         prefs?.city  || 'Los Angeles',
      genres:       prefs?.genres || ['dream-pop','lo-fi','electronic'],
      roles:        [prefs?.role || 'fan'],
      verified:     false,
    };
  }
  function mockJWT() { return 'mock_jwt_' + Date.now(); }
  function getPrefs() {
    try { return JSON.parse(localStorage.getItem('ihype_onboarded_v2')); } catch { return null; }
  }
  function D() { return window.IHYPE_DATA || {}; }

  /* ══════════════════════════════════════════════════════════════════
     AUTH
  ══════════════════════════════════════════════════════════════════ */
  const auth = {
    /** Send magic-link email */
    async sendMagicLink(email) {
      if (MOCK()) { await DELAY(); return null; }
      return POST('/auth/magic-link', { email });
    },

    /** Exchange token → JWT + user */
    async verify(token) {
      if (MOCK()) {
        await DELAY();
        const prefs = getPrefs();
        const user  = mockUser(prefs);
        const jwt   = mockJWT();
        Token.set(jwt);
        window.IHYPE_USER_PREFS = prefs || {};
        return { jwt, user };
      }
      const data = await POST('/auth/verify', { token });
      Token.set(data.jwt);
      return data;
    },

    /** Redeem closed-beta invite code */
    async betaRedeem(code) {
      if (MOCK()) {
        await DELAY(80);
        if (BETA_CODES.includes(code.trim().toUpperCase())) {
          localStorage.setItem('ihype_beta_ok', '1');
          window.track && window.track('beta_gate_pass', { code });
          return null; // 204 ok
        }
        throw { status: 403, message: 'Invalid invite code' };
      }
      return POST('/auth/beta-redeem', { code });
    },

    /** Join public waitlist (no auth required) */
    async joinWaitlist(email, role = 'fan') {
      if (MOCK()) {
        await DELAY(200);
        const wl = JSON.parse(localStorage.getItem('ihype_waitlist') || '[]');
        if (!wl.find(e => e.email === email)) {
          wl.push({ email, role, ts: Date.now() });
          localStorage.setItem('ihype_waitlist', JSON.stringify(wl));
        }
        window.track && window.track('waitlist_join', { email, role });
        return null;
      }
      // In production: POST /v1/waitlist (not in OpenAPI yet — engineering to add)
      return POST('/waitlist', { email, role });
    },

    /** Artist application */
    async artistApply(fields) {
      if (MOCK()) {
        await DELAY(200);
        const apps = JSON.parse(localStorage.getItem('ihype_artist_apps') || '[]');
        apps.push({ ...fields, ts: Date.now() });
        localStorage.setItem('ihype_artist_apps', JSON.stringify(apps));
        window.track && window.track('artist_apply', fields);
        return null;
      }
      return POST('/artist-apply', fields);
    },

    logout() {
      Token.clear();
      window.IHYPE_USER_PREFS = null;
    },

    get isAuthed() { return !!Token.get(); },
  };

  /* ══════════════════════════════════════════════════════════════════
     FEED / DISCOVERY
  ══════════════════════════════════════════════════════════════════ */
  const feed = {
    async listen({ city, genres } = {}) {
      if (MOCK()) {
        await DELAY();
        let artists = D().artists || [];
        if (genres?.length) artists = artists.filter(a => a.genres?.some(g => genres.includes(g)));
        if (city) artists = artists.filter(a => !a.city || a.city === city).concat(artists.filter(a => a.city && a.city !== city));
        return { artists };
      }
      return GET(`/feed/listen?city=${city||''}&genres=${(genres||[]).join(',')}`);
    },

    async events({ city, scope = 'local' } = {}) {
      if (MOCK()) {
        await DELAY();
        let evts = D().events || [];
        if (city) evts = evts.filter(e => !e.city || e.city === city);
        return { events: evts };
      }
      return GET(`/feed/events?city=${city||''}&scope=${scope}`);
    },

    async search(q) {
      if (MOCK()) {
        await DELAY(80);
        const qq = q.toLowerCase();
        const D_ = D();
        return {
          artists: (D_.artists||[]).filter(a => a.name?.toLowerCase().includes(qq)),
          events:  (D_.events ||[]).filter(e => e.title?.toLowerCase().includes(qq)),
          tracks:  (D_.tracks ||[]).filter(t => t.title?.toLowerCase().includes(qq)),
          venues:  [],
        };
      }
      return GET(`/search?q=${encodeURIComponent(q)}`);
    },

    async hypeChart({ window: w = 'week' } = {}) {
      if (MOCK()) {
        await DELAY();
        const artists = D().artists || [];
        return { artists: [...artists].sort((a,b) => (b.hype||0)-(a.hype||0)) };
      }
      return GET(`/charts/hype?window=${w}`);
    },
  };

  /* ══════════════════════════════════════════════════════════════════
     HYPE
  ══════════════════════════════════════════════════════════════════ */
  const hype = {
    /** Get remaining weekly budget */
    async budget() {
      if (MOCK()) {
        await DELAY(60);
        const spent = parseInt(localStorage.getItem('ihype_hypes_spent') || '0');
        const cap   = 50;
        return { left: Math.max(0, cap - spent), resets_at: _nextMonday() };
      }
      return GET('/hype/budget');
    },

    /** Send a hype */
    async send(target_type, target_id) {
      if (MOCK()) {
        await DELAY(80);
        const spent = parseInt(localStorage.getItem('ihype_hypes_spent') || '0');
        if (spent >= 50) throw { status: 429, message: 'Weekly hype budget exhausted' };
        localStorage.setItem('ihype_hypes_spent', spent + 1);
        window.track && window.track('hype', { target_type, target_id });
        return { hypes_left: 49 - spent };
      }
      return POST('/hype', { target_type, target_id });
    },
  };

  /* ══════════════════════════════════════════════════════════════════
     EVENTS & TICKETING
  ══════════════════════════════════════════════════════════════════ */
  const ticketing = {
    async getEvent(id) {
      if (MOCK()) {
        await DELAY();
        const ev = (D().events||[]).find(e => e.id === id);
        if (!ev) throw { status: 404, message: 'Event not found' };
        return ev;
      }
      return GET(`/events/${id}`);
    },

    async availability(eventId) {
      if (MOCK()) {
        await DELAY(60);
        return { remaining: 48, waitlist: false };
      }
      return GET(`/events/${eventId}/tickets/availability`);
    },

    /** Buy ticket — MOCK: creates a local record (simulated). Real: banking-gated. */
    async buyTicket(event_id, referral_code = null) {
      if (MOCK()) {
        await DELAY(400);
        const tickets = JSON.parse(localStorage.getItem('ihype_tickets') || '[]');
        const ticket  = {
          id:            'tk_' + Math.random().toString(36).slice(2,10),
          event_id,
          referral_code,
          status:        'valid',
          qr_token:      Math.random().toString(36).slice(2,18),
          created_at:    new Date().toISOString(),
          _simulated:    true,
        };
        tickets.push(ticket);
        localStorage.setItem('ihype_tickets', JSON.stringify(tickets));
        window.track && window.track('ticket_purchase', { event_id, referral_code, _simulated: true });
        return ticket;
      }
      // Real: POST /tickets → Stripe payment intent
      return POST('/tickets', { event_id, referral_code });
    },

    async myTickets() {
      if (MOCK()) {
        await DELAY();
        const tickets = JSON.parse(localStorage.getItem('ihype_tickets') || '[]');
        return { tickets };
      }
      return GET('/me/tickets');
    },
  };

  /* ══════════════════════════════════════════════════════════════════
     REFERRALS
  ══════════════════════════════════════════════════════════════════ */
  const referrals = {
    async create(event_id) {
      if (MOCK()) {
        await DELAY();
        const prefs  = getPrefs() || {};
        const code   = (prefs.handle || 'demo') + '-' + event_id.slice(-4) + '-' + Math.random().toString(36).slice(2,6);
        const url    = `https://ihype.app/e/${event_id}?ref=${code}`;
        window.track && window.track('referral_create', { event_id, code });
        return { code, share_url: url };
      }
      return POST('/referrals', { event_id });
    },

    async myEarnings() {
      if (MOCK()) {
        await DELAY();
        return {
          referrals: [
            { code: 'demo-nyla-x7k2', event: 'Nyla — Glasslight Tour', status: 'accruing', gross_driven_cents: 5600, earned_cents: 252 },
            { code: 'demo-echo-k9p1', event: 'Midnight Echo Live',     status: 'locked',   gross_driven_cents: 2200, earned_cents: 99 },
          ],
          total_earned_cents: 351,
          pending_cents: 252,
          cleared_cents: 99,
        };
      }
      return GET('/me/referrals');
    },
  };

  /* ══════════════════════════════════════════════════════════════════
     RADIO STUDIO
  ══════════════════════════════════════════════════════════════════ */
  const studio = {
    async library({ free_use = true } = {}) {
      if (MOCK()) {
        await DELAY();
        const tracks = (D().tracks || []).filter(t => !free_use || t.license === 'free_use_limited');
        return { tracks };
      }
      return GET(`/library?free_use=${free_use}`);
    },

    async addToCrate(track_id) {
      if (MOCK()) {
        await DELAY(80);
        const crate = JSON.parse(localStorage.getItem('ihype_crate') || '[]');
        if (!crate.includes(track_id)) crate.push(track_id);
        localStorage.setItem('ihype_crate', JSON.stringify(crate));
        return null;
      }
      return POST('/crate', { track_id });
    },

    async sfx() {
      if (MOCK()) {
        await DELAY();
        return { sfx: D().sfx || [] };
      }
      return GET('/sfx');
    },

    async saveShow(show) {
      if (MOCK()) {
        await DELAY(200);
        const shows = JSON.parse(localStorage.getItem('ihype_shows') || '[]');
        const id = show.id || 'rs_' + Date.now();
        const idx = shows.findIndex(s => s.id === id);
        if (idx >= 0) shows[idx] = { ...show, id }; else shows.push({ ...show, id });
        localStorage.setItem('ihype_shows', JSON.stringify(shows));
        return { id };
      }
      return POST('/radio-shows', show);
    },
  };

  /* ══════════════════════════════════════════════════════════════════
     TELEMETRY
  ══════════════════════════════════════════════════════════════════ */
  const telemetry = {
    async track(event, props = {}) {
      // Fire-and-forget — never await in hot paths
      if (MOCK()) {
        try {
          const log = JSON.parse(localStorage.getItem('ihype_track_log') || '[]');
          log.push({ event, props, ts: Date.now() });
          if (log.length > 200) log.splice(0, log.length - 200);
          localStorage.setItem('ihype_track_log', JSON.stringify(log));
        } catch {}
        return;
      }
      fetch(BASE() + '/events/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, props }),
        keepalive: true,
      }).catch(() => {});
    },
  };

  /* ══════════════════════════════════════════════════════════════════
     PAYOUTS  (banking-gated — all mock until nonprofit status clears)
  ══════════════════════════════════════════════════════════════════ */
  const payouts = {
    async balance() {
      if (MOCK()) { await DELAY(); return { available: 0, pending: 351, _banking_gated: true }; }
      return GET('/me/balance');
    },
    async requestPayout(amount_cents) {
      throw { status: 503, message: '⚠ Payouts are banking-gated — live once nonprofit status clears.', _banking_gated: true };
    },
  };

  /* ── helpers ─────────────────────────────────────────────────────── */
  function _nextMonday() {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    d.setHours(0,0,0,0);
    return d.toISOString();
  }

  /* ── public API ──────────────────────────────────────────────────── */
  const IHYPE_API = {
    auth,
    feed,
    hype,
    ticketing,
    referrals,
    studio,
    telemetry,
    payouts,
    get isMock() { return MOCK(); },
    get base()   { return BASE(); },
    /** Set real API base — call before using real mode */
    setBase(url) { window.IHYPE_API_BASE = url; },
  };

  window.IHYPE_API = IHYPE_API;

  // Override the global track() stub to go through the API
  window.track = (event, props) => telemetry.track(event, props);

  if (MOCK()) {
    console.info('[iHYPE API] Running in MOCK mode. Set window.IHYPE_API_BASE to switch to real mode.');
  } else {
    console.info('[iHYPE API] Running against', BASE());
  }
})();
