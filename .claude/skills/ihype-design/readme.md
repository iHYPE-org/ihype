# iHYPE Design System

## Overview

**iHYPE** is a music fan engagement platform that puts listeners at the center of the live music ecosystem. It blends music discovery, streaming, live-show ticketing, and collective governance into a single privacy-first app.

The platform serves four distinct user roles — **Fan**, **Artist**, **Venue**, and **Promoter** — each with their own color identity and tailored experience. The core mechanic is the **HYPE**: fans vote on specific timestamp moments in tracks, and those votes become real setlist signals for upcoming shows. One member, one vote — regardless of spend.

### User Roles
iHYPE has four distinct user types, each with tailored UI, copy, notifications, and analytics:
- **Fan** — discovers music, hypes artists, earns from referral links (10% promoter pool share)
- **Artist** — sells tickets direct, keeps 45%, uses Tour Creator and demand radar
- **Venue** — books from the demand radar, keeps 45% of every ticket sold in their room
- **DJ** — hosts radio shows, builds a crate, earns promoter cuts; also acts as a Promoter

**Promoters** are Fans or DJs who share a referral link — when a ticket buyer uses that link, the promoter earns a proportional share of the 10% promoter pool based on how much of the total gate their promotion drove.

### Products / Surfaces
- **Fan App (4-platform)** — primary consumer surface; one codebase, four frames: Desktop (browser), Mobile (generic), iOS (Dynamic Island, SF Pro), Android (gesture bar, Material density). 3-tab arch: Listen · Events · Pages
- **Android Mobile App** — earlier standalone prototype (430×910 design spec)
- **Desktop Workbench** — artist / promoter / venue back-office dashboard (wider, left-rail nav)

### Sources
- Codebase: `iHYPE_files/_bootstrap.html` — full compiled React app design canvas (12,619 lines)
- CSS: `iHYPE_files/index-CO1gdLWv.css` — anthropicons icon font + Anthropic Serif (internal)
- Fonts: `iHYPE_files/css2` — Google Fonts declarations (DM Sans, Instrument Serif, JetBrains Mono, Roboto)

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
Deep, warm-black backgrounds. Almost no pure black — the base is `#0a0805`, a charred-wood brown-black. Four background tiers (bg → bg2 → bg3 → bg4) create subtle depth without gradients. The single accent is **iHYPE orange-red** (`#ff5029`) — vivid, high-energy, used for CTAs, the HYPE fire mechanic, and the Artist role. Role colors are distinct and saturated: Fan purple (`#b983ff`), Venue teal (`#22e5d4`), Promoter pink (`#ff3e9a`).

### Typography
- **Syne** — display face. Weight 800 exclusively for wordmark (`iHYPE`) and large stat numerals. Tight letter-spacing (−0.02em). Used at 16–54px.
- **DM Sans** — body and UI text. Weight 400/500. Workhorse for content, buttons, navigation labels.
- **JetBrains Mono** — eyebrows, timestamps, metadata chips. All-caps, 8–11px, tracked out to 0.14–0.18em. Creates a "technical readout" aesthetic.
- **Instrument Serif** — editorial / pull-quote use only. Italic form. Rarely used.

### Backgrounds
Full dark — no light mode. Background layers `bg → bg2 → bg3 → bg4` provide depth. No full-bleed photography. Album art uses square aspect-ratio panels with large border-radius (32px) and vivid gradient overlays sourced from the accent/role color. Radial gradients provide inner glow and shadow on album art.

