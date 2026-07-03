# iHYPE Design Sync Workflow
# ──────────────────────────────────────────────────────────
# How each design iteration flows from Claude Design → ihype.org
#
# PIPELINE:
#   Claude Design (.dc.html) → GitHub (src/app/*.tsx) → Cloudflare → ihype.org
#
# AGENTS:
#   Claude Design  — owns .dc.html files + design system
#   Claude Code    — owns src/app/ + API + database
#   Both           — read this file to stay in sync

---

## Step 1 · Design changes in Claude Design

When a page is updated, this file is edited:
  - DESIGN_SYNC.md → add entry to [PENDING CHANGES] below
  - .dc.html page updated
  - Ready for Claude Code to implement

---

## Step 2 · Claude Code reads DESIGN_SYNC.md

Claude Code checks [PENDING CHANGES] and for each entry:
  1. Opens the .dc.html URL listed
  2. Translates HTML/CSS/JS → Next.js page + components
  3. Wires the API calls listed under each change
  4. Marks the entry as [DONE] with commit SHA

---

## Step 3 · GitHub → Cloudflare → ihype.org (automatic)

  git push origin main
  → GitHub Actions: deploy-production.yml runs
  → OpenNext builds → Cloudflare Workers deploys
  → Live at ihype.org within ~2 minutes

---

## Page Map · .dc.html → Next.js route

| Design File          | Next.js Route              | src/app path                    |
|----------------------|----------------------------|---------------------------------|
| Index.dc.html        | /                          | src/app/page.tsx                |
| Auth.dc.html         | /login + /register         | src/app/auth/*/page.tsx         |
| Legal.dc.html        | /legal + /privacy + /terms | src/app/legal/page.tsx (tabs) |
| Home.dc.html         | /home                      | src/app/home/page.tsx           |
| FanHome.dc.html      | /home (role=fan)           | src/app/home/page.tsx           |
| Profile.dc.html      | /profile                   | src/app/profile/page.tsx        |
| Studio.dc.html (REMOVED)  | — deprecated —             | — (see row 52 in changelog)     |
| Show.dc.html         | /shows/[slug]              | src/app/shows/[slug]/page.tsx   |
| Artist.dc.html       | /artists/[slug]            | src/app/artists/[slug]/page.tsx |
| Tickets.dc.html      | /me/tickets                | src/app/tickets/page.tsx        |
| WebRadio.dc.html     | /radio                     | src/app/radio/page.tsx          |
| Payout.dc.html       | /payout/[eventId]          | src/app/payout/[id]/page.tsx    |
| PromoterHome.dc.html | /home (role=promoter)      | src/app/home/page.tsx           |
| EventCreator.dc.html | /events/new                | src/app/events/new/page.tsx     |
| Verification.dc.html | /verify                    | src/app/verify/page.tsx         |
| AdminDash.dc.html    | /admin                     | src/app/admin/page.tsx          |
| Beta.dc.html (REMOVED)   | — deprecated, TestFlight copy in Email.dc.html — | — |
| DJProfile.dc.html    | /artists/[slug] (role=dj)  | src/app/artists/[slug]/page.tsx |
| Notifications.dc.html| /me/notifications          | src/app/notifications/page.tsx  |
| Support.dc.html      | /support                   | src/app/support/page.tsx        |
| Search.dc.html       | /search                    | src/app/search/page.tsx         |
| Settings.dc.html     | /me/settings               | src/app/settings/page.tsx       |
| FanProfile.dc.html   | /fans/[slug]               | src/app/fans/[slug]/page.tsx    |
| Venue.dc.html        | /venues/[slug]             | src/app/venues/[slug]/page.tsx  |
| Welcome.dc.html      | /welcome                   | src/app/welcome/page.tsx        |
| Offline.dc.html      | /offline + error(500/503)  | src/app/offline/page.tsx + error.tsx + global-error.tsx |
| 404.dc.html          | not-found (404)            | src/app/not-found.tsx           |
| Charter.dc.html      | /charter                   | src/app/charter/page.tsx        |
| Sitemap.dc.html (REMOVED) | — deprecated, no longer used — | — |
| Mobile.dc.html (REMOVED)  | — deprecated, mobile kit removed — | — |
| Email.dc.html        | — email templates —        | src/lib/email/templates/        |

### ⚠ Route-ownership resolutions
**Updated 2026-06-30 (v2) — supersedes earlier legal-split decision:**
- **Legal.dc.html is the single CANONICAL legal page** with three in-page tabs (Privacy · Terms · Charter) serving `/legal`, `/privacy`, and `/terms`. Standalone `Privacy.dc.html` and `Terms.dc.html` were **DELETED** (redundant) — their content is merged into Legal's tabs. Charter also keeps its standalone `/charter` page (Charter.dc.html). Route `/privacy` and `/terms` to Legal (deep-link the matching tab).
- **`Radio.dc.html` (DJ Studio) DELETED** — superseded by WebRadio.dc.html, which now owns `/radio`. DJ go-live / schedule / manage / edit actions repointed to **Studio.dc.html** (creator workbench). If a dedicated DJ broadcast console is needed later, add it as a Studio tab, not a separate page.
- **`Discover.dc.html` DELETED** — redundant with Search + Charts + Seeds (FanHome). Its links were removed from Sitemap.
- **404 vs Offline** — unchanged: 404.dc.html → `not-found.tsx`; Offline.dc.html → `error.tsx`/`global-error.tsx` + `/offline`.
- **Global footer** — NavShell now injects a fixed footer bar (Legal | Support | © 2026 ihype.org) on every page; header + footer are solid (no transparency/blur).

---

## Design Token Map · DS → Next.js globals.css

Claude Code: copy these into src/app/globals.css

```css
/* iHYPE Design Tokens — auto-synced from DS 39bcce7b */

:root {
  /* Backgrounds */
  --bg:  #0a0805;
  --bg2: #100d09;
  --bg3: #1a1611;
  --bg4: #241d18;

  /* Text */
  --ink:  #f0ebe5;
  --line: rgba(255, 255, 255, 0.06);

  /* Brand */
  --accent:    #ff5029;   /* iHYPE orange-red */

  /* Roles */
  --fan:       #b983ff;   /* purple */
  --venue:     #22e5d4;   /* teal */
  --promoter:  #ff3e9a;   /* pink */
  --artist:    #ff5029;   /* same as accent */

  /* Typography */
  --font-display: 'Syne', sans-serif;         /* 800 weight only */
  --font-body:    'DM Sans', sans-serif;       /* 400/500 */
  --font-mono:    'JetBrains Mono', monospace; /* labels, ALL CAPS */
  --font-serif:   'Instrument Serif', serif;   /* italic, editorial */

  /* Radius */
  --radius-sm:  8px;
  --radius-md:  10px;
  --radius-lg:  24px;
  --radius-xl:  32px;
  --radius-pill: 9999px;

  /* Motion */
  --ease-spring: cubic-bezier(0.2, 0.7, 0.3, 1);
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
}
```

---

## API Client · lib/api.js → src/lib/api.ts

Claude Code: the design API client (lib/api.js) maps 1:1 to the Next.js API routes.
For server components, use `db.*` directly. For client components, use fetch or SWR.

```typescript
// Pattern used in all .dc.html pages:
const shows = await API.events.list({ city: 'San Francisco' });

