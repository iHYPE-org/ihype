# iHYPE Design System

## Overview

**iHYPE** is a music fan engagement platform that puts listeners at the center of the live music ecosystem. It blends music discovery, streaming, live-show ticketing, and collective governance into a single privacy-first app.

The platform serves three account types — **Fan**, **Artist**, and **Venue** — plus **Advertiser**, each with its own color identity and tailored experience. The core mechanic is the **HYPE**: fans vote on specific timestamp moments in tracks, and those votes become real setlist signals for upcoming shows. One member, one vote — regardless of spend.

Visually, iHYPE is now a **hi-fi console**: a cream slide-rule dial in a brass bezel, a walnut cabinet, and a tuner you drag or wheel between destinations — replacing the earlier dark "Bulletin" direction. See CHANGELOG's 2026-08-20 and 2026-08-19 entries.

### Account types
- **Fan** — discovers music, hypes artists, earns from sharing a HYPE Link (10% promoter-pool share)
- **Artist** — sells tickets direct, keeps 70%, uses Tour Creator and demand radar
- **Venue** — books from the demand radar, keeps 70% of every ticket sold in their room
- **Advertiser** — runs music-only campaigns through the reviewed `/advertise/register` flow

**There is no Promoter account type.** Any Fan, Artist or Venue promotes just by sharing its HYPE Link — when a ticket buyer uses it, the sharer earns a share of the 10% promoter pool. `--role-promoter` colors that payout slice only.

### Products / Surfaces
- **`templates/simplified-app/`** — the app shell: walnut cabinet, tuner dial nav, full-screen player, chart-style map
- **Fan App (4-platform)** (`ui_kits/fan-app/`) — earlier consumer surface; one codebase, four frames: Desktop, Mobile, iOS, Android
- **Android Mobile App** (`ui_kits/android_app/`) — earlier standalone prototype
- **Desktop Workbench** (`ui_kits/workbench/`) — artist / venue back-office dashboard

### Sources
Synced from `iHYPE-org/ihype` on GitHub — see `github.md` for the current commit and screen map, and `design/console-2026-08/` + `design/design-system-8/` in that repo for the upstream design sources this project mirrors.

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Terse, high-energy.** iHYPE never wastes words. Headlines are punchy, rarely more than 3–4 words. Labels and eyebrows are ALL CAPS.
- **Second-person, direct.** "Your data · this week" not "User data statistics." Always "you/your," never "users."
- **Technical-but-legible.** Data concepts (cohort queries, k≥5, identity detachment) are referenced matter-of-factly without being dumbed down — the audience is music-literate and privacy-aware.
- **No emoji.** The UI avoids emoji entirely; expressiveness comes from typographic contrast and color.
- **Metric midpoints and abbreviations preferred.** "9.8k" not "9,800." "3:38" for timestamps. "1.5×" for multipliers.
- **Role-flavored copy.** Each role (Fan, Artist, Venue, Promoter) sees copy phrased for their context.
- **Governance language is civic, not corporate.** "One member, one vote · regardless of dollars given."

### Specific Examples
- Eyebrows: `TONIGHT · 9:00 PM · DOORS OPEN`, `FROM · TONIGHT'S QUEUE`, `AT EMPTY BOTTLE`
- Stats: `0 PII sold`, `24h identity detached`, `12 cohort queries (k≥5)`
- Sections: `Seeds` (not "Discover"), `Govern` (not "DAO" or "Vote"), `Shows` (not "Events")
- CTAs: `Get ticket`, `RSVP free`, `Get ticket`, `Detach identity early`
- HYPE mechanic label: `● HYPE FIRES AT 3:38`

---

## VISUAL FOUNDATIONS

### Color
Warm cream backgrounds — the console direction (2026-08-19/20). The base is `#f0dfb8`; ink is near-black `#1c1408` (13.8:1). Four background tiers (`--bg-base` → `--bg-surface` → `--bg-raised` → `--bg-overlay`) create depth without gradients. The console chrome (player, nav, map) is a separate **walnut** material (`--walnut`/`-2`/`-3`), not another step of the cream tint — walnut needs its own ink (`--ink-on-walnut(-2/-3)`), never `--ink-1/2/3`.

The single accent is **iHYPE orange-red** (`#ff5029`) — the tuning pointer, the pilot lamp, HYPE. It is a **fill, never copy**: `#ff5029` on cream is 2.48:1 and fails AA as text. Use `--accent-text` (`#923319`, 5.89:1) wherever the accent is a word, and `--ink-on-accent` (dark ink, not white) as a label on the accent fill. Role colors, re-measured against cream: Fan violet `--role-fan` (`#8a4fd6`), Venue teal `--role-venue` (`#0f8f80`), Advertiser amber `--role-advertiser` (`#a5760a`). `--role-promoter` (`#c81866`) colors the 10% pool slice only — it is not an account type. Each role has a `*-text` pair tuned for cream; the fill and the copy token are never interchangeable even when the hex used to match.