### Cards & Panels
- Border: `1px solid rgba(255,255,255,0.06)` (subtle ghost border)
- Background: `--bg-surface` (#100d09)
- Border-radius: 10px for stat blocks / panels; 24px for settings groups; 32px for album art
- No drop shadows on cards — depth comes from background layering
- Glow shadows for special elements: `0 0 60px rgba(255,80,41,0.18)` on the QR ticket card

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
- 4px: tags, small badge chips
- 8px: standard buttons, inputs
- 10px: stat blocks, section panels
- 16px: icon button backgrounds
- 24px: settings group containers
- 32px: album art, large image cards
- 9999px: avatars, pill tags

### Imagery
No photography used — placeholder gradients only. Album art is represented by vivid linear/radial gradient compositions using the accent color. When real imagery is used, it should be warm-toned, high-contrast, saturated.

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
SKILL.md                            ← Agent skill manifest

tokens/                             ← 59 CSS custom properties
  fonts.css                         ← @font-face (Syne · DM Sans · JetBrains Mono · Instrument Serif)
  colors.css                        ← backgrounds · ink · lines · accent · roles · utility
  typography.css                    ← font families · sizes · letter-spacing
  spacing.css                       ← spacing · radius · shadows · transitions
  base.css                          ← CSS reset + html/body defaults

assets/
  logo/wordmark.svg                 ← iHYPE wordmark (dark bg)
  logo/wordmark-light.svg           ← iHYPE wordmark (light bg)

guidelines/                         ← 20 DS tab cards
  colors-bg / ink / accent / semantic   ← color specimens
  type-display / body / mono / serif / scale  ← type specimens
  spacing-tokens / radius / shadows     ← spacing specimens
  brand-wordmark / brand-roles / brand-wordmark-svg  ← brand

components/core/                    ← 10 components, each with .jsx + .d.ts + .prompt.md
  Button   ← solid / ghost / outline; role-color aware
  Badge    ← inline role/status label
  Chip     ← selectable filter pill (genre, role, status)
  Card     ← bordered panel with optional header
  Eyebrow  ← mono-caps metadata label
  Input    ← text field; label / hint / error / leading / trailing
  Tabs     ← horizontal tab bar with active underline + count badge
  Toast    ← transient notification (success / warn / error / info)
  Toggle   ← iOS-style switch row with detail line
  Avatar   ← role-color initials avatar
  core.card.html  ← component showcase (DS tab)

ui_kits/
  fan-app/
    index.html                        ← 4-platform Fan App (Desktop · Mobile · iOS · Android)
                                        Platform switcher tab row; single shared codebase
    data.js                           ← All IHYPE_DATA mock (shows, charts, artists, playlists,
                                        radio, notifications, demand, receipts, promoter data)
    Seeds.jsx                         ← Swipe-deck discovery (hype/skip/save gestures + hint overlay)
    ListenTab.jsx                     ← Search · Seeds · Radio · Charts · Playlists · Following
    EventsTab.jsx                     ← My Tickets · Local · For You · Search + checkout flow
    PagesTab.jsx                      ← My Page (Fan/DJ/Artist/Venue) · Browse · Create
    Sheets.jsx                        ← All modal overlays: Tour Creator, Live Event, Post-Purchase
                                        45/45/10 reveal, Notif Primer, Post-Show Rating, Ticket
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
  workbench/
    index.html                        ← Interactive Workbench prototype (Artist/Venue/Promoter)
                                        Screens: Home analytics, Seeds, Shows, Govern
                                        Design spec: full-viewport desktop, left rail 88px
  advertise/
    index.html                        ← Marketing website — Advertise page
                                        Sections: Hero + live ticker, Campaign builder (pricing),
                                        AI guardrails scanner, Two paths, Transparency, Footer
                                        Design spec: full-width marketing, light paper section
  ops/
    index.html                        ← Operator console shell (iH/OPS)
    ops.jsx                           ← Full React app: Queue review, Platform health, Accounts, Log
                                        Design spec: full-viewport desktop, same rail pattern as Workbench

templates/
  android-screen/
    AndroidScreen.dc.html             ← Mobile screen scaffold (copy to start a new screen)
  workbench-screen/
    WorkbenchScreen.dc.html           ← Desktop screen scaffold (copy to start a new screen)
```
---

## CHANGELOG

### v4 — June 21, 2026
- **Fan App (4-platform)** — full rebuild of ui_kits/fan-app/ as a 7-file modular React app
  - Platform switcher: Desktop (browser chrome + sidebar) | Mobile | iOS (Dynamic Island, SF Pro) | Android (gesture bar)
  - 3-tab architecture: **Listen** (Search · Seeds · Radio · Charts · Playlists · Following) · **Events** (Tickets · Local · For You · Search) · **Pages** (My Page role-aware · Browse · Create)
  - Seeds swipe deck: gesture-driven hype/skip/save with hint overlay and per-card match detection
  - Hype Budget: 🔥🔥🔥/week pill depletes on hype, persists via localStorage, resets Monday
  - Artist Profile Sheet: tap any artist → full profile (bio, tracks, upcoming shows, follow/hype)
  - Seed Match Sheet: after hyping a seed with a nearby show, "Playing near you" fires
  - Post-Purchase 45/45/10 reveal: animated payout breakdown after every ticket purchase
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