// Next.js server component equivalent:
const shows = await db.event.findMany({
  where: { city: 'San Francisco', status: 'PUBLISHED' },
  orderBy: { startsAt: 'asc' }
});
```

---

## API ALIGNMENT & GAPS · reconciled against lib/api.js (2026-06-30)

**Authoritative:** `lib/api.js` is the real client surface. Earlier RECONCILE rows (20–42) carried *guessed* endpoints — use the table below instead. Endpoints marked **GAP** do not exist in `lib/api.js` yet; Claude Code must add them to **both** `lib/api.js` (design) and `src/app/api/*` (backend) so the two sides line up when merged. Until a GAP is filled, the page runs on `MOCK` fallback.

### Correct endpoints for pending RECONCILE pages
| Page / row | Use these (exist in lib/api.js) | GAPs to add |
|---|---|---|
| Home #20 | `API.feed.listen()` GET /feed/listen · `API.feed.events()` GET /feed/events | — (no `/feed/home`; compose from these) |
| Profile #21 | `API.me.get()` GET /me | — |
| Artist #22 | `API.artists.get(slug)` /artists/:slug · `.tracks` · `.events` | — |
| DJProfile #23 | `API.artists.get(slug)` (role=dj) · `API.radio.list()` GET /radio-shows | `/artists/:slug/radio-archive` (DJ replay list) |
| FanProfile #24 | `API.me.get()` for self | **GAP** `/fans/:slug` (public fan profile) |
| Venue #25 | `API.venues.get(slug)` /venues/:slug · `.events` | — |
| Tickets #26 | `API.me.tickets()` GET /me/tickets · `API.tickets.get(id)` | — |
| Discover #27 | `API.feed.listen()` · `API.hype.charts()` /charts/hype · `API.artists.list()` | — (no single `/discover`; compose) |
| Search #28 | `API.search.query(q,type)` GET /search?q=&type= | — |
| Notifications #29 | — | **GAP** `/me/notifications` (GET) + `/notifications/:id/read` (POST) |
| Settings #30 | `API.me.get()` GET /me · `API.me.update()` PUT /me | — (no `/me/settings`; use /me) |
| Welcome #31 | — (static, role from `API.auth.currentUser()`) | — |
| Payout #32 | `API.me.earnings()` GET /me/earnings · `API.events.get(id)` | **GAP** `/payout/:eventId` (per-event receipt) — or derive from earnings+event |
| PromoterHome #33 | `API.me.referrals()` GET /me/referrals · `API.referrals.create(eventId)` · `API.referrals.get(code)` | — (no `/referral/track`; tracking is server-side on link hit) |
| EventCreator #34 | `API.events.create(data)` POST /events · `API.events.publish(id)` | — |
| Verification #35 | `API.admin.verifications()` (reviewer side) | **GAP** `/verify` (POST — applicant proof submission) |
| AdminDash #36 | `API.admin.verifications()` · `.users()` · `.finance()` · `.audit()` · `.moderation()` | — (no bare `/admin`; use sub-routes) |
| Support #37 | `API.support.submit(data)` POST /support | — |
| Beta #38 | — | **GAP** `/beta/join` (POST — TestFlight waitlist) |
| Legal #39 / Privacy #40 / Terms #41 | — (static) · optional `API.transparency.get()` | — |
| Email #42 | — (server-rendered templates) | — |
| WebRadio #19 / Radio #5 | `API.radio.list()` GET /radio-shows · `API.radio.create()` · `API.radio.library()` · `API.radio.addToCrate()` | **GAP** `/radio-shows/:id/replay` · live/record endpoints (`/radio/live`, `/radio/record`) |
| Studio #2 | `API.events.create()` · `API.me.earnings()` · `API.hype.charts()` | — |

### Consolidated GAP list — add to lib/api.js AND src/app/api (both agents)
1. `GET /fans/:slug` → `API.fans.get(slug)` — public fan profile
2. `GET /me/notifications` + `POST /notifications/:id/read` → `API.notifications.list()` / `.markRead(id)`
3. `GET /payout/:eventId` → `API.payouts.get(eventId)` — post-event receipt (45/45/10)
4. `POST /verify` → `API.verify.submit(data)` — applicant proof submission (distinct from admin review)
5. `POST /beta/join` → `API.beta.join(email)` — TestFlight waitlist
6. `GET /radio-shows/:id/replay` → `API.radio.replay(id)` + live/record: `POST /radio/live`, `POST /radio/record`
7. `GET /artists/:slug/radio-archive` → `API.artists.radioArchive(slug)` — DJ show archive

> **Merge rule:** a GAP endpoint must be added to `lib/api.js` in the SAME change that implements the page's `.tsx`, and the route must exist under `src/app/api/`. Add each new method to the "API Client" 1:1 map above so the design ↔ backend surfaces never drift again.

---

1. **Design is source of truth for:** layout, copy, colors, component structure
2. **Code is source of truth for:** data shapes, auth logic, business rules
3. **Never diverge on:** 45/45/10 split, $0 fees copy, role colors
4. **Always sync on:** major layout changes, new pages, removed features

---

## PENDING CHANGES
<!-- Claude Design adds entries here. Claude Code marks them [DONE]. -->

| # | Page | What Changed | API Calls | Status |
|---|------|-------------|-----------|--------|
| 1 | Sitemap.dc.html | New main app hub — Listen/Events/Pages tabs | GET /api/transparency | ✅ Done |
| 2 | Studio.dc.html | Full creator dashboard — event wizard, demand radar, earnings | POST /api/events, GET /api/studio | ⏳ Pending |
| 3 | Show.dc.html | 45/45/10 split bar added | GET /api/events/:id | ✅ Done |
| 4 | All pages | lib/api.js + lib/nav.js injected | — | ✅ Done |
| 5 | ~~Radio.dc.html~~ | DELETED — DJ Studio superseded by WebRadio (owns /radio). Go-live/schedule/manage actions repointed to Studio.dc.html. | — | ✅ Removed |
| 6 | WebRadio.dc.html | Live audio player + saved shows + schedule tabs; bookmark per show persists to localStorage; playback position saved per show | GET /api/radio/shows, GET /api/radio/shows/:id/replay | ⏳ Pending |
| 7 | About.dc.html | Timeline corrected — all dates now 2026 (Portland ME founding), removed pre-founding 2025 dates | — | ✅ Done |
| 8 | All web pages (26) | Global NavShell added — fixed top nav with wordmark, nav links, role pill, skeleton overlay, footer auto-injected. lib/shell.css + lib/NavShell.js | — | ✅ Done |
| 9 | mobile/*.jsx (14 files) | All DS namespace refs updated 0c4241 → 39bcce; hex colors → DS tokens; px values → rem; ResizeObserver suppressed | — | ✅ Done |
| 10 | Charter.dc.html | New standalone charter page at /charter | GET /api/transparency | ✅ Done |
| 11 | Auth.dc.html | Sign In / Create Account toggle; signup collects name + role (Fan/Artist/Venue/DJ) → Welcome. Replaces deleted Join.dc.html. | POST /api/auth/register | ✅ Done |
| 12 | NavShell (all pages) | Single nav only — desktop top bar (logo left · Listen\|Events\|Pages center · Log In + Sign Up right), mobile fixed bottom tabs. lib/nav.js is now a no-op. | — | ✅ Done |
| 13 | Auth.dc.html | Signup routes → Welcome.dc.html?role=X. Welcome routes role-aware: Fan→FanHome, Artist→Studio, Venue→Venue, DJ→DJProfile. Sign-in routes → FanHome. | — | ✅ Done |
| 14 | Offline.dc.html | New 503/offline fallback page. Handles ?code=offline\|503\|500. Auto-retries on window.online event. | — | ✅ Done |
| 15 | FanHome (Listen) | Sub-tabs restructured → Search · Seeds · Radio · Charts · Playlists. Added inline Search + Playlists panels; removed Events/Referral. | GET /api/feed/listen · POST /api/hype | ✅ Done |
| 16 | Events.dc.html | Sub-tabs restructured → Search · Local Events · For You · My Tickets. Search is its own tab; Recommended+Trending merged into For You. | GET /api/feed/events · GET /api/me/tickets | ✅ Done |
| 17 | Pages.dc.html | Sub-tabs restructured → My Page(s) · Network · Page Creator · Referral Link(s) · Settings. Referral moved here from Listen. | GET /api/me/pages · POST /api/referral/track | ✅ Done |
| 18 | Index.dc.html | New "What's a HYPE?" explainer section added below the "Everything in three taps" three-tab showcase. Static marketing content — mechanic intro, HYPE-fires-at-timestamp chip, 3-step (Hit the moment / One member one vote / Feeds the radar). | — (static) | ⏳ Pending |
| 19 | WebRadio.dc.html | Major radio show page upgrade: (1) ● LIVE pill with real-time listener count + elapsed; REPLAY pill for on-demand shows. (2) Interactive waveform scrubber (44-bar, click to seek). (3) Hype mechanic — fire a hype at the current timestamp, live tally. (4) DJ identity block — follow/tip, promoter color #b983ff, charter earns line. (5) Up-next crate queue (4 tracks, animated dot for next track, shown when live). (6) Tonight/This week schedule rail on Schedule tab — eyebrow chips, notify-me toggle per slot. (7) Offline/no-show state with next-slot chip. All existing API/localStorage wiring preserved. | GET /api/radio-shows (API.radio.list) | ⏳ Pending |
| 20 | Home.dc.html | RECONCILE — design exists, never queued. Verify live `/home` matches this design; implement/update if drifted. | GET /api/feed/home | ⏳ Pending |
| 21 | Profile.dc.html | RECONCILE — design exists, never queued. Verify live `/profile` matches; implement/update if drifted. | GET /api/me | ⏳ Pending |
| 22 | Artist.dc.html | RECONCILE — design exists, never queued. Verify live `/artists/[slug]` matches; implement/update if drifted. Public artist profile (tracks, events, split card, tip jar). | GET /api/artists/:slug | ⏳ Pending |
| 23 | DJProfile.dc.html | RECONCILE — design exists, never queued. Verify live `/artists/[slug]?role=dj` matches; implement/update if drifted. DJ page — shows, radio archive, promoter earnings. | GET /api/artists/:slug (role=dj) | ⏳ Pending |
| 24 | FanProfile.dc.html | RECONCILE — design exists, never queued. Verify live `/fans/[slug]` matches; implement/update if drifted. | GET /api/fans/:slug | ⏳ Pending |
| 25 | Venue.dc.html | RECONCILE — design exists, never queued. Verify live `/venues/[slug]` matches; implement/update if drifted. | GET /api/venues/:slug | ⏳ Pending |
| 26 | Tickets.dc.html | RECONCILE — design exists, never queued. Verify live `/me/tickets` matches; implement/update if drifted. | GET /api/me/tickets | ⏳ Pending |
| 27 | ~~Discover.dc.html~~ | DELETED — redundant with Search + Charts + Seeds (FanHome). Sitemap links removed. | — | ✅ Removed |
| 28 | Search.dc.html | RECONCILE — design exists, never queued. Verify live `/search` matches; implement/update if drifted. Global search — artists, shows, venues, tracks. | GET /api/search?q= | ⏳ Pending |
| 29 | Notifications.dc.html | RECONCILE — design exists, never queued. Verify live `/me/notifications` matches; implement/update if drifted. Role-aware center — mark read, filter by type. | GET /api/me/notifications · POST /api/notifications/read | ⏳ Pending |
| 30 | Settings.dc.html | RECONCILE — design exists, never queued. Verify live `/me/settings` matches; implement/update if drifted. | GET /api/me/settings · PATCH /api/me/settings | ⏳ Pending |
| 31 | Welcome.dc.html | RECONCILE — design exists, never queued. Verify live `/welcome` matches; implement/update if drifted. Post-signup welcome card, role-aware next-step routing. | — | ⏳ Pending |
| 32 | Payout.dc.html | RECONCILE — design exists, never queued. Verify live `/payout/[id]` matches; implement/update if drifted. Post-event payout receipt — 45/45/10 breakdown, fan view toggle. | GET /api/payout/:eventId | ⏳ Pending |
| 33 | PromoterHome.dc.html | RECONCILE — design exists, never queued. Verify live `/home?role=promoter` matches; implement/update if drifted. Referral link, click stats, earnings. | GET /api/feed/home (role=promoter) · POST /api/referral/track | ⏳ Pending |
| 34 | EventCreator.dc.html | RECONCILE — design exists, never queued. Verify live `/events/new` matches; implement/update if drifted. 4-step wizard with live split calculator. | POST /api/events | ⏳ Pending |
| 35 | Verification.dc.html | RECONCILE — design exists, never queued. Verify live `/verify` matches; implement/update if drifted. Artist/DJ/Venue 3-step proof submission. | POST /api/verify | ⏳ Pending |
| 36 | AdminDash.dc.html | RECONCILE — design exists, never queued. Verify live `/admin` matches; implement/update if drifted. | GET /api/admin | ⏳ Pending |
| 37 | Support.dc.html | RECONCILE — design exists, never queued. Verify live `/support` matches; implement/update if drifted. Help center, FAQ, contact admin@ihype.org. | — | ⏳ Pending |
| 38 | Beta.dc.html | RECONCILE — design exists, never queued. Verify live `/beta` matches; implement/update if drifted. TestFlight invite + beta welcome. | POST /api/beta/join | ⏳ Pending |
| 39 | Legal.dc.html | CANONICAL legal page — Privacy · Terms · Charter tabs; serves /legal + /privacy + /terms. Terms content merged in; brand facts fixed (Portland ME · admin@ihype.org). | GET /api/transparency (optional) | ⏳ Pending |
| 40 | ~~Privacy.dc.html~~ | DELETED — merged into Legal.dc.html Privacy tab. Route /privacy → Legal. | — | ✅ Removed |
| 41 | ~~Terms.dc.html~~ | DELETED — merged into Legal.dc.html Terms tab. Route /terms → Legal. | — | ✅ Removed |
| 42 | Email.dc.html | RECONCILE — design exists, never queued. Verify email templates in `src/lib/email/` match; implement/update if drifted. 6 types — Ticket drop, Show reminder, Referral, Welcome, Beta invite, Ticket confirmation. | — | ⏳ Pending |
| 43 | Events.dc.html | Fixed sub-tab bar shifting: tab row now renders above the search field, so selecting Search reveals the input below the nav instead of pushing the nav down. UI-only. | GET /api/feed/events | ⏳ Pending |
| 44 | lib/NavShell.js + lib/shell.css | Added global fixed footer bar (Legal \| Support \| © 2026 ihype.org — all rights reserved), injected on every page. Made header + footer solid (removed transparency/backdrop-blur). Mobile footer sits above bottom tab bar. | — | ⏳ Pending |
| 45 | Legal.dc.html | Consolidated legal pages: deleted standalone Privacy.dc.html + Terms.dc.html; Terms clauses (refunds, liability, changes, termination) merged into Legal Terms tab. Legal is now canonical for /legal + /privacy + /terms. Deleted Radio.dc.html (→ WebRadio owns /radio; DJ actions → Studio) and Discover.dc.html (redundant). All inbound links repointed. | — | ⏳ Pending |
| 46 | Support.dc.html | Privacy quick-card no longer links to Legal — opens a Privacy panel with actions: Report a problem (prefills support form), Request data deletion, Detach identity early, Download my data, Wipe hype history, + link to policy. | POST /api/support (per-action) · GAP: /me/privacy/{delete,detach,export} | ⏳ Pending |
| 47 | Events.dc.html | My Tickets tickets now have actions: Show QR (full ticket QR modal), Transfer (Free or Face-value-by-recipient-referral-code, routes promoter 10% share), Cancel ticket (refund; blocked <48h before event → offers Transfer). | POST /api/tickets/:id/transfer (existing) · GAP: POST /api/tickets/:id/cancel | ⏳ Pending |
| 48 | lib/NavShell.js + Advertise.dc.html | Footer bar now reads Advertise \| Legal \| Support \| © 2026 ihype.org. Added Advertise.dc.html (from DS advertise template — campaign builder, AI vetting demo, transparency). | — | ⏳ Pending |
| 49 | Auth.dc.html + Welcome.dc.html | First page after successful auth is now Home.dc.html for all roles (was FanHome/Studio/role-split). | POST /api/auth/login | ⏳ Pending |
| 50 | lib/NavShell.js + lib/shell.css | Header wordmark → Space Grotesk (modern). Logo animates a springy letter-wave on hover and an explode/shard burst on click, then routes to Home (when signed in) / Index (out). Reduced-motion respected. | — | ⏳ Pending |
| 51 | Pages.dc.html | My Page tab → "YOUR PAGES": selectable chips for each of the user's active pages (Fan + creator role + Promoter), each in its role color; selecting one drives the detail card (name, role, view/edit). "+ New page" jumps to Page Creator. | GET /api/me/pages | ⏳ Pending |
| 52 | Studio.dc.html DELETED + Mobile.dc.html DELETED | Removed creator workbench (Studio) — all links repointed: Pages edit → Profile; Home go-live/schedule/manage/edit → WebRadio; demand radar → FanHome; upload → Profile; EventCreator "back" → Home; Sitemap cards → Home/EventCreator; Welcome routing → Home. Deleted unused Mobile.dc.html iOS reference. | — | ⏳ Pending |
| 53 | Advertise.dc.html | Modernized: stale nav links (Discover deleted) → Listen/Events/Pages/Advertise; wordmark → Space Grotesk "iHYPE"; footer bottom bar → "© 2026 ihype.org — all rights reserved"; footer column links repointed to live pages. | — | ⏳ Pending |
| 54 | mobile/ DELETED | Removed the deprecated mobile React kit (15 files) — its only consumer (Mobile.dc.html) was already deleted. Clears orphaned lint. | — | ⏳ Pending |
| 55 | Pages.dc.html + PromoterHome.dc.html + Events.dc.html | Renamed "referral link/code" → **HYPE Link** everywhere — the fan's unique referral + identifier (URL now /h/{id}). Surfaces HYPE ID for request/referral/payout tracking. | GET /api/me/referrals (HYPE Link) | ⏳ Pending |
| 56 | Pages.dc.html | Network tab rebuilt into real networking: Following/Followers/Mutuals stats, search, role filters (Artists/Venues/DJs/Fans), connection cards with follow toggle + relationship context linking profiles, and a "Suggested for you" section from hypes & shows. | GET /api/network · POST /api/network/follow | ⏳ Pending |
| 57 | Artist.dc.html + DJProfile.dc.html + Venue.dc.html | Added "Engage" tab connecting each creator page to email/social engagement: Email.dc.html (campaign), EmailSequence.dc.html (welcome drip), SocialPosts.dc.html (social) + share. | — (links) | ⏳ Pending |
| 58 | FanHome.dc.html | Listen › Playlists now dynamic — create (name + color modal), open (track detail view), edit, delete; empty states. Listen › Charts now filter by genre + location scope (Local/Regional/National/Global). | GET /api/charts/hype?scope=&genre= · CRUD /api/playlists | ⏳ Pending |
| 59 | ~~Beta.dc.html~~ + ~~BetaLanding.html~~ | DELETED — beta landing no longer used. TestFlight copy lives in Email.dc.html (Beta invite type). LaunchChecklist ref updated. | — | ✅ Removed |
| 60 | ~~Sitemap.dc.html~~ | DELETED — internal nav hub no longer used. Removed from design-diff routeMap; Welcome 'Explore later' → Home. | — | ✅ Removed |
| 61 | Auth.dc.html + Welcome.dc.html | Post-auth flow is now Auth → Welcome → Home for BOTH sign-in and sign-up (was sign-in→Home direct). Welcome CTA + 'Explore later' both land on Home. | POST /api/auth/{login,register} | ⏳ Pending |
| 62 | lib/NavShell.js + lib/shell.css | Logo animation reworked to be professional (not cute): removed springy letter-bounce + shard explosion. Now a metallic accent sheen sweep + left-drawn underline on hover, and a single confident scale-pulse + expanding ring on click before navigating. Reduced-motion safe. | — | ⏳ Pending |
| 63 | Artist.dc.html + DJProfile.dc.html + Venue.dc.html | Added 'Recommend' advertising tab — data-driven reach recommendations from hype map, fan requests, relisten/crate/fan data; each rec has an estimated reach + scope and a CTA into Advertise.dc.html. | GET /api/{artists,venues}/:slug/insights | ⏳ Pending |
| 64 | FanAppUI.html DELETED + Verification.dc.html | Audit: deleted orphaned FanAppUI.html (4-platform prototype pointing at removed mobile JSX, unlinked). Fixed Verification 'Open iHYPE' link (Mobile.dc.html → Home.dc.html). Confirmed no dead links to any deleted page remain. | — | ⏳ Pending |
| 65 | ~~Beta.dc.html~~ + ~~BetaLanding.html~~ + ~~Sitemap.dc.html~~ | DELETED (2026-07-01) — beta landing + internal nav hub no longer used. Fixed dangling refs: Welcome 'Explore later' → Home; Auth sign-in → Welcome (was direct→Home) so BOTH sign-in/sign-up route Auth→Welcome→Home; LaunchChecklist Mobile.dc.html refs → Welcome.dc.html. | — | ✅ Removed |
| 66 | web/ + ticketing/ DELETED | Audit: deleted 2 more orphaned root folders (9 + 1 files) — UI-kit reference JSX not loaded by any `.dc.html` page. Dropped stale `Deck.dc.html` reference (file never existed) from CLAUDE.md, GITHUB_CLAUDE.md, CLAUDE_CODE_HANDOFF.md, DESIGN_SYNC.md Page Map. | — | ✅ Removed |
| 67 | Home.dc.html (nav auth state) | Post-auth nav now reads **Log Out** (was "Sign Out") since Home is always a post-auth screen. | — | ⏳ Pending |
| 68 | Advertise.dc.html | Swapped custom hand-rolled nav + footer for the SHARED `<nav-shell auth="in">` + global footer (was visually inconsistent with rest of site). Adjusted hero top padding to account for shell.css's body padding. Fixed a double-footer-mount bug (x-dc runtime re-invokes the custom element) by making the footer append idempotent in NavShell.js. | — | ⏳ Pending |
| 69 | lib/NavShell.js + lib/shell.css | Logo rebuilt: white "i" + orange "HYPE" (matches Index.dc.html's own wordmark treatment). Hover = full rainbow color-cycle sweep across letters. Click = radial particle explosion + letters flying apart, then navigates to Home. Index.dc.html is unaffected (it has its own separate hardcoded wordmark, never loads NavShell). Reduced-motion safe. | — | ⏳ Pending |
| 70 | lib/shell.css | Added **Forum** (serif, Google Fonts) as the site's header font via `--font-display` token override — cascades to every page h1/h2 automatically. Added a global orange underline (sized to content) under all h1/h2. Nav-shell tab bar font → Forum; active/hover tab underline → white (was orange, freeing orange for headers only). | — | ⏳ Pending |
| 71 | Full project re-audit (2026-07-01) | Confirmed zero dead links to any deleted page across all `.dc.html`/`.md` files. Confirmed every orphaned code folder removed (mobile/, studio/, web/, ticketing/, FanAppUI.html, BetaLanding.html). Project is 38 `.dc.html` pages + lib/ + _ds/ + docs, all internally consistent. Ready for Claude Code sync via `node scripts/design-diff.js`. | — | ✅ Done |
| 72 | WebRadio.dc.html, Venue.dc.html, Support.dc.html, FanProfile.dc.html, Verification.dc.html | PHASE 1 (polish pass): replaced emoji glyphs with proper stroke-SVG icons (DS spec: no emoji in UI chrome) on the core product pages — DJ/mixer icon, note, ticket, link, people, lock, trophy, bookmark, bolt (hype), venue. FanProfile got a small reusable `<Ico>` helper. Marketing/reference artifacts (Index role cards, Email templates, NotifDesigns, Screenshots, PressKit) intentionally left as-is — different context (exported static assets, not live UI chrome). | — | ✅ Done |
| 73 | lib/micro.css + lib/micro.js (NEW) | PHASE 2 (micro-interactions): new shared site-wide utility — `.tab-fade-in` (subtle fade+rise on tab/panel mount, reduced-motion safe) and `window.ihypeBurst(event, color?)` (small particle burst for hype-fire actions, distinct from the logo's bigger explosion). Loaded on WebRadio, Pages, Artist, DJProfile, Venue, FanHome, Events, FanProfile. | — | ✅ Done |
| 74 | WebRadio.dc.html, Pages.dc.html, Artist.dc.html, DJProfile.dc.html, Venue.dc.html | Applied `.tab-fade-in` to every tab panel across these 5 tabbed pages. Wired `ihypeBurst` into the actual hype-fire actions: WebRadio's hype button, Artist's per-track hype icon, FanHome's Seeds hype button. **Bug fix:** Artist.dc.html's "Shows" tab had lost its render block during an earlier edit (tab button existed but clicking it showed nothing) — restored. | — | ✅ Done |
| 75 | lib/shell.css + lib/micro.css | **CRITICAL FIX:** the site-wide page-entrance animation (`ihype-rise`, applied to `.page`/`#root`/`.wrap`/etc. on nearly every page) and the new Phase-2 `ihypeFadeSlide` both animated `opacity: 0 → 1`. Verifier caught Artist.dc.html rendering **completely invisible** — `#root` opacity stuck at 0 indefinitely even though React had rendered all content correctly underneath. Root cause: gating real content's visibility on an animation resolving is unsafe — if the animation stalls/restarts/never fires for any reason (timer throttling, backgrounded tab, etc.), the whole page can go permanently blank. Fixed by removing `opacity` from both keyframes, keeping only the `translateY` slide — worst case now is a harmless few-px static offset, never invisible content. This pattern (visible end-state as the base, motion as pure enhancement) now applies everywhere both animations are used. | — | ✅ Done |
| 75b | Welcome.dc.html | PHASE 3: tailored onboarding — replaced generic instructional copy with a real "your first move" preview card per role (Fan: suggested artist + nearby show; Artist: your live page + create-show CTA; Venue: top demand match near your room; DJ: crate status + schedule-show CTA), each linking directly to the relevant page. Also fixed stale copy referencing the deleted Studio page (now Events/EventCreator/WebRadio). | — | ✅ Done |
| 75c | lib/shell.css (logo) | Logo font switched from Space Grotesk → **Syne 800** (matches Index.dc.html's own wordmark treatment, per feedback that it read better). Rainbow hover now applies to "HYPE" only — the "i" stays plain white at all times, hover included. | — | ✅ Done |
| 75d | Artist.dc.html, DJProfile.dc.html | PHASE 4 (loading/skeleton states): added a real `loading` state gating the hero + content behind the DS's own `Skeleton`/`SkeletonText` components while `API.artists.get()` resolves (or a brief 420ms beat when no backend is wired, so the state is demonstrated honestly rather than never appearing). Added the missing `ihype-shimmer` @keyframes to lib/micro.css — the DS bundle's Skeleton component references it but it was never defined in the DS's own token files, so shimmer wasn't animating anywhere it was used. Scope note: Venue.dc.html and Home.dc.html were evaluated and skipped — neither has a genuine async data-population gap to protect (Venue's content is static HTML; Home doesn't call the API at all), so a skeleton there would be decorative, not functional. | GET /api/artists/:slug (existing) | ✅ Done |
| 76 | Profile.dc.html (rebuilt), Venue.dc.html, image-slot.js | Rebuilt Profile.dc.html into a real role-aware page customizer — reads `ihype_role` from localStorage and renders tailored sections per role (Artist: bio/genres/pinned track/booking email; DJ: bio/genres/show schedule/crate description; Venue: about/address/capacity/amenities/photo gallery; Fan: bio/taste/sprite picker). All photo-based via `<image-slot>` (cover + avatar + venue gallery) — explicit "Photos only, no video" note on Venue gallery per brand rule. Role-colored accents, role-specific privacy toggles, links to Settings.dc.html (hosting/account) and Pages.dc.html (your pages, non-fan roles). Venue.dc.html gained a Customize + Settings action row in its hero (previously the only public profile page missing owner actions) — Artist/DJ/Fan already had these. Confirmed no unbound leftover DS folders exist — only the bound `_ds/ihype-design-system-39bcce...` is present. | — | ✅ Done |
| 77 | WebRadio.dc.html, Artist.dc.html | PHASE 6 (final polish phase): crowd-hype visualization. WebRadio's live/replay player shows a `hypeDensity` strip above the waveform — seeded clusters (independent from amplitude data) rendered as height+opacity-scaled ticks in accent orange, showing at a glance which moments in a show got hyped hardest. Artist track rows get a compact 16-bar `trackHypeDensity` strip between title and hype-fire icon — same clustering technique, scoped per track id. Both deterministic (seeded pseudo-random) for stable re-renders; swap for real per-timestamp hype-event aggregates when wired to the API. **All 6 polish phases now complete.** | GET /api/shows/:id/hype-density, GET /api/tracks/:id/hype-density (timestamp→count buckets) | ✅ Done |
| 78 | lib/shell.css + lib/NavShell.js + 12 pages | **MOBILE-READY BETA PASS.** Shell: new slim mobile top bar (48px — logo + Sign Up/Log Out, ≤768px) alongside the existing bottom tab bar; body padding adjusted; footer drops "— all rights reserved" on small screens. Page sweep — every non-collapsing grid now has a mobile breakpoint: Pages (.ref-stats/.net-stats→2col), FanHome (.stat3→2col), Auth (.role-grid 4→2×2), Profile (.row-2→1col), Tickets (.ticket-details 3→2), EventCreator+PressKit (.grid2→1col), Show (.layout→1col, ticket box unsticks), Advertise (inline 2col grids collapse), Artist/DJProfile/Venue (hero rows wrap). WebRadio/Home/Index/Events already responsive. **Cleanup:** deleted design_handoff_webradio/ (superseded by DESIGN_SYNC.md), lib/ds-base.js (unreferenced dupe), uploads/ (incorporated source images). Kept assets/ihype-icon.png (App Store icon). LaunchChecklist: fixed stale mobile-kit refs, added responsive-web item. | — | ⏳ Pending |
| 79 | Advertise.dc.html | **HYPE Screen — automated ad engine.** Guardrails expanded 3→5 gates: (1) Verified buyers only — purchasing gated to verified artists/venues/DJs/music orgs, no badge = no buy button; (2) Audio relevance scan — uploaded spot transcribed + scored against advertiser profile; (3) Listener safety — hate/explicit/scam flags detected in the audio itself; (4) Copyright firewall — audio fingerprinting + protected-lyric/title scan; (5) Reputation risk — misleading pricing, fake scarcity, impersonation, off-platform resale. New interactive "Step 03 · Upload & go live" section: audio dropzone (MP3/WAV/AAC, 15–60s, audio-only per brand rule) runs an animated 5-gate scan with waveform; on all-pass, checkout unlocks instantly ("Buy this campaign" → builder) — fully automated purchase, no human review; fails auto-refund. Cleared-example card updated to 5 gates. | POST /api/ads/scan (async gate results) · POST /api/ads/purchase (verified-only, requires scan token) | ⏳ Pending |
| 83 | Artist.dc.html, DJProfile.dc.html | Track/crate upload modals now include a cover-art `<image-slot>` (id generated per upload) alongside the audio dropzone — once cleared, the uploaded track's row shows the dropped cover art instead of the flat gradient tile (both `track-art` tiles bumped 44/40px → 64/60px to fit the drop-zone caption). Existing mock tracks keep their gradient tiles (no `artId`). | — | ⏳ Pending |
| 84 | FanHome.dc.html | **Playlist drag-and-drop reorder** — grip handle on each track row in the playlist detail view; pointer-based drag (mouse+touch unified) with a live insertion-line indicator, reorders `playlist.tracks` on drop. **Discover unified into real playlists** — "Discover" is now an actual entry in the `playlists` array (auto-created, non-deletable) instead of a separate ad-hoc list; Seeds swiped right append into it, and it's reachable/reorderable/shareable like any user-made playlist. The old Seeds-tab preview now reads live from that playlist and links to it ("Open →"). **Playlist sharing** — new Share button on playlist detail copies a `ihype.org/playlists/:id` link and shows collaborator avatars; simulates a friend "joining via your link" a couple seconds after sharing (adds to a `collaborators` array shown as stacked avatar chips) — demonstrates the "share → others get added" loop pending real invite-link backend. **Bug fix:** FanHome had its own local `@keyframes ihype-rise` (pre-dating the site-wide opacity-gating fix in lib/shell.css) that collided by name and silently won, making the entire Listen tab invisible on load — removed the duplicate. | POST /api/playlists/:id/reorder · POST /api/playlists/:id/share (returns join link) · WS/poll for collaborator-joined events | ⏳ Pending |
| 85 | Profile.dc.html | Confirmed no chat/comments/review features exist anywhere in the product (only a stray unused "live chat" mention inside the DS bundle's own onboarding-tour demo copy, which no page invokes — left as-is since it's bound DS reference material, not live UI). **Stat trackers added to the page customizer** — new "Stat trackers" section, role-specific menu of real stats (Fan: shows attended, artists hyped, hype streak, tickets bought, referrals; Artist: total hypes, shows played, tickets sold, fans reached, monthly listeners, track plays; DJ: shows hosted, listeners, crate size, hype streak, replay plays; Venue: shows hosted, tickets sold, capacity fill, artists booked) with toggle checkboxes, a live preview strip, and a 4-stat cap with a toast warning past the limit. Values are mocked for the picker; wiring the preview + selection into the actual public profile pages (Artist/DJ/Venue/FanProfile stat tiles) is a natural follow-up once real analytics exist. | GET /api/users/:id/stats (all metrics) · PUT /api/users/:id/pinned-stats (selection + order) | ⏳ Pending |
| 86 | Events.dc.html | **Tickets archive.** My Tickets tab now has an Active/Archive segmented toggle — Archive holds past (USED) and cancelled tickets in a muted style with a "View receipt" action (title/date/city/price, no QR/transfer/cancel since those don't apply to a closed ticket). Added 3 mock archive tickets. `ticketById` now checks both lists so QR/transfer/cancel modals keep working. | GET /api/me/tickets?status=archive | ⏳ Pending |
| 87 | Artist.dc.html, DJProfile.dc.html, Venue.dc.html, FanHome.dc.html | **Artists/venues/DJs can create & share playlists.** Playlists already lived on the Fan Listen surface (built row 84) — rather than duplicating that UI, added a "Create a playlist" link row to each role's Engage tab that deep-links to `FanHome.dc.html?tab=playlists&new=1`, landing directly on Playlists with the new-playlist modal open. FanHome now reads `?tab=` and `&new=1` from the URL on load to support this. Sharing reuses the existing Share-link + collaborator-avatar flow from row 84. | — | ⏳ Pending |
| 88 | Artist.dc.html, DJProfile.dc.html, Venue.dc.html | **Privacy: minimum trackable threshold on Recommend insights.** Added a persistent "Cohorts under 5 fans are never shown" mono-caps note (matching the DS's own k\u22655 cohort-privacy pattern) to all three Recommend tabs, alongside the existing hype-map/fan-request/listener-data insight cards. All current insight numbers in these cards are already well above the floor (47+ fans/requests minimum) \u2014 this makes the privacy floor explicit and visible rather than just implicit. | \u2014 | \u23f3 Pending |
| 82 | WebRadio.dc.html | **Floating/hideable gesture player.** The in-page player card is now a `position:fixed` floating dock (bottom-center, above footer/tab bar) with a chevron to collapse it to a slim now-playing strip (art + title + inline play/pause) — state persists via localStorage `ihype_player_expanded`. Replaced the 3-button prev/play/next transport row with a single circular gesture pad: tap = play/pause, swipe right = skip to next playable show, swipe left = restart current show, swipe-and-hold (either direction) = continuous fast-forward/reverse (±5s per 180ms tick while held), swipe up = hype (fires the existing hype burst + tally). Implemented via pointer events (mouse+touch unified) with hold-vs-swipe-vs-tap disambiguation on a single ref; live broadcasts disable restart/seek (no scrubbing on live audio) but still support skip/hype/tap. | — | ⏳ Pending |
| 80 | Artist.dc.html | **HYPE Screen — artist upload filter.** New "Upload track" button on the Tracks tab opens an automated scan modal that every upload must clear before going live: (0) ID3 tag check — metadata scanned for copyrighted titles, artists & ISRC codes; (1) Layer 1 · Acoustic fingerprinting (ACR) — catches 1:1 ripped samples; (2) Layer 2 · Feature & motif matching — catches melodic & chord-progression plagiarism; (3) Layer 3 · Vocal & synth AI analysis — catches deepfakes & unauthorized voice clones. Audio only (MP3/WAV/FLAC, no video). Sequential animated gate pass; on clear, the track appears in the list instantly; flagged uploads auto-reject with matched source listed. | POST /api/tracks/upload (returns async scan job) · GET /api/tracks/scan/:jobId (layer results) | ⏳ Pending |
| 81 | DJProfile.dc.html | **HYPE Screen — crate upload filter.** Same 4-gate pipeline as Artist uploads (ID3 tag check → ACR fingerprinting → feature/motif matching → vocal/synth AI analysis) on a new "Add to crate" button in the Crate tab. DJ-pink accent (#ff3e9a); on clear, track appears in crate ("nothing airs until it clears" — crate tracks feed radio broadcasts); flagged uploads auto-reject with matched source. Audio only (MP3/WAV/FLAC). | POST /api/tracks/upload · GET /api/tracks/scan/:jobId (same contract as Artist) | ⏳ Pending |
| 89 | Settings.dc.html | **Role-aware Payout / Payment section.** Artist/DJ/Venue now see a "Payout destination" group (masked bank account, 2-business-day payout timing, mini 45/45/10 split chip scoped to their role, link to Payout.dc.html history, tax-form upload placeholder). Fans see "Payment methods" instead (masked card, face-value+$0-fees note, add-method action). Role read from `ihype_role` localStorage, same pattern as Pages/Profile. | GET/PUT /api/me/payout-method (Artist/DJ/Venue) · GET/PUT /api/me/payment-method (Fan) · GET /api/me/tax-forms | ⏳ Pending |
| 90 | Verification.dc.html | **Tailored post-verification "while you wait" card** — replaces the old generic "Open iHYPE →" button. Each role now sees a next-step preview matching Welcome's pattern (Artist: draft your page; DJ: build your crate; Venue: set up your room), each linking to Profile.dc.html so the wait isn't dead time. CTA copy also changed to "Explore as a Fan →" to correctly set expectations that full role access is still pending review. | — | ⏳ Pending |
| 91 | 18 files (Artist, DJProfile, Venue, Events, FanHome, FanProfile, Home, Index, Notifications, Pages, Profile, Search, Show, Social, SocialPosts, WebRadio, Welcome, AdminDash) | **Sitewide contrast bump.** Scripted find/replace of the two most-used muted-text opacities — `rgba(240,235,229,.4)` → `.5` and `.45` → `.55` — across every `.dc.html` file. These values back the majority of secondary/meta text (timestamps, sub-labels, empty-state copy) sitewide and sat right at the edge of comfortable legibility against the `#0a0805` background. Purely a contrast/legibility fix — no layout or color-identity change. | — | ⏳ Pending |
| 92 | (audit only, no changes) | **Motion-consistency review.** Confirmed Auth.dc.html, Legal.dc.html, and Support.dc.html intentionally have no `tab-fade-in`/`lib/micro.js` — they're static form/legal/reference pages without tabbed panels or hype-style actions, so the shared micro-interaction utilities (built in rows 73–74) don't apply. This is by design, not a gap: motion is reserved for the interactive product surfaces (Listen, Events, Pages, profile pages) where it reinforces state changes. No changes made. | — | ✅ N/A — confirmed correct |
| 94 | robots.txt (NEW), sitemap.xml (NEW), Index.dc.html, + noindex meta on 38 .dc.html files | **SEO funnels to the site only — total aggregation, zero per-user indexing.** Only 5 pages indexable: Index, Legal, Charter, Support, Advertise (all aggregate/institutional, no user data). Every other page (Artist/Venue/DJ/FanProfile, Show, Events, Radio, Search, Pages, Settings, Payout, AdminDash, Auth, all account surfaces) got `noindex, nofollow` + canonical back to homepage. `robots.txt` disallows all user-content route prefixes (`/artists/`, `/venues/`, `/fans/`, `/shows/`, `/events`, `/radio`, `/me/`, `/admin`, etc.) so no individual artist/DJ/venue page, ticket, or show can surface in search — discovery only happens inside the product. `sitemap.xml` lists only the 5 indexable pages. Added description/OG/Twitter-card meta to Index.dc.html (had none). | Backend must serve robots.txt/sitemap.xml at domain root and honor per-route noindex when server-rendered | ⏳ Pending |
| 93 | lib/NavShell.js, lib/shell.css, Legal.dc.html, SECURITY_COMPLIANCE.md (NEW) | **Security/compliance pass (design-layer scope).** Added a sitewide cookie/analytics consent banner (Accept all / Essential only, persisted client-side, linked to Legal → Privacy) via NavShell so it appears once on every page. Legal.dc.html's Privacy tab expanded with explicit GDPR rights (access/rectification/erasure/portability/restriction/objection + lawful basis), a Cookies section, and a Security section (encryption in transit/at rest, access limited to need). **Scope honesty note:** ISO/IEC 27002, SOC 2, NIST CSF 2.0, PCI DSS, CIS Controls, and ISO/IEC 27701 are properties of the running system, infrastructure, and organization — they cannot be achieved by editing static `.dc.html` mockups. `SECURITY_COMPLIANCE.md` maps each named framework to the actual backend/infra/process work required, with a recommended sequencing (PCI tokenization check → wire GDPR/CCPA endpoints → unified access-control/logging/incident-response project covers SOC2+NIST+CIS → ISO certification only if a partner requires it). | POST /api/privacy/deletion-request, GET /api/privacy/export (Support's Privacy panel already has UI for both, needs wiring); cookie consent should gate analytics script loading, not just record the choice | ⏳ Pending |
| 95 | Events.dc.html, Show.dc.html, EventCreator.dc.html | **Cover-art image-slots extended to remaining event surfaces.** Events.dc.html event cards now use `<image-slot>` (per-event id) instead of a flat gradient icon in the 110px art rail; falls back to the existing gradient background if empty. Show.dc.html hero gets a 160px cover-art slot above the title. EventCreator.dc.html step 1 (Basics) gets a 140px cover-art slot so organizers set art at creation time. Completes the cover-art rollout started earlier on Artist/DJ track uploads. | — | ⏳ Pending |
| 96 | Payout.dc.html, Legal.dc.html | **Print CSS.** Both pages are the two most likely to be printed (receipts, terms). Added `@media print` rules: hide nav-shell/footer/consent-banner/tab-segments/buttons, force white background + dark text (the site's only theme is dark-on-dark, unreadable on paper), keep card borders visible in gray, avoid breaking cards mid-page. | — | ⏳ Pending |
| 97 | (audit only, no changes) | **Dark/light mode — flagged out of scope.** The design system defines one theme only (full dark, no light-mode tokens). Building a second theme is a design-system-level project (new token set, contrast re-audit, every hardcoded `rgba(240,235,229,...)` sitewide would need a var), not a page-level tweak. Not attempted; flagged so it's a deliberate decision, not an oversight. | — | ✅ N/A — flagged, not built |
| 98 | Venue.dc.html | **Bug fix (verifier-caught, 2 rounds).** Round 1: the hero-skeleton edit (row 93/earlier) left `.hero`'s closing `</div>` missing, nesting `.content` inside the hero flex container, plus a stray trailing `}` broke the inline script's parse — both fixed. Round 2: `.venue-skel` had an inline `style="display:flex"` that permanently overrode the stylesheet's `body.venue-loading` show/hide toggle, so the skeleton never actually hid (and stole width from `.hero-row-data`, causing the title-wrap). Moved `display` into the CSS rule so the toggle is the only thing controlling it. Page now loads clean, skeleton correctly swaps to real content. | — | ✅ Done |
| 99 | WebRadio.dc.html (MiniPlayer mobile shell) | **Bug fix (Claude Code, live-code audit 2026-07-03).** The global mini-player (`src/components/MiniPlayer.tsx`) and the mobile bottom tab bar were both pinned to `bottom: 0` on mobile — the tab bar's higher z-index (900 vs 200) fully covered the mini-player's play button and track title whenever something was playing. Fixed directly in code (offset the player above the 60px tab bar at the same `max-width:768px` breakpoint the tab bar itself uses, matching the existing `CookieConsent` pattern) since it was a layering bug, not a design change. Flagging here so WebRadio.dc.html's own mini-player mock reflects this stacking rule too. | — | ✅ Done (code) |
| 100 | WebRadio.dc.html / global player | **SoundCloud-inspired mobile UX review (2026-07-03) — needs `.dc.html` design work, not implemented.** (1) Expand-to-full-player: tapping/swiping the mini-player should open a full-screen player (queue, larger art, scrub bar) instead of staying a static title/play-pause bar. (2) Replace the flat 2px progress line with a waveform-style scrubber so users can see and jump to a position in a track/DJ set at a glance — WebRadio.dc.html already has a 44-bar waveform scrubber concept (row 19); the global mini-player and full-player should reuse that visual language. | — | ⏳ Pending |
| 101 | Discover / FanHome (Listen) / Events list views | **SoundCloud-inspired mobile UX review (2026-07-03) — needs `.dc.html` design work.** Audit list/card rows for one consistent row height and layout (avatar, title, one line of metadata, right-aligned action) — SoundCloud keeps every feed row the same shape for fast thumb-scanning. Current card density varies across `/discover`, `/listen`, `/shows` in the live app. | — | ⏳ Pending |
| 102 | Discover / FanHome (Listen) feed cards | **SoundCloud-inspired mobile UX review (2026-07-03) — needs `.dc.html` design work.** Add a compact, single-tap Hype affordance (icon + count) directly on feed/list cards, reusing the existing `POST /api/hype` wiring and `HypeButton` component logic. Today `HypeButton` only renders on show/profile detail pages (`src/components/HypeButton.tsx`) as a full-width CTA — engaging with something in a feed requires a full page visit first. Needs a compact icon+count variant sized for card density. | GET (existing) /api/hype, POST /api/hype | ⏳ Pending |

---

## DONE
<!-- Completed syncs with commit SHA -->

| # | Page | Commit | Date |
|---|------|--------|------|
| 1 | Sitemap, Show, NavShell, Charter, Join, About, Offline, mobile tokens | All 14 design sync items implemented | — | 2026-06-24 |

---

## Quick Commands for Claude Code

```bash
# Pull latest design files from this project
# (Claude Design exports; Claude Code imports)

# 1. Check what changed
cat DESIGN_SYNC.md | grep "⏳ Pending"

# 2. View the design page
open https://claude.ai/projects/[project-id]/[page].dc.html

# 3. Implement + commit
git add src/app/[route]/page.tsx
git commit -m "sync: implement [page] from design — DESIGN_SYNC #[n]"
git push origin main

# 4. Verify live
open https://ihype.org/[route]

# 5. Mark done in DESIGN_SYNC.md
# Change ⏳ Pending → ✅ [commit SHA]
```