### Typography
- **Bricolage Grotesque** — display face. Variable, with an optical-size axis: feed `opsz` the pixel size and set `--tracking-display` (−.035em) at headline sizes, or large text looks loose and small text cramped. Weight 800 for headlines and the wordmark, 600 for nav pills and card titles.
- **Work Sans** — body and UI text. Weight 400/500/600. Workhorse for content, buttons, navigation labels.
- **JetBrains Mono** — eyebrows, timestamps, metadata chips, tabular figures. All-caps, 11px min, tracked out to 0.14–0.22em. Creates a "technical readout" aesthetic. This is the ONLY exemption below the 15px content floor.
- **Instrument Serif** — promoted from editorial-only to the tuner dial's station names and every `h2`. The console's own voice. Yeseva One is retired (it set the old radial-nav module names; the dial replaced that nav).
- **Content floor is 15px.** A dial readout, a form label, an error message is content, not an eyebrow.

### Backgrounds
Cream is canonical, and it is the only ground — no theme switcher. Depth on the board comes from `--bg-surface` → `--bg-raised` → `--bg-overlay`, three warm steps down from `--bg-base`. The console chrome (player, nav, map) is walnut instead of a deeper cream — a distinct material, not another step of the same tint. No full-bleed photography.

### Cards & Panels
- Border: `1px solid var(--line)` — dark ink at low alpha on the board
- Background: `--bg-surface`
- Border-radius: **`--radius-panel` (3px)** for every card/row/stat — a console is machined: panels have a cut edge, not a moulded one. `--radius-card` is kept as a legacy alias to the same token. `--radius-pill` (9999px) is untouched: a button that reads as a key still reads as a key.
- No drop shadows on cards — depth comes from background layering
- The walnut cabinet, the tuner dial and the full player's plate have their own verbatim CSS in `tokens/console.css` (`.walnut-panel`, `.tuner-dial`, `.walnut-plate`, `.mmm-console`) — copy those, don't restate their gradients ad hoc.

### Spacing
Consistent 8px base grid. Main content padding: 24px horizontal. Gap between stacked items: 12–16px. Section spacing: 22px top padding between content blocks.

### Animations & Motion
- Transitions: `cubic-bezier(0.2, 0.7, 0.3, 1)` — slightly springy, fast-in slow-out
- Duration: 150–200ms for hovers/state changes; 300ms for screen transitions
- No decorative looping animations
- The progress bar thumb uses a `0 0 0 6px rgba(240,235,229,0.18)` glow ring on the scrubber

### Hover / Press States
- Hover: background lightens to `bg3` (rgba(255,255,255,~5%))
- Active buttons: no scale; subtle opacity drop (0.85)
- Icon buttons: transparent bg → `rgba(0,0,0,0.05)` on hover

### Borders & Dividers
- Default separator: `1px solid rgba(255,255,255,0.06)`
- Stronger separator: `1px solid rgba(255,255,255,0.14)`
- Active left-rail indicator: `2px solid <roleColor>` — the only border used for emphasis

### Iconography
Custom inline SVGs. Stroke-based, 1.4–1.8px weight, round linecaps. See ICONOGRAPHY section.

### Corner Radii
- **`--radius-panel` (3px)** — every card, row, stat, section panel. A console is machined: a cut edge, not a moulded one.
- 8px: standard buttons, inputs
- 16px: icon button backgrounds
- 9999px (`--radius-pill`): avatars, pill tags, buttons that read as a key — deliberately untouched by the console pass

### Imagery
No photography used — placeholder gradients only. Album art is represented by vivid linear/radial gradient compositions using the accent color; on the walnut cabinet it sits in a brass-ringed `.walnut-plate` bezel. When real imagery is used, it should be warm-toned, high-contrast, saturated.

### Mobile
375px is the design floor, not the edge case — see `MOBILE.md` and the four `guidelines/mobile-*.card.html` cards: one breakpoint at 620px, 44px touch targets, `--pane-pad`/`--chrome-l`/`--chrome-r`/`--player-l` for safe areas, `dvh` never `vh`.

---

## ICONOGRAPHY

iHYPE uses **custom inline SVGs** only — no icon font (beyond the internal `anthropicons` used in the Claude design tool context). All icons are:
- **Stroke-based** with `strokeWidth: 1.4–1.8`, `strokeLinecap: round`, `strokeLinejoin: round`
- **Fill: none** for most; **fill: currentColor** for solid icons (heart filled, play triangle)
- **Size: 12–22px** in UI; 14px most common for nav/meta icons; 24–34px for playback controls
- **Color: currentColor** — inherits from parent, enabling role-color theming

