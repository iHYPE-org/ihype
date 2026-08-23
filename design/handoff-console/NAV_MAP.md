# Navigation map — console design ↔ production routes ↔ backend wiring

Read from `iHYPE-org/ihype@main` (`src/app/**/page.tsx`, 110 pages), 2026-08-23.
This is the overwrite plan: production's `/app` shell keeps its routes and its
API calls; every screen's markup is replaced by the console design. **Routes
and wiring stay; pixels change.**

## The shell (Console Dock.dc.html)

Production already routes the console's three modules:

| Prod route | Console module | Backend wiring |
|---|---|---|
| `/app/map` | MAP · treasure chart | `GET /api/map/venues`, `/api/map/artists`, `/api/map/events` |
| `/app/music/[tab]` | MUSIC · 5 dial sections (discover/radio/charts/recommended/playlists) | `GET /api/feed`, `/api/seeds`, `/api/charts`, `/api/playlists` |
| `/app/me` + `/app/me/[panel]` | ME · Tickets / Settings / Info / Legal rows | `GET /api/me`, `/api/tickets` |

The dock IS the router for these three: knob = module (`/app/map` ↔ `/app/music/*` ↔ `/app/me`),
thumbwheel = the `[tab]`/`[panel]` segment, joystick = player transport.
`src/lib/mmm-nav.ts` already models this — the dock's three controls map onto
its nav table 1:1; wire knob/wheel events to `router.push` of the same paths.

## Screens built (Console Surfaces.dc.html)

| S# | Design screen | Prod route | Key endpoints | Dock |
|---|---|---|---|---|
| S1 | Auth · sign in | `/login`, `/register` | `POST /api/auth/magic` | no (pre-auth) |
| S2 | Magic link sent | `/auth/magic` | (link lands → session) | no |
| S3 | Onboarding | `/welcome` | `PATCH /api/me` (role, city, genres) | no |
| S4 | Checkout | `/shows/[slug]` purchase sheet | `POST /api/checkout` (Stripe), split from show record | yes |
| S5 | Ticket | `/app/me/tickets/[serializedId]` | `GET /api/tickets/[id]` — QR, status, holder/order/scan | yes |
| S6 | Profile · artist | `/app/artists/[slug]` | `GET /api/profiles/[slug]`, `POST /api/hype` (429 window + ledger) | yes |
| S7 | Event create | `/app/me/events/new` | `POST /api/events` — 3-step, payout preview from charter | yes |
| S8 | Payouts | `/app/me/payouts` (+ `[id]` detail) | `GET /api/payouts` — Stripe Connect transfers | yes |

## Not yet designed (exists in prod, keeps current UI until skinned)

- Public marketing: `/` (landing), `/about`, `/charter`, `/for-{artists,fans,venues}`,
  `/join`, `/launch`, `/journal` — the DS has templates for most
  (`templates/landing/`, `about/`, `charter/`, `artist-kit/`, `fan-kit/`).
- Role back-office: `/app/me/{artists,venues}/[slug]/{dashboard,analytics,…}`,
  `/app/me/booking`, `/app/me/advertising` — desktop-density; do these after
  the fan surfaces prove the style.
- `/admin/*` (20 pages): out of scope for the console skin — internal tooling.
- Detail pages: `/app/shows/[slug]`, `/app/tracks/[hexId]`, `/app/venues/[slug]`,
  `/app/fans/[slug]`, `/app/playlists/[id]` — compose from S6's flattened
  profile pattern (V10 rules).

## Overwrite order (each step shippable)

1. **Tokens + fonts** — add the handoff CSS (`css/ihype-console.css`) to the
   prod bundle; `mmm.css` already reads tokens, so this alone recolors the shell.
2. **The dock** — mount RotaryNav/TunerDial/JoystickTransport in the `/app`
   layout, wired to `mmm-nav.ts` paths. One layout file.
3. **MAP** — treasure tile filter + parchment HUD onto the existing Leaflet map.
4. **MUSIC + ME panes** — V10 paper rules: strip gradients/shadows from pane
   markup, keep every fetch.
5. **S4–S8 screens** — replace each page's JSX with the console markup,
   preserving its existing data hooks (each page keeps its own `fetch`/SWR).
6. **Marketing pages** — from the DS templates, last.

## Contracts already settled

- HYPE button: 4 states from `/api/hype` (spendable / `HYPE_WINDOW_OPEN` 429 /
  `INSUFFICIENT_HYPE` 409 / own-target) — see BACKEND_RECONCILED.md.
- Dock geometry: 93px constant; safe-area pads beneath, never grows it.
- Pre-auth screens (S1–S3) never show the dock.