### Core Icon Set (from source)
`bolt` (⚡ Home/HYPE), `heart` (Seeds/Favorite), `trending` (Charts), `calendar` (Shows), `vote` (Govern), `search`, `arrow` (directional, rotatable), `check`, `x` (close), `pin` (location), `qr` (check-in), `share`, `verified` (badge), `play`, `pause`, `skip-forward/back`

No third-party icon library. No emoji as icons. No unicode substitutes.

---

## FILE INDEX

```
styles.css                          ← global entry point (@imports only)
readme.md                           ← This file
MOBILE.md                           ← Mobile spec: 375px floor, one breakpoint, safe areas, permissions
github.md                           ← Synced repo, branch, last commit, screen map
SKILL.md                            ← Agent skill manifest

tokens/                             ← CSS custom properties
  fonts.css                         ← @font-face (Bricolage Grotesque · Work Sans · JetBrains Mono · Instrument Serif)
  colors.css                        ← cream ground · ink · walnut · brass · accent · roles · utility
  typography.css                    ← font families · sizes (15px content floor) · letter-spacing
  spacing.css                       ← spacing · radius (--radius-panel 3px) · shadows · mobile insets
  base.css                          ← CSS reset + html/body defaults
  console.css                       ← walnut panel · tuner dial · walnut plate · mmm-console, verbatim CSS to copy

assets/
  logo/wordmark.svg                 ← iHYPE wordmark (dark bg)
  logo/wordmark-light.svg           ← iHYPE wordmark (light bg)

guidelines/                         ← DS tab cards, incl. 4 Mobile cards (breakpoints/safe-areas/touch/permissions)
  colors-bg / ink / accent / semantic   ← color specimens
  type-display / body / mono / serif / scale  ← type specimens
  spacing-tokens / radius / shadows     ← spacing specimens
  brand-wordmark / brand-roles / brand-wordmark-svg  ← brand
  mobile-breakpoints / mobile-safe-areas / mobile-touch / mobile-permissions  ← mobile spec, vendored 2026-08-21

components/core/                    ← 24 components, each with .jsx + .d.ts + .prompt.md
  Button      ← solid / ghost / outline; role-color aware
  Badge       ← inline role/status label
  Chip        ← selectable filter pill (genre, role, status)
  Card        ← bordered panel with optional header
  Eyebrow     ← mono-caps metadata label
  Input       ← text field; label / hint / error / leading / trailing
  Textarea    ← multiline field; label / hint / error
  Tabs        ← horizontal tab bar with active underline + count badge
  Toast       ← transient notification (success / warn / error / info)
  Toggle      ← iOS-style switch row with detail line
  Avatar      ← role-color initials avatar
  Icon        ← Lucide CDN wrapper
  Select      ← dropdown field
  Dialog      ← modal with title/description
  Checkbox    ← labeled checkbox with detail line
  Radio       ← labeled radio group
  Skeleton / SkeletonText ← loading placeholders
  ProgressBar ← labeled progress bar with % value
  StatCard    ← metric tile (value + label + optional delta)
  StatusPill  ← rounded connection/status indicator (ok/pending/warn/neutral)
  EmptyState  ← "nothing here yet" pattern with icon/title/detail/action
  ListRow     ← shared row shape (leading + title/meta + trailing) for lists
  HypeButton  ← the namesake mechanic — flame toggle, live count, pop + ring animation
  core.card.html / hype.card.html  ← component showcases (DS tab)

components/shell/   ← Music · Map · Me app-shell chrome (added v8, walnut console v9)
  LogoTrigger ← the 76px accent squircle; the only persistent nav affordance
  ArcNav      ← the radial fan; hand-placed ARC table, two breakpoints; walnut + brass discs
  TunerDial   ← v9: the console's signature control, replaces a horizontal tab strip. Cream
                dial in a brass bezel; drag or wheel to tune, brass keys step by one
  RotaryNav   ← left-hand detented rotary switch, Map · Music · Me, drag or tap-tick to jump
  JoystickTransport ← right-hand 4-way brass joystick: tap play/pause, drag L/R prev/next, drag up/down expand/collapse full player
  PlayerPill  ← persistent mini player on the walnut dock, artwork shrinks it, names link out
  FullPlayer  ← phone only: full-screen player, walnut cabinet + brass-ringed album plate
  SeedDeck    ← Discover's swipe deck: one clip card, skip left / save right
  TicketQR    ← the wallet code as a scannable block, derived from the code
  IconAction  ← icon button that names itself on hover or long press
  NavHint     ← the current-module readout beside the trigger
  MapSheet    ← pin detail sheet on parchment; belongs to the map, closes when you leave it
  ModulePane  ← the single scroll container
  Scrim       ← nav dimmer, plus Vignette (the map's edge darkening)
  shell.card.html  ← the composed shell, nav open (DS tab)
  tuner.card.html  ← TunerDial alone and on the walnut cabinet (DS tab)

templates/simplified-app/  ← the app shell
  SimplifiedApp.dc.html ← Music · Map · Me shell, console direction (label "iHYPE App Shell")
  DiscoverMap.html      ← the map surface, console/parchment palette
  map.html    ← the real map: Leaflet + OpenStreetMap. Plain HTML, embedded by
                the shell, posts pin selections back as `ihype:select`.
                Venues sit on a street address; artists sit on a city centroid

templates/console-demo/  ← ConsoleDemo.dc.html — standalone walkthrough of the tuner dial,
                full player and map chrome against sample MUSIC content

ui_kits/
  fan-app/
    index.html                        ← 4-platform Fan App (Desktop · Mobile · iOS · Android)
                                        Platform switcher tab row; single shared codebase
    data.js                           ← All IHYPE_DATA mock (shows, charts, artists, playlists,
                                        radio, notifications, demand, receipts, promoter data)
    Seeds.jsx                         ← Swipe-deck discovery (hype/skip/save gestures + hint overlay)
    ListenTab.jsx                     ← Search · Seeds · Radio · Charts · Playlists · Following
    EventsTab.jsx                     ← My Tickets · Local · For You · Search + checkout flow
    PagesTab.jsx                      ← My Page (Artist/Venue) · Browse · Create
    Sheets.jsx                        ← All modal overlays: Tour Creator, Live Event, Post-Purchase
                                        70/20/10 reveal, Notif Primer, Post-Show Rating, Ticket
                                        Transfer, Artist Profile, Seed Match, Invite, Help/FAQ,
                                        Changelog, Settings, Feedback Widget
    Shell.jsx                         ← Onboarding (role→city→genres), Media Player bar,
                                        Bottom Tabs (neon glow, press states), Hype Budget pill,
                                        Notification Center, MobileShellV2, DesktopShell
  android_app/
    index.html                        ← Earlier standalone Android prototype (Fan-facing)
                                        Screens: Home (now-playing), Seeds (swipe deck),
                                        Shows, You (profile+taste map), Privacy, Transparency
                                        Design spec: 390×844, dark, bottom nav 4 tabs + 2 sub-screens
  advertise/
    index.html                        ← Marketing website — Advertise page
                                        Sections: Hero + live ticker, Campaign builder (pricing),
                                        AI guardrails scanner, Two paths, Transparency, Footer
                                        Design spec: full-width marketing, light paper section
  ops/
    index.html                        ← Operator console shell (iH/OPS)
    ops.jsx                           ← Full React app: Queue review, Platform health, Accounts, Log
                                        Design spec: full-viewport desktop, left rail pattern

templates/
  mobile-app/
    MobileApp.dc.html                 ← iOS + Android frames around the real shell, Capacitor config
  workbench-screen/
    WorkbenchScreen.dc.html           ← Desktop screen scaffold (copy to start a new screen)
```
---

## PRODUCT SYNC (ihype.org · github.com/iHYPE-org/ihype)

Reconciled July 2026 against the shipped product. Canonical facts:
- **Split: 70/20/10 · 0% iHYPE** — 70% artist, 20% venue, 10% promoter pool. A condition of incorporation ("the charter") — frozen at event publish, calculated per-event at settlement. iHYPE earns via optional creator tools, promoted discovery, and radio distribution — never the ticket split.
- **Payments**: Stripe direct (Zeffy retired). The card-processing fee — 2.9% + $0.30/transaction (AMEX 3.5% + $0.30) — is the ONLY charge above ticket face value, passed through at cost. iHYPE takes $0.
- **Backend seam**: the fan app is backend-ready. `lib/api.js` (mock/real client, mirrors `openapi.yaml`) + `lib/db.js` (IndexedDB) + `lib/hydrate.js` (maps live API rows into the `window.IHYPE_DATA` shape the UI reads, re-renders on `ihype:data`). To go live: set `window.IHYPE_API_BASE = 'https://api.ihype.app/v1'` before the scripts load — no component changes needed. Write paths: `IHYPE_SEND_HYPE(type,id)` and `IHYPE_PURCHASE(eventId, referralCode)`.
- **Funding**: entirely by advertising, restricted to music-related sources only, forever (like terrestrial radio). Not grants/memberships/donations. Run by two people + AI automation.
- **Org**: iHYPE Inc., not-for-profit, founded Portland, ME, January 2026. Contact: **admin@ihype.org** (never hello@).
- **HYPE resets every 24 hours, per target.** A member can keep hyping an artist they keep coming back to, but only once a day. The window is the anti-false-hype rule: two hypes an hour apart are one enthusiasm, two a day apart are two decisions. Implemented as a timestamp per target (never a boolean), so the wait can be stated — the control shows the time remaining ("17h 40m") and refuses the tap rather than letting the API reject it. Coarse to the minute on purpose; a second-by-second countdown turns a fairness rule into a game to be timed. Applies wherever HYPE is spent: player, seed deck, artist and venue pages.
- **No AI page generation.** Profile pages are built from a fixed per-type schema (`templates/page-builder/`): same sections, same order, same layout for Artist, Venue, Advertiser and Promoter — only the field set differs. Generation was retired 2026-08-08; it cost tokens on every page and still produced pages that had to be hand-edited into a common shape.
- **One outbound link per page, and it must be a domain the account owns.** No streaming, social or link-in-bio addresses, and iHYPE hosts or embeds no media. The app is the connector; the audience should end up somewhere the artist controls.
- **Three account types: Fan, Artist, Venue — plus Advertiser.** No DJ role (deleted 2026-08-06) and no Promoter role (deleted 2026-08-08). `templates/page-builder/` builds Artist, Venue and Advertiser pages only. The 10% promoter slice of the split is money, not an account type: every account promotes through its HYPE Link and earns from the pool, with nothing to sign up for and nothing to switch to.
- **Wordmark**: "iHYPE" — no interpunct (old `iH·YPE` spelling is retired).
- **Audio-only**: iHYPE has never hosted video and never will.
- **Verification copy pattern**: "Fan accounts are instant. Artist and Venue accounts require verification — it protects everyone in the 70/20/10 ecosystem." (~48h review; see `guidelines/verification.card.html`)
- **Promise copy pattern** (About page): 0% ticket fee · No streaming cuts · No ads · Open to all.
- New surfaces grounded in product code: `templates/charter/` (We take nothing.), `templates/about/` (timeline), Believers leaderboard + Wrapped cards in `guidelines/`.
- 2026 brand assets: `assets/brand/logo-sticker-2026.png`, `icon-512.png`, `icon-192.png`.
- ✅ The stale "45%" artist stat bug is fixed upstream — `src/app/artists/[slug]/page.tsx` now renders the real 70/20/10 split card. No longer a known issue.
- **Org status (confirmed 2026-07-20)**: iHYPE is officially 501(c)(3) certified with a Stripe account attached to its nonprofit bank account. **Paid ticketing is live** — real money moves (Stripe Checkout, real Connect transfers, real webhook-verified payouts). Copy can now say "live" rather than "backend-ready."
- **Retired product routes**: `/studio` and `/home` are bare redirects to `/listen` (the Workbench/role-switching single-dashboard concept is gone); `/beta` redirects to `/register`. DJ profiles live at `/promoters/[slug]`, not `/artists/[slug]`.
- All product-code gaps flagged in v6 (per-role dashboards/onboarding/settings, payouts, track detail, lineup/split, advertiser signup, booking inbox, event cancellation, support tickets) now have templates — see v7 below.

---

## CHANGELOG

### 2026-08-21 — GitHub sync + mobile spec vendored
- Confirmed the console direction (below) matches upstream's `design/console-2026-08/` handoff verbatim — no changes needed.
- Vendored the 2026-08-11 mobile pass, missed until now: `MOBILE.md`, 4 `guidelines/mobile-*.card.html` cards, `--pane-pad`/`--chrome-l`/`--chrome-r`/`--player-l` tokens — re-pointed to the console palette.
- `github.md` refreshed as the sync record.

### v8 — August 7, 2026 (Music · Map · Me overhaul)
- **Audited `iHYPE-org/ihype@main`.** No new commits since the 2026-08-07 sync (identical tree), but the shipped app is a generation ahead of this system: `src/components/mmm/*`, `src/app/mmm.css` and `src/lib/mmm-nav.ts` implement an app shell this project never carried. Drift table in `SYNC_AUDIT_2026-08-07-overhaul.md`.
- **New visual direction ("Bulletin").** Ground moved warm near-black → ink navy (`#0b1220`); ink warm cream → cool off-white (`#eef1f6`); display Syne → Bricolage Grotesque; body DM Sans → Work Sans. Accent `#ff5029` and the four role hues carried over unchanged. Re-anchored across 86 files — every core component, guideline card and template.
- **7 new shell components** in `components/shell/`, each with a `.d.ts` contract: LogoTrigger, ArcNav, PlayerPill, NavHint, MapSheet, ModulePane, Scrim (+ Vignette).
- **Radial arc nav** replaces the vertical pill column. `ARC` table exported from `ArcNav.jsx` with both breakpoints, matching `src/lib/mmm-nav.ts` value for value.
- **MUSIC tabs corrected**: Search removed as a tab, **Recommended** added → Discover · Radio · Charts · Recommended · Playlists. Universal search is now a persistent field on the MUSIC surfaces rather than a sixth tab.
- **ME flattened** — no fan-out submenu; Settings · Info · Legal · Accessibility are in-page rows.
- Token additions: `--radius-card` (18px), `--radius-pill`, `--radius-trigger`, `--shadow-trigger`, `--opsz-*`, `--tracking-display`, `--leading-*`.

### v7 — July 23, 2026 (component + template gap-fill)
- Added 5 core components: StatCard, StatusPill, EmptyState, ListRow, Textarea (23 total) — demoed in `components/core/core.card.html`
- Added 9 templates closing the gaps identified against the live product: Role Dashboard (Artist/DJ/Venue/Fan/Promoter analytics), Role Onboarding (Artist/DJ/Venue wizard), Role Settings, Track Detail (`/tracks/[hexId]`), Lineup & Split Agreement, Advertiser Signup (`/advertise/register`), Booking Inbox, Event Cancellation, My Support Tickets
- Added Payout Settings + Payout History templates (from the v6 backend-doc sync) grounded in the real `/me/payout-settings` and `/me/payouts` pages

### v6 — July 23, 2026 (backend-doc sync)
- Found backend seam docs contradicting the readme's own live-status note: `BACKEND_SPEC.md`, `openapi.yaml`, `schema.sql`, `lib/api.js` (+ mirrors in `engineering/` and `templates/fan-app/api.js`) still described payouts as "banking-gated" / test-mode
- Confirmed against `iHYPE-org/ihype@main`: `src/lib/show-payouts.ts` runs real per-show Stripe Connect transfers automatically on a cron; `/me/payout-settings` and `/me/payouts` are real, live pages — not projections
- Updated all backend docs, `lib/api.js`'s `payouts` object (no longer throws a hardcoded 503), `index.html`, `guidelines/architecture.html`, `templates/beta-launch-deck/BetaLaunchDeck.dc.html`, and `beta/README.md` from "gated/blocked" language to "live"
- Re-synced `templates/ios-app/IosApp.dc.html` (Dynamic Island + SF Pro chrome) alongside the existing Android app template
- Fixed 9 templates using dynamic `style="...{{ }}..."` holes for categorical role/state colors (compiler flags these as paint-blocking) — replaced with literal `sc-if`-branched markup: Status, Transparency, Audit, Legal, PromoterDashboard, Discover, ProfilePage, Welcome, EventCreate, ShowDetail

### v5 — July 23, 2026 (GitHub audit)
- Audited `iHYPE-org/ihype@main` (CLAUDE.md + DESIGN_SYNC.md) for drift since last sync
- Confirmed fixed: stale "45%" artist stat bug — real product now shows correct 70/20/10
- Confirmed live: paid ticketing (real Stripe charges/transfers), 501(c)(3) certification — copy updated from "backend-ready" to "live" where relevant
- Confirmed retired: `/studio`, `/home` → redirect to `/listen`; `/beta` → redirects to `/register`; DJ profiles are at `/promoters/[slug]`
- No visual/component changes made — engineering-side (schema, cron, Stripe internals, per-role analytics/dashboards, onboarding wizards, payouts, lineup-split, advertiser signup) shipped without new design source; flagged in PRODUCT SYNC as templates not yet built here

### v4 — June 21, 2026
- **Fan App (4-platform)** — full rebuild of ui_kits/fan-app/ as a 7-file modular React app
  - Platform switcher: Desktop (browser chrome + sidebar) | Mobile | iOS (Dynamic Island, SF Pro) | Android (gesture bar)
  - 3-tab architecture: **Listen** (Search · Seeds · Radio · Charts · Playlists · Following) · **Events** (Tickets · Local · For You · Search) · **Pages** (My Page role-aware · Browse · Create)
  - Seeds swipe deck: gesture-driven hype/skip/save with hint overlay and per-card match detection
  - Hype Budget: 🔥🔥🔥/week pill depletes on hype, persists via localStorage, resets Monday
  - Artist Profile Sheet: tap any artist → full profile (bio, tracks, upcoming shows, follow/hype)
  - Seed Match Sheet: after hyping a seed with a nearby show, "Playing near you" fires
  - Post-Purchase 70/20/10 reveal: animated payout breakdown after every ticket purchase
  - Notification center: role-aware (Fan/Artist/Venue/DJ/Promoter)
  - Checkout flow with Ticketmaster price comparison and Apple Pay
  - All sheets wired: Live Event overlay, Ticket Transfer, Tour Creator, Radio Scheduler, Analytics, Help/FAQ, Changelog, Feedback widget, Invite
  - Bottom tabs: larger (26px icons), neon glow pill + press flash on active tab
- **DJ role** added as fourth user type (alongside Fan, Artist, Venue) with crate management, radio scheduling, and promoter earning
- **Promoter mechanic** clarified: Fans and DJs share referral links; proportional share of 10% pool based on total gate contribution
- `lookupArtist()` global helper in data.js for any-name → profile object resolution
- SF Pro (`-apple-system`) applied to iOS frame body text; Syne and JetBrains Mono preserved for brand classes
- **Ticket QR flip card** — tap any ticket in My Tickets → full-screen 3D flip to QR grid
- **Post-show memory card** — shareable "You were there" card after rating a show (Web Share API, clipboard fallback)
- **Playlist create sheet** — "+" in Listen → Playlists opens name + color picker with live preview
- **Friend activity sheet** — "👥 Friends" button in Listen → Following + Pages → My Page opens feed of friend hypes/purchases/shares
- **Demand chips on event cards** — "+38% this week" badge pulled from `D.demand` data shown on event card heroes
- **Swipe-back on Artist Profile** — edge swipe (left <28px, drag 60px right) closes sheet natively on iOS
- **Hype burst animation** — ring burst fires on Seeds swipe-right (already wired in Seeds.jsx)
- **Empty state for My Tickets** — "No tickets yet" prompt with Browse events CTA when list is empty
- **Notification badge clears** — red dot disappears after opening the notification tray (`notifsRead` state)
- **Web Share API on Invite** — native share sheet (iMessage/WhatsApp/Twitter) with clipboard fallback

### v3 — June 2026
- Added Icon component (Lucide CDN wrapper)
- Added Select, Dialog, Checkbox, Radio, Skeleton, SkeletonText, ProgressBar components (total: 17)
- Added semantic color aliases (--color-success/error/warning/info + *-bg variants)
- Added motion token file (tokens/motion.css) with 9 @keyframes including ihype-shimmer
- Added app icon SVG (assets/logo/icon.svg) and favicon (assets/logo/favicon.svg)
- Added Accessibility specimen card (guidelines/accessibility.card.html)
- Added Android App Onboarding flow (ui_kits/android_app/onboarding.html) — Welcome → Role → Taste
- Fixed/completed Advertise DC template (templates/advertise/Advertise.dc.html) with live pricing calculator
- Added @startingPoint tags to Android App, Onboarding, Workbench, and Advertise HTML files
- Updated component card to show all 17 components with interactive states

### v2 — June 2026
- Added @font-face rules (tokens/fonts.css) sourced from Google Fonts CDN
- Trimmed tokens from 87 → 59 (removed redundant aliases)
- Added Chip, Tabs, Toast components
- Added brand SVG wordmarks (assets/logo/wordmark.svg, wordmark-light.svg)
- Built root index.html hub wiring all 4 surfaces
- Added cross-surface nav: Workbench → iH/OPS, Advertise → Fan App, all kits → DS hub
- Converted all 4 UI kits to DC templates

### v1 — June 2026
- Initial design system build
- Token files: colors, typography, spacing, fonts, base
- Components: Button, Badge, Card, Eyebrow, Input, Toggle, Avatar
- UI kits: Android App, Workbench, Advertise, iH/OPS
- Foundation cards: colors, type, spacing, brand (19 cards)
- Templates: AndroidScreen, WorkbenchScreen

## 2026-08-20 — Console direction (walnut / brass / cream)

Full replace of the navy "Bulletin" palette, per the two reference photos
(walnut/brass full player, parchment map) and `uploads/ihype-hifi/`'s
HANDOFF.md, reconciled against RETRO_HIFI_DIRECTION.md. This project
**becomes** the console system — there is no navy variant kept alongside it.

- **One ground.** `--bg-base` moved from ink navy `#0b1220` to cream `#f0dfb8`; ink from `#eef1f6` to `#1c1408`. No theme switcher.
- **Two new materials.** `--walnut`/`-2`/`-3` and `--brass`/`--brass-deep`/`--lamp`, each with its own `--ink-on-walnut(-2/-3)` — never pair walnut with `--ink-1/2/3`. New `tokens/console.css` carries the verbatim `.walnut-panel`, `.tuner-dial`, `.walnut-plate`, `.mmm-console` classes from the shipped extract.
- **`--accent-text` (`#923319`) and role `*-text` pairs re-measured against cream** — `--accent` as copy was 2.48:1 on the new board and would have failed silently.
- **`--radius-panel` (3px)** replaces the 18px `--radius-card` for every card/row/stat — a token pass, not a rules pass, so it re-materialises every existing card at once. `--radius-pill` untouched.
- **New `TunerDial` component** (`components/shell/`) — the signature control, replaces horizontal tab strips.
- **Type floor raised to 15px**; Instrument Serif promoted from editorial-only to the dial and every `h2`; Yeseva One retired.
- Every core and shell component's hardcoded hex re-pointed to the new palette; `FullPlayer`, `MapSheet`, `ArcNav`, `PlayerPill`, `TicketQR` hand-tuned for their specific material (walnut chrome vs. parchment vs. the cream board).
- `RETRO_HIFI_DIRECTION.md` and `tokens/v9-retro.css`/`tokens/console.css` guideline notes folded in; superseded drafts of the same name in `uploads/` left as reference, not re-copied verbatim.

## 2026-08-15 — Music · Map · Me fix pass

Reported against the shipped app; fixed here in DS8, which the app follows.

- **Map** — the date selector (Dates · range · Calendar) now sits **under** the day strip rather than beside it. **Near me** is a GPS control on every layer, not artists only, and the count beside it names what the layer is showing. Chip row and range pill are `flex-shrink:0` and wrap, so the Artists chip can no longer collapse when Near me appears.
- **No-content placeholders** — new `contentState` tweak on the app shell (`populated` | `empty`). Set to empty, every surface renders its own frame blanked with shimmer bars: the seed deck, Recommended, Radio/Charts rows, Playlists, My Tickets and About Me. The layout is readable before there is any live content.
- **Settings** — Legal is nested under Info (one `Info and legal` group); Accessibility stays a group inside Settings.
- **Ops console** — moved off role tokens used as semantics and off raw hex: `--color-success`, `--color-error`, `--bg-raised`, `--warning`, `--heat-*`, `--blue`. No raw hex remains.
- **Copy** — "Every DJ and promoter…" → "Every artist and venue…"; "Artist, DJ, and venue review" → "Artist and venue review". English plus all 11 translations.
- **Backup** — `backups/full-2026-08-15/` (templates, tokens, lib, engineering, docs; component sources as inert `.txt` under `components-src/` so the compiler does not see duplicate exports).

Still app-side, not DS8: the live `/admin` page is not built from `templates/ops-console/`, and the live map, player and Me surfaces are behind the DS8 versions.

## 2026-08-15 — DJ role removed · promoting is an activity · radio is automated

Charter alignment pass across all 40 templates and all 12 languages.

- **No DJ role.** Removed from every role picker, profile type, dashboard, onboarding wizard, welcome flow and kit. `--role-dj` (which had been deleted from the token file while 51 references still pointed at it) is retired; those references now resolve to real tokens. Advertiser takes the fourth slot: pickers read **Fan · Artist · Venue · Advertiser**.
- **No Promoter role.** Promoting is the built-in activity every account already has. The Role Dashboard keeps "Promoting" as a *view* of a fan's own activity, not a fifth account type. The Discover "Promoter" people-type is gone.
- **Radio is automated.** No hosts, no crates, no DJ sets. Stations build themselves from genre, listening history, what the people you follow play and like, and where hype is rising nearby. Rewritten in Transparency, Artist Kit, Fan Kit, Track Detail, Advertiser Signup, About and the Beta deck (whose "DJ Radio Studio" slide is now "Automated radio").
- **Promoter pool stated precisely.** The 10% is split **per ticket** among everyone whose HYPE Link contributed to that sale, and payouts require the sharer to be **18 or older**. Applied in Charter and Show Detail.
- **i18n.** 21 keys rewritten in English and all 11 translations; 33 dead DJ/DJ-Kit keys deleted from all 12 dictionaries. Zero DJ mentions remain in any dictionary, including transliterations (диджей, دي جي, 打碟).
- **Guidelines.** `brand-roles` and `architecture` cards now show Fan · Artist · Venue · Advertiser, and "Promoting = any account w/ a HYPE Link".

Left deliberately: "Closing DJ set" in Lineup Split and "DJ nights" in the venue genre list — real-world set and event types, not account roles. The Landing waitlist picker stays Fan · Artist · Venue because advertisers apply through the reviewed `/advertise/register` flow rather than the waitlist.


## Snapshots

- **HIFI version** — `export/backups/2026-08-22-hifi/`. The walnut-and-brass
  console direction at the point the whole navigation model worked end to end:
  rotary MAP/MUSIC/ME knob, tuner dial, 4-way joystick transport, and the five
  console templates that hang off them. Reference and rollback only — nothing
  under `export/` is compiled. Its own README records the decisions and the
  bugs that are easy to reintroduce.
